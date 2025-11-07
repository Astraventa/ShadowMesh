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
    const { id, action, reason } = await req.json();
    if (!id || !['approve','reject'].includes(action)) return new Response('Invalid payload', { status: 400 });

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return new Response('Missing env', { status: 500, headers: corsHeaders });

    const body = {
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin',
      rejection_reason: action === 'reject' ? reason || null : null,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/hackathon_registrations?id=eq.${id}`, {
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

    // Get registration details for email
    const regRes = await fetch(`${SUPABASE_URL}/rest/v1/hackathon_registrations?id=eq.${id}&select=*,members(full_name,email),events(title)`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const regData = regRes.ok ? await regRes.json() : [];
    const reg = Array.isArray(regData) && regData[0] ? regData[0] : null;

    // Log activity
    if (reg?.member_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/member_activity`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          member_id: reg.member_id,
          activity_type: action === 'approve' ? 'hackathon_approved' : 'hackathon_rejected',
          activity_data: { hackathon_id: reg.hackathon_id, hackathon_title: reg.events?.title, status: body.status },
          related_id: reg.hackathon_id
        })
      });
    }

    // Send email
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM');
    const LOGO_URL = 'https://shadowmesh-six.vercel.app/logo.png';
    if (RESEND_API_KEY && RESEND_FROM && reg?.members?.email) {
      const subject = action === 'approve' 
        ? `Hackathon Registration Approved - ${reg.events?.title || 'Hackathon'}`
        : `Hackathon Registration Update - ${reg.events?.title || 'Hackathon'}`;
      const html = action === 'approve'
        ? `<div style="font-family:Inter,sans-serif;padding:16px;color:#0b1224">
            <img src="${LOGO_URL}" alt="ShadowMesh" style="height:48px;margin-bottom:12px" />
            <h2>Congratulations, ${reg.members.full_name}!</h2>
            <p>Your hackathon registration for <b>${reg.events?.title || 'Hackathon'}</b> has been <b>approved</b>.</p>
            <p>You can now create or join a team in your member portal to participate.</p>
            <p><a href="https://shadowmesh-six.vercel.app/member-portal">Access Member Portal</a></p>
          </div>`
        : `<div style="font-family:Inter,sans-serif;padding:16px;color:#0b1224">
            <img src="${LOGO_URL}" alt="ShadowMesh" style="height:48px;margin-bottom:12px" />
            <h2>Hello ${reg.members.full_name},</h2>
            <p>Your hackathon registration for <b>${reg.events?.title || 'Hackathon'}</b> was not approved.</p>
            ${reason ? `<p><i>Reason:</i> ${reason}</p>` : ''}
            <p>If you have questions, please contact us.</p>
          </div>`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: RESEND_FROM, to: [reg.members.email], subject, html })
      });
    }

    return new Response(JSON.stringify(row || {}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400, headers: corsHeaders });
  }
});

