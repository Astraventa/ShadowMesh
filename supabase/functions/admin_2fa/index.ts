// Admin 2FA Edge Function - Server-side 2FA management for admin accounts
// This ensures 2FA works across all devices

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_USERNAME = "zeeshanjay"; // Hardcoded admin username

// TOTP functions (same as two_factor_auth)
function base32Decode(base32: string): Uint8Array {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  base32 = base32.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((base32.length * 5) / 8));
  
  for (let i = 0; i < base32.length; i++) {
    const charIndex = base32chars.indexOf(base32[i]);
    if (charIndex === -1) {
      throw new Error(`Invalid base32 character: ${base32[i]}`);
    }
    value = (value << 5) | charIndex;
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output;
}

async function verifyTOTP(secret: string, code: string, window: number = 1): Promise<boolean> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return false;
  }

  const timeStep = 30;
  const now = Math.floor(Date.now() / 1000 / timeStep);
  
  // Check current time step and adjacent windows (for clock skew)
  for (let i = -window; i <= window; i++) {
    const testTime = now + i;
    const testCounter = new Uint8Array(8);
    let tempTime = testTime;
    
    for (let j = 7; j >= 0; j--) {
      testCounter[j] = tempTime & 0xff;
      tempTime >>>= 8;
    }
    
    const key = base32Decode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, testCounter);
    const sigArray = new Uint8Array(signature);
    
    const offset = sigArray[19] & 0x0f;
    const testCode = ((sigArray[offset] & 0x7f) << 24) |
                     ((sigArray[offset + 1] & 0xff) << 16) |
                     ((sigArray[offset + 2] & 0xff) << 8) |
                     (sigArray[offset + 3] & 0xff);
    
    const testCodeStr = (testCode % 1000000).toString().padStart(6, "0");
    
    if (testCodeStr === code) {
      return true;
    }
  }
  
  return false;
}

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, code, secret } = await req.json();

    // Get or create admin settings
    let { data: adminSettings, error: fetchError } = await supabase
      .from("admin_settings")
      .select("*")
      .eq("username", ADMIN_USERNAME)
      .single();

    if (fetchError && fetchError.code === "PGRST116") {
      // Admin settings don't exist, create them
      const { data: newSettings, error: createError } = await supabase
        .from("admin_settings")
        .insert({
          username: ADMIN_USERNAME,
          two_factor_enabled: false,
          two_factor_secret: null,
        })
        .select()
        .single();
      
      if (createError) {
        throw createError;
      }
      adminSettings = newSettings;
    } else if (fetchError) {
      throw fetchError;
    }

    switch (action) {
      case "check_status": {
        // Check if 2FA is enabled (for login flow)
        return new Response(
          JSON.stringify({
            enabled: adminSettings?.two_factor_enabled ?? false,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      case "setup": {
        // Generate new secret and return QR code URI
        const newSecret = generateSecret();
        const email = "admin@shadowmesh.com";
        const issuer = "ShadowMesh Admin";
        const totpUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

        // Store secret but don't enable yet (wait for verification)
        const { error: updateError } = await supabase
          .from("admin_settings")
          .update({
            two_factor_secret: newSecret,
            two_factor_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("username", ADMIN_USERNAME);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({
            secret: newSecret,
            qrCode: totpUri,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      case "enable": {
        // Verify code and enable 2FA
        if (!code || !secret) {
          return new Response(
            JSON.stringify({ error: "Code and secret are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Verify the code matches the secret
        const isValid = await verifyTOTP(secret, code);
        
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Invalid code. Please enter the current code from your authenticator app." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Enable 2FA
        const { error: enableError } = await supabase
          .from("admin_settings")
          .update({
            two_factor_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("username", ADMIN_USERNAME)
          .eq("two_factor_secret", secret); // Ensure secret matches

        if (enableError) throw enableError;

        return new Response(
          JSON.stringify({ success: true, message: "2FA enabled successfully" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      case "verify": {
        // Verify 2FA code during login
        if (!code) {
          return new Response(
            JSON.stringify({ error: "Code is required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        if (!adminSettings?.two_factor_secret) {
          return new Response(
            JSON.stringify({ error: "2FA not configured" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const isValid = await verifyTOTP(adminSettings.two_factor_secret, code);
        
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Invalid 2FA code" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "2FA verified successfully" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      case "disable": {
        // Disable 2FA
        const { error: disableError } = await supabase
          .from("admin_settings")
          .update({
            two_factor_enabled: false,
            two_factor_secret: null,
            updated_at: new Date().toISOString(),
          })
          .eq("username", ADMIN_USERNAME);

        if (disableError) throw disableError;

        return new Response(
          JSON.stringify({ success: true, message: "2FA disabled successfully" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }
  } catch (error: any) {
    console.error("Admin 2FA error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

