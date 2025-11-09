# Email Configuration Guide - Welcome Emails

## Why Welcome Emails Might Not Be Sending

The welcome email functionality requires **RESEND_API_KEY** to be configured in Supabase Edge Functions environment variables. If this is not set up, emails will not be sent.

## How to Configure Email Sending

### Step 1: Get Resend API Key
1. Go to [Resend.com](https://resend.com) and sign up/login
2. Navigate to API Keys section
3. Create a new API key
4. Copy the API key (starts with `re_...`)

### Step 2: Configure in Supabase
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Settings** → **Environment Variables**
3. Add the following environment variables:

```
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
BASE_URL=https://your-domain.com
```

**Important Notes:**
- `RESEND_FROM_EMAIL`: Must be a verified domain in Resend
- `BASE_URL`: Your production domain (e.g., `https://shadowmesh.org`)
- If `BASE_URL` is not set, it will try to use `SUPABASE_URL` or default to `https://shadowmesh.org`

### Step 3: Verify Configuration
After approving a user, check the Supabase Edge Function logs:
- Go to **Edge Functions** → **moderate** → **Logs**
- Look for: "Welcome email sent successfully to: [email]"
- If you see "RESEND_API_KEY not configured", the API key is missing

## New Tracking Features

### Portal Access Tracking
- **`portal_accessed`**: Boolean - Whether member has accessed the portal
- **`first_portal_access_at`**: Timestamp - When member first accessed the portal
- **`joined_from_email`**: Boolean - Whether member joined via welcome email link

### Admin Dashboard
In the **Members** section, you can now see:
- **Portal Access**: Shows "✓ Accessed" or "Not Yet" with timestamp
- **From Email**: Shows "✓ Email" if member joined via welcome email link

## Troubleshooting

### Email Not Sending
1. Check if `RESEND_API_KEY` is configured in Supabase
2. Check Edge Function logs for errors
3. Verify `RESEND_FROM_EMAIL` is a verified domain in Resend
4. Check if `BASE_URL` is correct (should be your production domain)

### Member Not Receiving Email
1. Check spam folder
2. Verify email address is correct
3. Check Edge Function logs for delivery status
4. Ensure `welcome_email_sent` is `false` in `join_applications` table (for first-time approval)

## Testing

To test email sending:
1. Create a test application
2. Approve it from admin dashboard
3. Check Edge Function logs
4. Check the member's email inbox (and spam folder)

