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

    // Fetch application to get all fields
    const appRes = await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${id}&select=full_name,email,verification_token,area_of_interest,motivation,affiliation,university_name,department,roll_number,organization,role_title,phone_e164,welcome_email_sent`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const appRows = appRes.ok ? await appRes.json() : [];
    const app = Array.isArray(appRows) && appRows[0] ? appRows[0] : null;

    let newMemberId = null;

    // On approve: insert member if not exists
    if (action === 'approve' && app?.email) {
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/members?email=eq.${encodeURIComponent(app.email)}&select=id`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
      const existing = checkRes.ok ? await checkRes.json() : [];
      if (!Array.isArray(existing) || existing.length === 0) {
        // Create member record
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
            source_application: id, 
            area_of_interest: app.area_of_interest || null,
            motivation: app.motivation || null,
            affiliation: app.affiliation ? String(app.affiliation) : null,
            university_name: app.university_name || null,
            department: app.department || null,
            roll_number: app.roll_number || null,
            organization: app.organization || null,
            role_title: app.role_title || null,
            phone_e164: app.phone_e164 || null,
            welcome_email_sent: false,
            portal_accessed: false,
            joined_from_email: false
          })
        });
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          newMemberId = Array.isArray(memberData) ? memberData[0]?.id : memberData?.id;
        }
      } else {
        newMemberId = existing[0]?.id;
      }
    }

    // Send welcome email via send_email edge function (only on approve, and only once)
    if (action === 'approve' && app?.email && !app.welcome_email_sent && newMemberId) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('RESEND_FROM') || 'noreply@shadowmesh.org';
      const BASE_URL = Deno.env.get('BASE_URL') || 'https://shadowmesh.org';
      
      if (RESEND_API_KEY) {
        // Generate password setup token
        const setupToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
        
        // Store setup token in member record (using password_reset_token field temporarily)
        await fetch(`${SUPABASE_URL}/rest/v1/members?id=eq.${newMemberId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password_reset_token: setupToken,
            password_reset_expires: expiresAt.toISOString()
          })
        });

        // Mark welcome email as sent
        await fetch(`${SUPABASE_URL}/rest/v1/join_applications?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ welcome_email_sent: true })
        });

        // Send welcome email with password setup link
        const setupLink = `${BASE_URL}/member-portal?setup=${setupToken}`;
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ShadowMesh</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">ShadowMesh</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
              <h2 style="color: #1f2937; margin-top: 0;">Welcome to ShadowMesh, ${app.full_name}!</h2>
              <p>Congratulations! Your application has been <strong>approved</strong>. You're now a member of our elite cybersecurity community.</p>
              <p>To get started, please set up your password by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${setupLink}" 
                   style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Set Up Password
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${setupLink}</p>
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
              subject: 'Welcome to ShadowMesh - Set Up Your Password',
              html: emailHtml
            })
          });
          
          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error('Failed to send welcome email:', errorText);
            // Log error but don't fail approval
          } else {
            console.log('Welcome email sent successfully to:', app.email);
          }
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
          // Don't fail the approval if email fails
        }
      }
    }

    // Send rejection email
    if (action === 'reject' && app?.email) {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('RESEND_FROM') || 'noreply@shadowmesh.org';
      
      if (RESEND_API_KEY) {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ShadowMesh Application Update</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">ShadowMesh</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
              <h2 style="color: #1f2937; margin-top: 0;">Hello ${app.full_name},</h2>
              <p>Thank you for your interest in ShadowMesh. After careful review, we're not able to proceed with your application at this time.</p>
              ${reason ? `<p style="background: #fee2e2; padding: 15px; border-radius: 5px; border-left: 4px solid #ef4444;"><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>You're welcome to re-apply in the future when circumstances change.</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">Best regards,<br>The ShadowMesh Team</p>
            </div>
          </body>
          </html>
        `;

        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send_email`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${SERVICE_KEY}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
              type: 'rejection',
              to: app.email,
              subject: 'ShadowMesh Application Update',
              html: emailHtml
            })
          });
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      }
    }

    return new Response(JSON.stringify(row || {}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 400, headers: corsHeaders });
  }
});
