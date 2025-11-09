// Password reset with rate limiting and Resend email integration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting: Max 3 requests per email per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return true;
  }

  if (limit.count >= 3) {
    return false;
  }

  limit.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, action } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === "request") {
      // Check rate limit
      if (!checkRateLimit(email)) {
        return new Response(
          JSON.stringify({ 
            error: "Too many requests. Please try again later.",
            message: "Rate limit exceeded. Maximum 3 password reset requests per hour."
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find member by email
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("id, email, full_name")
        .eq("email", email.toLowerCase())
        .single();

      // Don't reveal if email exists (security best practice)
      // Always return success message
      if (!memberError && member) {
        // Generate secure reset token
        const resetToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

        // Store reset token in database
        await supabase
          .from("members")
          .update({
            password_reset_token: resetToken,
            password_reset_expires: expiresAt.toISOString(),
          })
          .eq("id", member.id);

        // Send email via Resend
        const resetLink = `https://shadowmesh.org/reset-password?token=${resetToken}`;
        
        const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send_email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            type: "password_reset",
            to: member.email,
            resetToken,
            resetLink,
          }),
        });

        // Log email send attempt (don't fail if email fails)
        if (!emailResponse.ok) {
          console.error("Failed to send reset email:", await emailResponse.text());
        }
      }

      // Always return success (security: don't reveal if email exists)
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "If this email is registered, you will receive password reset instructions."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      const { token, newPassword } = await req.json();

      if (!token || !newPassword) {
        return new Response(
          JSON.stringify({ error: "Token and new password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find member by reset token
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("id, password_reset_token, password_reset_expires")
        .eq("password_reset_token", token)
        .single();

      if (memberError || !member) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired reset token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if token expired
      if (member.password_reset_expires && new Date(member.password_reset_expires) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Reset token has expired. Please request a new one." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate password strength
      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumbers = /\d/.test(newPassword);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return new Response(
          JSON.stringify({ 
            error: "Password must contain uppercase, lowercase, numbers, and special characters"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hash password using PBKDF2 (server-side)
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(newPassword);
      const saltData = encoder.encode(member.id + "shadowmesh_salt");
      
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordData,
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: saltData,
          iterations: 100000,
          hash: "SHA-256"
        },
        keyMaterial,
        256
      );
      
      const hashArray = Array.from(new Uint8Array(derivedBits));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Update password and clear reset token
      const { error: updateError } = await supabase
        .from("members")
        .update({
          password_hash: passwordHash,
          password_reset_token: null,
          password_reset_expires: null,
        })
        .eq("id", member.id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password reset successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Password reset error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

