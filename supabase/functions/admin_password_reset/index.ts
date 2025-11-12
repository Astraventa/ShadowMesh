import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return ok({ error: message }, status);
}

function generateOTP(): string {
  // Generate 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return error("Method not allowed", 405);
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid request body", 400);
  }

  const { email } = body;
  if (!email) {
    return error("Email required", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if admin exists
  const adminRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email`,
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
  // Don't reveal if email exists - security best practice
  if (!Array.isArray(adminData) || adminData.length === 0) {
    // Still return success to prevent email enumeration
    return ok({
      success: true,
      message: "If an account exists with this email, a password reset code has been sent.",
    });
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store OTP in database
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
        password_reset_otp: otp,
        password_reset_otp_expires: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!updateRes.ok) {
    console.error("Failed to store OTP:", updateRes.status);
    return error("Unable to process request", 500);
  }

  // Send OTP via email (using notify function)
  try {
    const notifyRes = await fetch(`${SUPABASE_URL}/functions/v1/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        type: "admin_password_reset",
        data: {
          email: normalizedEmail,
          otp: otp,
        },
      }),
    });

    if (!notifyRes.ok) {
      console.warn("Failed to send email, but OTP was generated");
    }
  } catch (err) {
    console.error("Error sending email:", err);
    // Don't fail the request - OTP is stored, user can request it again if needed
  }

  return ok({
    success: true,
    message: "If an account exists with this email, a password reset code has been sent.",
  });
});

