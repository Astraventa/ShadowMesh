import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const token = req.headers.get('x-admin-token');
  if (token !== Deno.env.get('MODERATOR_TOKEN')) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  try {
    const { id, action, reason, reviewer } = await req.json();
    if (!id || !['approve','reject'].includes(action)) return new Response('Invalid payload', { status: 400 });

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return new Response('Missing env', { status: 500, headers: corsHeaders });

    const body = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer || 'admin',
      decision_reason: reason || null,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) return new Response(await res.text(), { status: res.status, headers: corsHeaders });

    const updated = await res.json();
    return new Response(JSON.stringify(updated?.[0] || {}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400, headers: corsHeaders });
  }
});
