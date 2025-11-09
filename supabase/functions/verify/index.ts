// Supabase Edge Function: verify
// Returns application status by verification_token or secret_code
// Env required:
//   SM_SUPABASE_URL
//   SM_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Rate limiting: Max 20 requests per IP per minute
const verifyRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkVerifyRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / 60000)}`;
  const limit = verifyRateLimitStore.get(key);

  if (!limit || now > limit.resetAt) {
    verifyRateLimitStore.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= 20) {
    return false;
  }

  limit.count++;
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  if (!checkVerifyRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { verification_token, code } = body;
    
    // Support both verification_token and code (secret_code)
    const lookupValue = code || verification_token;
    if (!lookupValue) {
      return new Response(JSON.stringify({ error: 'verification_token or code required' }), { 
        status: 400, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      });
    }

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing service env' }), { 
        status: 500, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      });
    }

    // Try secret_code first (if it's a code), then verification_token
    let queryParam = '';
    if (code && !code.includes('-')) {
      // Looks like a secret_code (e.g., SM400A3E)
      queryParam = `secret_code=eq.${encodeURIComponent(lookupValue.toUpperCase())}`;
    } else {
      // Looks like a verification_token (UUID)
      queryParam = `verification_token=eq.${encodeURIComponent(lookupValue)}`;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?${queryParam}&select=status,reviewed_at,decision_reason,secret_code,verification_token,email,full_name`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: await res.text() }), { 
        status: 502, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
      });
    }
    
    const rows = await res.json();
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) {
      return new Response('not_found', { 
        status: 404, 
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' } 
      });
    }

    return new Response(JSON.stringify(row), { 
      status: 200, 
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { 
      status: 400, 
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
    });
  }
});
