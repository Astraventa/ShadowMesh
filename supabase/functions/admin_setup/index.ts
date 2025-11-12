import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Default admin credentials (CHANGE THESE AFTER FIRST LOGIN!)
const DEFAULT_ADMIN_EMAIL = "zeeshanjay7@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "ShadowMesh2024!Secure#Admin";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return ok({ error: message }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return error("Method not allowed", 405);
  }

  // Check if admin already exists
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(DEFAULT_ADMIN_EMAIL)}&select=id`,
    {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (checkRes.ok) {
    const data = await checkRes.json();
    if (Array.isArray(data) && data.length > 0) {
      return ok({
        success: false,
        message: "Admin account already exists. Use password reset if needed.",
      });
    }
  }

  // Hash password
  const passwordHash = await hash(DEFAULT_ADMIN_PASSWORD);

  // Create admin account
  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify({
      email: DEFAULT_ADMIN_EMAIL,
      username: "zeeshanjay", // Keep for backward compatibility
      password_hash: passwordHash,
      two_factor_enabled: false,
      login_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    console.error("Failed to create admin:", createRes.status, errorText);
    return error("Failed to create admin account", 500);
  }

  return ok({
    success: true,
    message: "Default admin account created successfully.",
    email: DEFAULT_ADMIN_EMAIL,
    password: DEFAULT_ADMIN_PASSWORD,
    warning: "⚠️ IMPORTANT: Change this password immediately after first login!",
  });
});

