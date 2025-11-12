# Setup Admin Account - Quick Guide

## Problem
The `admin_settings` table is empty, so login fails with "Admin account not found".

## Solution Options

### Option 1: Use the Setup HTML Page (Easiest) ⭐

1. Open `setup-admin.html` in a text editor
2. Replace these values:
   ```javascript
   const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```
3. Save and open the HTML file in your browser
4. Click "Create Admin Account"
5. Done! ✅

### Option 2: Call the Edge Function Directly

**In Browser Console:**
```javascript
fetch('https://YOUR_PROJECT.supabase.co/functions/v1/admin_setup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
})
.then(r => r.json())
.then(console.log);
```

**Or via curl:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/admin_setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Option 3: Deploy and Call via Supabase CLI

```bash
# Deploy the function
supabase functions deploy admin_setup

# Call it
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/admin_setup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Prerequisites

✅ **Must be done first:**
1. Run `supabase_schema.sql` in Supabase SQL Editor (adds new columns)
2. Deploy the `admin_setup` edge function:
   ```bash
   supabase functions deploy admin_setup
   ```

## Default Credentials

After setup, you can login with:
- **Email:** `zeeshanjay7@gmail.com`
- **Password:** `ShadowMesh2024!Secure#Admin`

⚠️ **IMPORTANT:** Change this password immediately after first login!

## Why the Attempt Counter Shows Wrong Numbers?

The attempt counter was showing incorrect numbers because:
1. The admin account doesn't exist
2. The login function was trying to increment attempts on a non-existent account
3. This has been fixed - now it shows a clear "Admin account not found" message

After creating the account, the attempt counter will work correctly.

