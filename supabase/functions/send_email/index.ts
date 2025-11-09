// Edge function to send emails via Resend
// Handles: Password reset, OTP, 2FA codes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@shadowmesh.org";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, to, subject, html, text, otp, resetToken, resetLink } = await req.json();

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: "Email address and type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured in environment variables");
      return new Response(
        JSON.stringify({ 
          error: "Email service not configured",
          message: "Please configure RESEND_API_KEY in Supabase environment variables"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emailSubject = subject;
    let emailHtml = html;
    let emailText = text;

    // Generate email content based on type
    if (type === "password_reset") {
      emailSubject = emailSubject || "ShadowMesh Password Reset";
      emailHtml = emailHtml || `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">ShadowMesh</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0;">Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink || `https://shadowmesh.org/reset-password?token=${resetToken}`}" 
                 style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Or copy this link: ${resetLink || `https://shadowmesh.org/reset-password?token=${resetToken}`}</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
            <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
        </html>
      `;
    } else if (type === "otp" || type === "2fa") {
      emailSubject = emailSubject || "ShadowMesh Verification Code";
      emailHtml = emailHtml || `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0ea5e9, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">ShadowMesh</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <h2 style="color: #1f2937; margin-top: 0;">${type === "2fa" ? "Two-Factor Authentication" : "Verification Code"}</h2>
            <p>Your verification code is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: white; border: 2px solid #0ea5e9; padding: 20px; border-radius: 10px; display: inline-block;">
                <h1 style="color: #0ea5e9; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: monospace;">${otp}</h1>
              </div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #6b7280; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        </body>
        </html>
      `;
    }

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: to,
        subject: emailSubject,
        html: emailHtml,
        text: emailText || emailHtml.replace(/<[^>]*>/g, ""),
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error("Resend API error:", error);
      
      // Provide helpful error message
      let errorMessage = "Failed to send email";
      try {
        const errorJson = JSON.parse(error);
        if (errorJson.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // Keep default message
      }
      
      return new Response(
        JSON.stringify({ 
          error: "Email service not configured",
          message: "Please configure RESEND_API_KEY in Supabase environment variables. " + errorMessage,
          details: error 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await resendResponse.json();

    return new Response(
      JSON.stringify({ success: true, messageId: result.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

