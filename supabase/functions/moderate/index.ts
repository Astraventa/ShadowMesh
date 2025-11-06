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
    const row = updated?.[0];

    // Fetch application to get email/name
    const appRes = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${id}&select=full_name,email`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const appRows = appRes.ok ? await appRes.json() : [];
    const app = Array.isArray(appRows) && appRows[0] ? appRows[0] : null;

    // On approve: insert member if not exists
    if (action === 'approve' && app?.email) {
      await fetch(`${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(app.email)}`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      await fetch(`${SUPABASE_URL}/rest/v1/members`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ full_name: app.full_name, email: app.email, source_application: id }])
      });
    }

    // Emails via Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM');
    const COMMUNITY_WHATSAPP_LINK = Deno.env.get('COMMUNITY_WHATSAPP_LINK');
    const LOGO_URL = 'https://shadowmesh-six.vercel.app/logo.png';
    if (RESEND_API_KEY && RESEND_FROM && app?.email) {
      const subject = action === 'approve' ? 'Welcome to ShadowMesh!' : 'ShadowMesh Application Update';
      const html = action === 'approve'
        ? `<div style="font-family:Inter,sans-serif;padding:16px;color:#0b1224">
            <img src="${LOGO_URL}" alt="ShadowMesh" style="height:48px;margin-bottom:12px" />
            <h2>Congratulations, ${app.full_name}!</h2>
            <p>Your application has been <b>approved</b>. Welcome to ShadowMesh.</p>
            ${COMMUNITY_WHATSAPP_LINK ? `<p>Join our community: <a href="${COMMUNITY_WHATSAPP_LINK}">${COMMUNITY_WHATSAPP_LINK}</a></p>` : ''}
          </div>`
        : `<div style="font-family:Inter,sans-serif;padding:16px;color:#0b1224">
            <img src="${LOGO_URL}" alt="ShadowMesh" style="height:48px;margin-bottom:12px" />
            <h2>Hello ${app.full_name},</h2>
            <p>Thanks for applying. After review, we’re not able to proceed at this time.</p>
            ${reason ? `<p><i>Reason:</i> ${reason}</p>` : ''}
            <p>You’re welcome to re-apply in the future.</p>
          </div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: RESEND_FROM, to: [app.email], subject, html })
      });
    }

    return new Response(JSON.stringify(row || {}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400, headers: corsHeaders });
  }
});
