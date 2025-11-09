# Quick Fix: Add BASE_URL Secret

## Problem
Welcome emails are not sending because `BASE_URL` is missing from Edge Functions secrets.

## Solution

### Add BASE_URL Secret

1. Go to **Supabase Dashboard** → **Edge Functions** → **Settings** → **Secrets**
2. Click **"Add new secret"** or **"New secret"**
3. Add:
   - **Key:** `BASE_URL`
   - **Value:** Your production domain URL
     - If using Vercel: `https://your-app.vercel.app`
     - If using custom domain: `https://yourdomain.com`
     - Example: `https://shadowmesh-six.vercel.app`

4. Click **Save**

### Verify All Required Secrets

Make sure you have these secrets configured:

✅ **RESEND_API_KEY** - Your Resend API key (starts with `re_...`)
✅ **RESEND_FROM_EMAIL** - Your verified email (e.g., `noreply@yourdomain.com`)
✅ **BASE_URL** - Your production domain URL ⚠️ **MISSING - ADD THIS!**

### Test

After adding `BASE_URL`:
1. Approve a new user from admin dashboard
2. Check Edge Function logs for: "Welcome email sent successfully"
3. Check the user's email inbox (and spam folder)

## Why BASE_URL is Important

`BASE_URL` is used to generate the password setup link in welcome emails:
- Format: `${BASE_URL}/member-portal?setup=${token}`
- Example: `https://shadowmesh-six.vercel.app/member-portal?setup=abc123...`

Without `BASE_URL`, the link might be incorrect and users won't be able to set up their password.

