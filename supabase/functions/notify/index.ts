// Supabase Edge Function: notify (copied for CLI deploy)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { type, data } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM');
    const RESEND_TO = Deno.env.get('RESEND_TO');

    if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_TO) {
      return new Response('Missing email environment variables', { status: 500 });
    }

    const subject = type === 'join'
      ? 'New ShadowMesh Join Application'
      : 'New ShadowMesh Contact Message';

    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:16px;">
        <h2 style="margin:0 0 8px;">${subject}</h2>
        <pre style="white-space:pre-wrap;background:#0b1224;color:#e5f0ff;padding:12px;border-radius:8px;">${
          JSON.stringify(data, null, 2)
        }</pre>
        <p style="color:#9fb0c8;font-size:12px;margin-top:12px;">ShadowMesh notifier</p>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [RESEND_TO],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(`Resend error: ${t}`, { status: 502 });
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400 });
  }
});
