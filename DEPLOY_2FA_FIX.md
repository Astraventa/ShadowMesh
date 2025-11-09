# 🚨 CRITICAL: Deploy 2FA Edge Function to Supabase

## The Problem
The 2FA code is updated in the repository but **NOT deployed to Supabase**. That's why it's still accepting any number - the old code is still running on Supabase.

## The Solution
You need to **deploy the edge function** to Supabase using Supabase CLI.

## Step-by-Step Deployment

### 1. Install Supabase CLI (if not installed)
```bash
npm install -g supabase
```

### 2. Login to Supabase
```bash
supabase login
```
This will open your browser to authenticate.

### 3. Link Your Project
```bash
# Replace with your project ref from Supabase dashboard URL
# Example: https://cnqxivqxueglihpubeob.supabase.co
supabase link --project-ref cnqxivqxueglihpubeob
```

### 4. Deploy the 2FA Edge Function
```bash
cd shadowmesh
supabase functions deploy two_factor_auth
```

### 5. Verify Deployment
After deployment, check:
1. Go to Supabase Dashboard → Edge Functions
2. You should see `two_factor_auth` function
3. Check the logs to see if it's working

## Alternative: Deploy via Supabase Dashboard

If CLI doesn't work, you can deploy via dashboard:

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click **"Create a new function"** or **"Edit"** if `two_factor_auth` exists
3. Copy the entire contents of `supabase/functions/two_factor_auth/index.ts`
4. Paste into the function editor
5. Click **"Deploy"**

## Verify It's Working

After deployment:

1. **Test Enable 2FA:**
   - Go to member portal
   - Enable 2FA
   - Scan QR code
   - Try entering a **random number** → Should **FAIL** ❌
   - Enter **real code from app** → Should **SUCCEED** ✅

2. **Test Login with 2FA:**
   - Log out
   - Log in from another device
   - After password, it should ask for 2FA code
   - Try **random number** → Should **FAIL** ❌
   - Enter **real code** → Should **SUCCEED** ✅

## Important Notes

- **Vercel is NOT enough** - Vercel only hosts the frontend
- **Supabase Edge Functions** run on Supabase's servers
- The edge function code must be **deployed to Supabase** to work
- No backend (like Render) is needed - Supabase Edge Functions are the backend

## Troubleshooting

### Error: "Function not found"
- Make sure you're in the correct directory (`shadowmesh`)
- Make sure the function exists at `supabase/functions/two_factor_auth/index.ts`

### Error: "Not authenticated"
- Run `supabase login` again
- Make sure you're logged in with the correct account

### Error: "Project not linked"
- Run `supabase link --project-ref YOUR_PROJECT_REF`
- Get project ref from Supabase dashboard URL

### Still accepting random codes?
- Check Supabase Edge Function logs
- Make sure the latest code is deployed
- Try redeploying: `supabase functions deploy two_factor_auth --no-verify-jwt`

## Quick Test Command

After deployment, test the function:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/two_factor_auth \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"verify","memberId":"test","otp":"123456"}'
```

This should return an error (not success) if verification is working properly.

