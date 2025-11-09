// 2FA (Two-Factor Authentication) with TOTP and OTP via Resend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TOTP (Time-based One-Time Password) implementation
// Based on RFC 6238: https://tools.ietf.org/html/rfc6238

function base32Decode(base32: string): Uint8Array {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  base32 = base32.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((base32.length * 5) / 8));
  
  for (let i = 0; i < base32.length; i++) {
    value = (value << 5) | base32chars.indexOf(base32[i]);
    bits += 5;
    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return output;
}

async function generateTOTP(secret: string, timeStep: number = 30): Promise<string> {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const counterBytes = new Uint8Array(8);
  
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter >>>= 8;
  }
  
  // HMAC-SHA1
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
  const sigArray = new Uint8Array(signature);
  
  // Dynamic truncation
  const offset = sigArray[19] & 0x0f;
  const code = ((sigArray[offset] & 0x7f) << 24) |
               ((sigArray[offset + 1] & 0xff) << 16) |
               ((sigArray[offset + 2] & 0xff) << 8) |
               (sigArray[offset + 3] & 0xff);
  
  return (code % 1000000).toString().padStart(6, "0");
}

async function verifyTOTP(secret: string, code: string, window: number = 1): Promise<boolean> {
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting: Max 5 OTP requests per email per hour
const otpRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkOTPRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const limit = otpRateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    otpRateLimitMap.set(key, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return true;
  }

  if (limit.count >= 5) {
    return false;
  }

  limit.count++;
  return true;
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, memberId, email, otp, secret } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === "setup") {
      // Generate TOTP secret (base32 encoded, 32 characters)
      // Generate 20 random bytes and encode as base32
      const randomBytes = new Uint8Array(20);
      crypto.getRandomValues(randomBytes);
      
      const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      let secret = "";
      let bits = 0;
      let value = 0;
      
      for (let i = 0; i < randomBytes.length; i++) {
        value = (value << 8) | randomBytes[i];
        bits += 8;
        while (bits >= 5) {
          secret += base32chars[(value >>> (bits - 5)) & 31];
          bits -= 5;
        }
      }
      if (bits > 0) {
        secret += base32chars[(value << (5 - bits)) & 31];
      }
      
      // Ensure secret is 32 characters (pad if needed)
      secret = secret.padEnd(32, "A").substring(0, 32);
      
      // Store secret in database (encrypted in production)
      const { error } = await supabase
        .from("members")
        .update({ two_factor_secret: secret, two_factor_enabled: false })
        .eq("id", memberId);

      if (error) throw error;

      // Generate QR code data URL (TOTP URI format)
      const totpUri = `otpauth://totp/ShadowMesh:${encodeURIComponent(email)}?secret=${secret}&issuer=ShadowMesh&algorithm=SHA1&digits=6&period=30`;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          secret,
          qrCodeUri: totpUri,
          message: "Scan QR code with authenticator app (Google Authenticator, Authy, etc.)"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "enable") {
      // Verify TOTP code and enable 2FA
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return new Response(
          JSON.stringify({ error: "Invalid code. Please enter a valid 6-digit code from your authenticator app." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: member } = await supabase
        .from("members")
        .select("two_factor_secret")
        .eq("id", memberId)
        .single();

      if (!member?.two_factor_secret) {
        return new Response(
          JSON.stringify({ error: "2FA not set up. Please set it up first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify TOTP code using proper TOTP verification
      const isValid = await verifyTOTP(member.two_factor_secret, otp.trim());
      
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid code. Please enter the current code from your authenticator app." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Code is valid, enable 2FA
      const { error } = await supabase
        .from("members")
        .update({ two_factor_enabled: true })
        .eq("id", memberId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "2FA enabled successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_otp") {
      // Send OTP via email for backup authentication
      if (!checkOTPRateLimit(email)) {
        return new Response(
          JSON.stringify({ 
            error: "Too many OTP requests. Please try again later.",
            message: "Rate limit exceeded. Maximum 5 OTP requests per hour."
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const generatedOTP = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

      // Store OTP in database
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("email", email.toLowerCase())
        .single();

      if (member) {
        await supabase
          .from("members")
          .update({
            two_factor_otp: generatedOTP,
            two_factor_otp_expires: expiresAt.toISOString(),
          })
          .eq("id", member.id);

        // Send OTP via Resend
        await fetch(`${SUPABASE_URL}/functions/v1/send_email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            type: "otp",
            to: email,
            otp: generatedOTP,
          }),
        });
      }

      // Always return success (security)
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "If this email is registered, you will receive an OTP code."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      // Verify 2FA code (TOTP or OTP)
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return new Response(
          JSON.stringify({ error: "Invalid code. Please enter a valid 6-digit code." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: member } = await supabase
        .from("members")
        .select("two_factor_secret, two_factor_enabled, two_factor_otp, two_factor_otp_expires")
        .eq("id", memberId)
        .single();

      if (!member?.two_factor_enabled) {
        return new Response(
          JSON.stringify({ error: "2FA is not enabled for this account" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify TOTP code using proper TOTP verification
      let isValid = false;

      if (member.two_factor_secret) {
        isValid = await verifyTOTP(member.two_factor_secret, otp.trim());
      }

      // Check OTP as backup (email-based OTP)
      if (!isValid && member.two_factor_otp) {
        if (member.two_factor_otp === otp.trim()) {
          if (member.two_factor_otp_expires && new Date(member.two_factor_otp_expires) > new Date()) {
            isValid = true;
            // Clear OTP after use
            await supabase
              .from("members")
              .update({ two_factor_otp: null, two_factor_otp_expires: null })
              .eq("id", memberId);
          }
        }
      }

      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Invalid verification code. Please enter the current code from your authenticator app." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "2FA verification successful" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disable") {
      const { error } = await supabase
        .from("members")
        .update({ two_factor_enabled: false, two_factor_secret: null })
        .eq("id", memberId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "2FA disabled successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("2FA error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

