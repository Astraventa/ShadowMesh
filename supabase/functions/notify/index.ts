// Supabase Edge Function: notify (copied for CLI deploy)
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

  try {
    const { type, data } = await req.json();
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM');
    const RESEND_TO = Deno.env.get('RESEND_TO');

    if (!RESEND_API_KEY || !RESEND_FROM || !RESEND_TO) {
      return new Response('Missing email environment variables', { status: 500, headers: corsHeaders });
    }

    let subject: string;
    let html: string;
    let toEmail: string | string[];

    if (type === 'admin_password_reset') {
      // Send OTP directly to admin email
      const adminEmail = data?.email;
      const otp = data?.otp;
      
      if (!adminEmail || !otp) {
        return new Response('Missing email or OTP', { status: 400, headers: corsHeaders });
      }

      subject = 'ShadowMesh Admin Password Reset Code';
      toEmail = adminEmail;
      html = `
        <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;max-width:600px;margin:0 auto;">
          <h2 style="margin:0 0 16px;color:#0b1224;">Password Reset Request</h2>
          <p style="color:#4a5568;line-height:1.6;margin:0 0 24px;">
            You requested a password reset for your ShadowMesh admin account. Use the code below to reset your password:
          </p>
          <div style="background:#0b1224;color:#e5f0ff;padding:20px;border-radius:8px;text-align:center;margin:24px 0;">
            <div style="font-size:32px;font-weight:bold;letter-spacing:4px;font-family:monospace;">${otp}</div>
          </div>
          <p style="color:#718096;font-size:14px;margin:24px 0 0;">
            This code will expire in 10 minutes. If you didn't request this, please ignore this email.
          </p>
          <p style="color:#9fb0c8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
            ShadowMesh Admin Portal
          </p>
        </div>`;
    } else {
      // Regular notifications to admin
      subject = type === 'join'
        ? 'New ShadowMesh Join Application'
        : 'New ShadowMesh Contact Message';
      toEmail = RESEND_TO;
      html = `
        <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:16px;">
          <h2 style="margin:0 0 8px;">${subject}</h2>
          <pre style="white-space:pre-wrap;background:#0b1224;color:#e5f0ff;padding:12px;border-radius:8px;">${
            JSON.stringify(data, null, 2)
          }</pre>
          <p style="color:#9fb0c8;font-size:12px;margin-top:12px;">ShadowMesh notifier</p>
        </div>`;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: Array.isArray(toEmail) ? toEmail : [toEmail],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(`Resend error: ${t}`, { status: 502, headers: corsHeaders });
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400, headers: corsHeaders });
  }
});
