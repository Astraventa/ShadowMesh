import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  return realIP ?? "unknown";
}

async function verifyPassword(password: string, hash: string, email: string): Promise<boolean> {
  // Hash the provided password using the same method as when it was created
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(email.trim().toLowerCase() + "shadowmesh_admin_salt");
  
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
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === hash;
}

async function checkRateLimit(email: string, ip: string): Promise<{ allowed: boolean; message?: string }> {
  // Check if account is locked
  const lockRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(email)}&select=locked_until,login_attempts`,
    {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (lockRes.ok) {
    const data = await lockRes.json();
    if (Array.isArray(data) && data.length > 0) {
      const admin = data[0];
      if (admin.locked_until) {
        const lockedUntil = new Date(admin.locked_until);
        if (lockedUntil > new Date()) {
          const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
          return {
            allowed: false,
            message: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
          };
        }
      }
    }
  }

  return { allowed: true };
}

async function incrementLoginAttempts(email: string, ip: string, success: boolean): Promise<void> {
  if (success) {
    // Reset attempts and update last login on success
    await fetch(
      `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
          last_login_ip: ip,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    return;
  }

  // On failure, fetch current attempts first
  const fetchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(email)}&select=login_attempts`,
    {
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!fetchRes.ok) {
    console.error("Failed to fetch current attempts");
    return;
  }

  const fetchData = await fetchRes.json();
  if (!Array.isArray(fetchData) || fetchData.length === 0) {
    return;
  }

  const currentAttempts = (fetchData[0].login_attempts ?? 0) + 1;

  if (currentAttempts >= MAX_LOGIN_ATTEMPTS) {
    // Lock the account
    const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await fetch(
      `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login_attempts: currentAttempts,
          locked_until: lockUntil.toISOString(),
          updated_at: new Date().toISOString(),
        }),
      }
    );
  } else {
    // Just increment attempts
    await fetch(
      `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login_attempts: currentAttempts,
          updated_at: new Date().toISOString(),
        }),
      }
    );
  }
}

serve(async (req) => {
  // Handle OPTIONS request for CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Wrap everything in try-catch to ensure CORS headers are always returned
  try {
    if (req.method !== "POST") {
      return error("Method not allowed", 405);
    }

    // Validate environment variables
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("Missing SUPABASE_URL or SERVICE_KEY");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return error("Invalid request body", 400);
    }

    const { email, password } = body;
    if (!email || !password) {
      return error("Email and password required", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ip = getClientIP(req);

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(normalizedEmail, ip);
    if (!rateLimitCheck.allowed) {
      return error(rateLimitCheck.message ?? "Too many login attempts", 429);
    }

    // Fetch admin by email
    const adminRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_settings?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,email,password_hash,two_factor_enabled,two_factor_secret,login_attempts,locked_until`,
      {
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!adminRes.ok) {
      console.error("Failed to fetch admin:", adminRes.status, await adminRes.text());
      return error("Authentication failed", 401);
    }

    const adminData = await adminRes.json();
    if (!Array.isArray(adminData) || adminData.length === 0) {
      // Admin account doesn't exist - don't increment attempts for non-existent accounts
      return error("Admin account not found. Please run admin_setup function first.", 401);
    }

    const admin = adminData[0];

    // Verify password
    if (!admin.password_hash) {
      console.error("Admin has no password hash");
      await incrementLoginAttempts(normalizedEmail, ip, false);
      return error("Invalid email or password", 401);
    }

    let passwordValid = false;
    try {
      passwordValid = await verifyPassword(password, admin.password_hash, normalizedEmail);
    } catch (e) {
      console.error("Password comparison error:", e);
      return error("Authentication error", 500);
    }

    if (!passwordValid) {
      await incrementLoginAttempts(normalizedEmail, ip, false);
      return error("Invalid email or password", 401);
    }

    // Password correct - reset attempts and update last login
    await incrementLoginAttempts(normalizedEmail, ip, true);

    // Return success with 2FA status
    return ok({
      success: true,
      email: admin.email,
      requires2FA: admin.two_factor_enabled === true,
      has2FASecret: !!admin.two_factor_secret,
    });
  } catch (error: any) {
    // Ensure CORS headers are always returned, even on unexpected errors
    console.error("Unexpected error in admin_login:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

