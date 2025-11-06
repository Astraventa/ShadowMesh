# ShadowMesh Supabase Setup Guide

## Quick Setup Checklist

### 1. Database Schema (Run Once)
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of `supabase_schema.sql`
3. Paste and run in SQL Editor
4. ✅ Script is now fully idempotent — safe to re-run anytime

### 2. Install Supabase CLI (One-time)
```bash
npm install -g supabase
```

### 3. Login to Supabase CLI
```bash
supabase login
```
This opens your browser to authenticate.

### 4. Link Your Project
```bash
# Replace cnqxivqxueglihpubeob with your project ref from Supabase dashboard URL
supabase link --project-ref cnqxivqxueglihpubeob
```

### 5. Set Edge Function Secrets
```bash
# Set all secrets at once (replace placeholders with your actual values)
supabase secrets set \
  SUPABASE_URL=https://cnqxivqxueglihpubeob.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNucXhpdnF4dWVnbGlocHViZW9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTc3Mzg0OCwiZXhwIjoyMDc3MzQ5ODQ4fQ.JnKJF1nQOCGk_1NcSGK-0vd6ZpwJmgWBBHThYULny-U \
  MODERATOR_TOKEN=yourStrongSecretTokenHere \
  RESEND_API_KEY=re_xxxxxxxxxxxx \
  RESEND_FROM=noreply@cavexa.online \
  RESEND_TO=shadowmesh.community@gmail.com
```

**Note:** Replace:
- `MODERATOR_TOKEN` with a strong random token (used for admin moderation)
- `RESEND_API_KEY` with your actual Resend API key
- `RESEND_FROM` with your verified Resend sender email
- `RESEND_TO` with your admin email where notifications should go

### 6. Deploy Edge Functions
```bash
# Deploy all three functions
supabase functions deploy notify
supabase functions deploy verify
supabase functions deploy moderate
```

## Edge Functions Explained

### 1. `notify` Function
**Purpose:** Sends email notifications when users submit Join Us or Contact forms  
**Triggered by:** Frontend calls after form submission  
**Uses:** Resend API to send emails  
**Required Secrets:**
- `RESEND_API_KEY` — Your Resend API key
- `RESEND_FROM` — Sender email (must be verified in Resend)
- `RESEND_TO` — Destination email (where you receive notifications)

**How it works:**
- Frontend submits form → calls `/functions/v1/notify` with form data
- Function formats email and sends via Resend
- You receive notification in your inbox

### 2. `verify` Function
**Purpose:** Allows users to check their application status using verification token  
**Triggered by:** User clicks "Check Status" button on frontend  
**Uses:** Service Role Key to read data (bypasses RLS)  
**Required Secrets:**
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (full database access)

**How it works:**
- User enters verification token from their application
- Function queries `join_applications` table with service role key
- Returns status, reviewed_at, decision_reason

### 3. `moderate` Function
**Purpose:** Allows admins to approve/reject join applications  
**Triggered by:** Admin clicks Approve/Reject in admin dashboard  
**Uses:** Service Role Key + Moderator Token for security  
**Required Secrets:**
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key
- `MODERATOR_TOKEN` — Secret token shared between admin and function

**How it works:**
- Admin sets moderator token in admin dashboard
- When Approve/Reject is clicked, frontend sends token in `x-admin-token` header
- Function verifies token matches `MODERATOR_TOKEN` secret
- If valid, updates application status in database

## Security Notes

⚠️ **NEVER expose these secrets:**
- `SUPABASE_SERVICE_ROLE_KEY` — Full database access
- `MODERATOR_TOKEN` — Admin authentication
- `RESEND_API_KEY` — Email sending capability

✅ **Safe to expose:**
- `VITE_SUPABASE_URL` — Public project URL
- `VITE_SUPABASE_ANON_KEY` — Public anon key (limited by RLS)

## Troubleshooting

### "Trigger already exists" Error
✅ **Fixed!** The schema now uses `DROP TRIGGER IF EXISTS` before creating triggers. Just re-run the entire `supabase_schema.sql` file.

### "Type membership_status does not exist" Error
✅ **Fixed!** The schema now checks and creates enums if missing. Re-run `supabase_schema.sql`.

### Functions not receiving secrets
- Verify secrets are set: `supabase secrets list`
- Redeploy functions after setting secrets: `supabase functions deploy <name>`

### Admin dashboard can't read data
- Current RLS only allows INSERT from anon key
- Admin dashboard needs service role key (via Edge Function) OR adjust RLS policies
- For now, admin uses Edge Functions which use service role key internally

## Next Steps

1. ✅ Run `supabase_schema.sql` in Supabase SQL Editor
2. ✅ Set all secrets via CLI
3. ✅ Deploy all three Edge Functions
4. ✅ Test forms on frontend
5. ✅ Check admin dashboard at `/shadow-ops-portal` (login: zeeshanjay / haiderjax###)

