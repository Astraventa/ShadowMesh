import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MIN_PASSWORD_LENGTH = 12;
const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return ok({ error: message }, status);
}

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long.`,
    };
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter." };
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter." };
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number." };
  }

  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character." };
  }

  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return error("Method not allowed", 405);
  }

  let body: { email?: string; otp?: string; newPassword?: string; confirmPassword?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid request body", 400);
  }

  const { email, otp, newPassword, confirmPassword } = body;

  if (!email || !otp) {
    return error("Email and OTP required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Fetch admin and verify OTP
  const adminRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,password_reset_otp,password_reset_otp_expires`,
    {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!adminRes.ok) {
    console.error("Failed to fetch admin:", adminRes.status);
    return error("Unable to process request", 500);
  }

  const adminData = await adminRes.json();
  if (!Array.isArray(adminData) || adminData.length === 0) {
    return error("Invalid email or OTP", 401);
  }

  const admin = adminData[0];

  // Verify OTP
  if (!admin.password_reset_otp || admin.password_reset_otp !== otp) {
    return error("Invalid OTP", 401);
  }

  // Check expiration
  if (!admin.password_reset_otp_expires) {
    return error("OTP has expired", 401);
  }

  const expiresAt = new Date(admin.password_reset_otp_expires);
  if (expiresAt < new Date()) {
    return error("OTP has expired. Please request a new one.", 401);
  }

  // If newPassword is provided, set the new password
  if (newPassword) {
    if (newPassword !== confirmPassword) {
      return error("Passwords do not match", 400);
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return error(passwordValidation.message ?? "Password does not meet requirements", 400);
    }

    // Hash new password
    const passwordHash = await hash(newPassword);

    // Update password and clear OTP
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(normalizedEmail)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password_hash: passwordHash,
          password_reset_otp: null,
          password_reset_otp_expires: null,
          login_attempts: 0, // Reset login attempts
          locked_until: null, // Unlock account
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!updateRes.ok) {
      console.error("Failed to update password:", updateRes.status);
      return error("Unable to update password", 500);
    }

    return ok({
      success: true,
      message: "Password has been reset successfully. You can now login with your new password.",
    });
  }

  // Just verify OTP (for frontend to show password reset form)
  return ok({
    success: true,
    message: "OTP verified. You can now set a new password.",
    verified: true,
  });
});

