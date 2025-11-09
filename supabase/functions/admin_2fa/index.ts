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

// Helper to add CORS headers to responses
function corsHeaders(additionalHeaders: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
    ...additionalHeaders,
  };
}

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { 
          status: 405, 
          headers: corsHeaders()
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { status: 500, headers: corsHeaders() }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Safely parse request body
    let body: any = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const { action, code, secret } = body;

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
        const enabled = adminSettings?.two_factor_enabled === true;
        console.log("Admin 2FA check_status:", {
          username: ADMIN_USERNAME,
          enabled,
          hasSecret: !!adminSettings?.two_factor_secret,
          adminSettings: adminSettings ? {
            id: adminSettings.id,
            two_factor_enabled: adminSettings.two_factor_enabled,
            has_secret: !!adminSettings.two_factor_secret
          } : null
        });
        return new Response(
          JSON.stringify({
            enabled: enabled,
          }),
          { headers: corsHeaders() }
        );
      }

      case "setup": {
        // Generate new secret and return QR code URI
        const newSecret = generateSecret();
        const email = "admin@shadowmesh.com";
        const issuer = "ShadowMesh Admin";
        const totpUri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

        // Upsert secret but don't enable yet (wait for verification)
        // This will create the record if it doesn't exist, or update if it does
        const { data: upsertedData, error: upsertError } = await supabase
          .from("admin_settings")
          .upsert({
            username: ADMIN_USERNAME,
            two_factor_secret: newSecret,
            two_factor_enabled: false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "username"
          })
          .select()
          .single();

        if (upsertError) {
          console.error("Error upserting admin settings:", upsertError);
          throw upsertError;
        }

        console.log("2FA setup - secret stored:", {
          username: ADMIN_USERNAME,
          hasSecret: !!upsertedData?.two_factor_secret,
          enabled: upsertedData?.two_factor_enabled
        });

        return new Response(
          JSON.stringify({
            secret: newSecret,
            qrCode: totpUri,
          }),
          { headers: corsHeaders() }
        );
      }

      case "enable": {
        // Verify code and enable 2FA
        if (!code || !secret) {
          return new Response(
            JSON.stringify({ error: "Code and secret are required" }),
            { status: 400, headers: corsHeaders() }
          );
        }

        // Verify the code matches the secret
        const isValid = await verifyTOTP(secret, code);
        
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Invalid code. Please enter the current code from your authenticator app." }),
            { status: 400, headers: corsHeaders() }
          );
        }

        // Verify secret exists in database before enabling
        if (!adminSettings?.two_factor_secret || adminSettings.two_factor_secret !== secret) {
          console.error("Secret mismatch:", {
            dbSecret: adminSettings?.two_factor_secret ? "exists" : "missing",
            providedSecret: secret ? "exists" : "missing",
            match: adminSettings?.two_factor_secret === secret
          });
          return new Response(
            JSON.stringify({ error: "Secret mismatch. Please restart 2FA setup." }),
            { status: 400, headers: corsHeaders() }
          );
        }

        // Enable 2FA
        const { data: updatedData, error: enableError } = await supabase
          .from("admin_settings")
          .update({
            two_factor_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq("username", ADMIN_USERNAME)
          .eq("two_factor_secret", secret) // Ensure secret matches
          .select()
          .single();

        if (enableError) {
          console.error("Error enabling 2FA:", enableError);
          throw enableError;
        }

        if (!updatedData) {
          console.error("No data returned after enabling 2FA");
          throw new Error("Failed to update 2FA status");
        }

        console.log("2FA enabled successfully:", {
          username: ADMIN_USERNAME,
          enabled: updatedData.two_factor_enabled,
          hasSecret: !!updatedData.two_factor_secret,
          recordId: updatedData.id
        });

        return new Response(
          JSON.stringify({ success: true, message: "2FA enabled successfully" }),
          { headers: corsHeaders() }
        );
      }

      case "verify": {
        // Verify 2FA code during login
        if (!code) {
          return new Response(
            JSON.stringify({ error: "Code is required" }),
            { status: 400, headers: corsHeaders() }
          );
        }

        if (!adminSettings?.two_factor_secret) {
          return new Response(
            JSON.stringify({ error: "2FA not configured" }),
            { status: 400, headers: corsHeaders() }
          );
        }

        const isValid = await verifyTOTP(adminSettings.two_factor_secret, code);
        
        if (!isValid) {
          return new Response(
            JSON.stringify({ error: "Invalid 2FA code" }),
            { status: 401, headers: corsHeaders() }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "2FA verified successfully" }),
          { headers: corsHeaders() }
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
          { headers: corsHeaders() }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: corsHeaders() }
        );
    }
  } catch (error: any) {
    console.error("Admin 2FA error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders() }
    );
  }
});

