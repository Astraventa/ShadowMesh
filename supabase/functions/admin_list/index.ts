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
    const { type, status, search, page = 0, pageSize = 50 } = await req.json();
    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response('Missing service env', { status: 500, headers: corsHeaders });
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    if (type === 'applications') {
      let url = `${SUPABASE_URL}/rest/v1/join_applications?select=*&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (status && status !== 'all') {
        url += `&status=eq.${status}`;
      }
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&or=(full_name.ilike.${s},email.ilike.${s},university_name.ilike.${s},organization.ilike.${s},role_title.ilike.${s})`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (type === 'messages') {
      let url = `${SUPABASE_URL}/rest/v1/contact_messages?select=*&order=created_at.desc&limit=${pageSize}&offset=${from}`;
      if (search && search.trim()) {
        const s = encodeURIComponent(`%${search.trim()}%`);
        url += `&or=(name.ilike.${s},email.ilike.${s},message.ilike.${s})`;
      }

      const res = await fetch(url, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      if (!res.ok) {
        return new Response(`error: ${await res.text()}`, { status: 502, headers: corsHeaders });
      }

      const data = await res.json();
      return new Response(JSON.stringify({ data, hasMore: data.length === pageSize }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response('Invalid type', { status: 400, headers: corsHeaders });
    }
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, {
      status: 400,
      headers: corsHeaders,
    });
  }
});

