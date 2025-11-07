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
    const { member_id, reason } = await req.json();
    if (!member_id) return new Response('Missing member_id', { status: 400, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return new Response('Missing env', { status: 500, headers: corsHeaders });

    // Get member details before deletion
    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}&select=full_name,email`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const memberData = memberRes.ok ? await memberRes.json() : [];
    const member = Array.isArray(memberData) && memberData[0] ? memberData[0] : null;

    if (!member) return new Response('Member not found', { status: 404, headers: corsHeaders });

    // Delete member (cascade will handle related records)
    const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${member_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
    });

    if (!deleteRes.ok) return new Response(await deleteRes.text(), { status: deleteRes.status, headers: corsHeaders });

    // Send deletion email
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM');
    const LOGO_URL = 'https://shadowmesh-six.vercel.app/logo.png';

    if (RESEND_API_KEY && RESEND_FROM && member.email) {
      const subject = 'ShadowMesh Account Deletion';
      const html = `<div style="font-family:Inter,sans-serif;padding:16px;color:#0b1224">
        <img src="${LOGO_URL}" alt="ShadowMesh" style="height:48px;margin-bottom:12px" />
        <h2>Hello ${member.full_name},</h2>
        <p>Your ShadowMesh member account has been deleted.</p>
        ${reason ? `<p><i>Reason:</i> ${reason}</p>` : ''}
        <p>If you believe this was done in error, please contact us.</p>
        <p>Thank you for being part of ShadowMesh.</p>
      </div>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: RESEND_FROM, to: [member.email], subject, html })
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Member deleted' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400, headers: corsHeaders });
  }
});

