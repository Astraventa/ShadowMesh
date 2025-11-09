# Email Setup Guide - Resend Integration

## Why Emails Aren't Sending

The password reset emails are not sending because **Resend API key is not configured** in your Supabase project.

## Quick Fix Steps

### 1. Get Resend API Key

1. Go to https://resend.com
2. Sign up for free account (100 emails/day free)
3. Go to API Keys section
4. Create new API key
5. Copy the key (starts with `re_`)

### 2. Add to Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Edge Functions** → **Secrets**
3. Add new secret:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (e.g., `re_xxxxxxxxxxxxx`)
4. Add another secret:
   - **Name**: `RESEND_FROM_EMAIL`
   - **Value**: Your verified email (e.g., `noreply@shadowmesh.org`)

### 3. Verify Domain (Optional but Recommended)

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `shadowmesh.org`)
3. Add DNS records as instructed
4. Wait for verification
5. Use verified domain in `RESEND_FROM_EMAIL`

### 4. Deploy Edge Function

```bash
cd shadowmesh
supabase functions deploy send_email
```

### 5. Test

1. Try password reset again
2. Check email inbox (and spam folder)
3. Check Supabase Edge Function logs for errors

## Troubleshooting

### Error: "Email service not configured"
- **Cause**: `RESEND_API_KEY` not set in Supabase
- **Fix**: Add the secret as described above

### Error: "Invalid API key"
- **Cause**: Wrong API key or key revoked
- **Fix**: Generate new API key in Resend dashboard

### Error: "Domain not verified"
- **Cause**: Using unverified domain in `RESEND_FROM_EMAIL`
- **Fix**: Use Resend's test domain or verify your domain

### Emails going to spam
- **Cause**: Domain not verified or poor email reputation
- **Fix**: Verify domain, use SPF/DKIM records, warm up domain

## Alternative: Use Supabase Email (If Available)

If Supabase Email service is available in your plan:

1. Use Supabase's built-in email service
2. Modify `send_email` function to use Supabase Email API
3. No external service needed

## Current Status

✅ Code is ready
✅ Error handling improved
❌ **RESEND_API_KEY needs to be configured**
❌ Edge function needs to be deployed

Once configured, emails will work immediately!

