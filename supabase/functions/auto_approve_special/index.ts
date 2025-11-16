import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { application_id, email } = await req.json();
    if (!application_id || !email) return new Response('Missing application_id or email', { status: 400, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get('SM_SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SM_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return new Response('Missing env', { status: 500, headers: corsHeaders });

    // Verify email is in special_welcome_emails list
    const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_settings?select=special_welcome_emails&limit=1`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      }
    });

    if (!settingsRes.ok) {
      return new Response('Failed to check special emails', { status: 500, headers: corsHeaders });
    }

    const settings = await settingsRes.json();
    const specialEmails = settings?.[0]?.special_welcome_emails || [];
    const normalizedEmail = email.toLowerCase().trim();

    if (!specialEmails.includes(normalizedEmail)) {
      return new Response('Email not in special welcome list', { status: 403, headers: corsHeaders });
    }

    // Get application details
    const appRes = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${application_id}&select=*`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      }
    });

    if (!appRes.ok) return new Response('Application not found', { status: 404, headers: corsHeaders });
    const apps = await appRes.json();
    const app = apps?.[0];
    if (!app) return new Response('Application not found', { status: 404, headers: corsHeaders });

    // Verify email matches
    if (app.email.toLowerCase().trim() !== normalizedEmail) {
      return new Response('Email mismatch', { status: 400, headers: corsHeaders });
    }

    // Check if already approved
    if (app.status === 'approved') {
      return new Response(JSON.stringify({ success: true, message: 'Already approved' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Auto-approve the application
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${application_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: 'system',
        decision_reason: 'Auto-approved: Special welcome email recipient'
      })
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      return new Response(`Failed to approve: ${errorText}`, { status: 500, headers: corsHeaders });
    }

    // Create member record (same logic as moderate function)
    const memberRes = await fetch(`${SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        full_name: app.full_name,
        email: app.email,
        source_application: app.id,
        area_of_interest: app.area_of_interest,
        motivation: app.motivation,
        affiliation: app.affiliation,
        university_name: app.university_name,
        department: app.department,
        roll_number: app.roll_number,
        organization: app.organization,
        role_title: app.role_title,
        phone_e164: app.phone_e164,
        raw_phone: app.raw_phone,
        status: 'active',
        // Grant star badge for special users
        star_badge: true,
        badge_granted_at: new Date().toISOString(),
        badge_granted_by: 'system',
        joined_from_email: true
      })
    });

    if (!memberRes.ok) {
      const errorText = await memberRes.text();
      console.error('Failed to create member:', errorText);
      // Don't fail if member already exists
    }

    // Send welcome email
    const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'ShadowMesh <noreply@shadowmesh.com>';
    const setupToken = crypto.randomUUID();
    const setupLink = `${SUPABASE_URL.replace('/rest/v1', '')}/member-portal?setup=${setupToken}&email=${encodeURIComponent(app.email)}`;

    // Store setup token in member record
    const memberData = await memberRes.json();
    if (memberData?.[0]?.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${memberData[0].id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password_setup_token: setupToken, password_setup_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
      });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ShadowMesh</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">✨ You Are Special! ✨</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Welcome to ShadowMesh</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-top: 0;">Hi ${app.full_name},</p>
            <p style="font-size: 16px;">Your request has been <strong>automatically approved</strong> because you're on our special welcome list! That's why you received this instant approval.</p>
            <p style="font-size: 16px;">You've also automatically received a <strong>Star Badge ⭐</strong> as a special member of our community.</p>
            <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong>Next Steps:</strong></p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px; color: #6b7280;">
                <li>Click the button below to set up your password</li>
                <li>Log in to the member portal</li>
                <li>Start exploring events, hackathons, and networking opportunities</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Set Up Your Password</a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
            <p style="color: #6b7280; font-size: 14px;">After setting your password, you can log in to the member portal using your email and password.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const emailResponse = await fetch(`${SUPABASE_URL}/functions/v1/send_email`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${SERVICE_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          type: 'welcome',
          to: app.email,
          subject: '✨ You Are Special! Welcome to ShadowMesh',
          html: emailHtml,
          from: RESEND_FROM
        })
      });
      
      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Failed to send welcome email:', errorText);
      } else {
        // Mark welcome email as sent
        await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${application_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ welcome_email_sent: true })
        });
      }
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Application auto-approved and welcome email sent',
      member_created: !!memberData?.[0]?.id
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('Auto-approve error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});

