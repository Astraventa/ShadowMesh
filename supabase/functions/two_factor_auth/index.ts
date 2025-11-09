// 2FA (Two-Factor Authentication) with TOTP and OTP via Resend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      // Generate TOTP secret for user
      const secret = crypto.randomUUID().replace(/-/g, "").substring(0, 32);
      
      // Store secret in database (encrypted in production)
      const { error } = await supabase
        .from("members")
        .update({ two_factor_secret: secret, two_factor_enabled: false })
        .eq("id", memberId);

      if (error) throw error;

      // Generate QR code data URL (TOTP URI format)
      const totpUri = `otpauth://totp/ShadowMesh:${email}?secret=${secret}&issuer=ShadowMesh`;
      
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

      // In production, verify TOTP code here using a TOTP library
      // For now, we'll accept any 6-digit code as verification
      // TODO: Implement proper TOTP verification

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

      // Verify TOTP code (in production, use proper TOTP library)
      // For now, we'll also check OTP as backup
      let isValid = false;

      if (member.two_factor_secret) {
        // TODO: Implement TOTP verification
        // For now, accept any 6-digit code
        isValid = /^\d{6}$/.test(otp);
      }

      // Check OTP as backup
      if (!isValid && member.two_factor_otp) {
        if (member.two_factor_otp === otp) {
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
          JSON.stringify({ error: "Invalid verification code" }),
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

