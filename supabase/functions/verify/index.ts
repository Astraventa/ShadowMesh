import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  try {
    const { verification_token } = await req.json();
    if (!verification_token) return new Response('verification_token required', { status: 400 });

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return new Response('Missing service env', { status: 500 });

    const res = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?verification_token=eq.${verification_token}&select=status,reviewed_at,decision_reason`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!res.ok) {
      return new Response(`error: ${await res.text()}`, { status: 502 });
    }
    const rows = await res.json();
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!row) return new Response('not_found', { status: 404 });

    return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400 });
  }
});
