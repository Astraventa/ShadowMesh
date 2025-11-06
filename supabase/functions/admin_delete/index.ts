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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const token = req.headers.get('x-admin-token');
  if (token !== Deno.env.get('MODERATOR_TOKEN')) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const { type, id } = await req.json();
    if (!type || !id) {
      return new Response('type and id required', { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response('Missing service env', { status: 500, headers: corsHeaders });
    }

    const table = type === 'application' ? 'join_applications' : type === 'message' ? 'contact_messages' : null;
    if (!table) {
      return new Response('Invalid type', { status: 400, headers: corsHeaders });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
    });

    if (!res.ok) {
      return new Response(`error: ${await res.text()}`, { status: res.status, headers: corsHeaders });
    }

    const deleted = await res.json();
    return new Response(JSON.stringify({ success: true, deleted }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 400,
      headers: corsHeaders,
    });
  }
});

