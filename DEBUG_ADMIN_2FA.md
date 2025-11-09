# Debug Admin 2FA Issues

If 2FA is not working after deployment, follow these steps:

## Step 1: Verify Database Record Exists

1. Go to Supabase Dashboard → **Table Editor**
2. Find the `admin_settings` table
3. Check if there's a record with `username = 'zeeshanjay'`
4. Verify:
   - `two_factor_enabled` should be `true` (if 2FA is enabled)
   - `two_factor_secret` should have a value (32-character base32 string)

**If the record doesn't exist:**
- The edge function should create it automatically on first call
- But you can also create it manually:

```sql
INSERT INTO public.admin_settings (username, two_factor_enabled, two_factor_secret)
VALUES ('zeeshanjay', false, null)
ON CONFLICT (username) DO NOTHING;
```

## Step 2: Check Edge Function Logs

1. Go to Supabase Dashboard → **Edge Functions** → `admin_2fa`
2. Click on **Logs** tab
3. Try logging in and check the logs for:
   - `Admin 2FA check_status:` - Should show `enabled: true` if 2FA is enabled
   - Any error messages

## Step 3: Test Edge Function Directly

Open browser console (F12) and run:

```javascript
// Test check_status
fetch('YOUR_SUPABASE_URL/functions/v1/admin_2fa', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
  },
  body: JSON.stringify({ action: 'check_status' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual values.

**Expected response:**
```json
{ "enabled": true }
```
or
```json
{ "enabled": false }
```

## Step 4: Check Browser Console

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Try logging in
4. Look for these messages:
   - `"2FA status check result:"` - Should show `{ enabled: true }` if 2FA is enabled
   - `"2FA is enabled, requiring code"` - Should appear if 2FA is enabled
   - Any error messages

## Step 5: Verify 2FA Was Enabled Correctly

1. Go to Admin Portal → 2FA Settings
2. Check if it shows "Enabled" badge
3. If not, try disabling and re-enabling:
   - Click "Disable 2FA"
   - Click "Enable 2FA"
   - Scan QR code
   - Enter code from authenticator app
   - Should show "2FA Enabled" toast

## Step 6: Check Database After Enabling

After enabling 2FA, verify in database:

```sql
SELECT username, two_factor_enabled, 
       CASE WHEN two_factor_secret IS NOT NULL THEN 'HAS_SECRET' ELSE 'NO_SECRET' END as secret_status,
       updated_at
FROM public.admin_settings
WHERE username = 'zeeshanjay';
```

**Expected result:**
- `two_factor_enabled` = `true`
- `secret_status` = `HAS_SECRET`
- `updated_at` = recent timestamp

## Common Issues

### Issue 1: "Unable to verify 2FA status"
- **Cause**: Edge function not accessible or database error
- **Fix**: Check edge function logs in Supabase Dashboard
- **Fix**: Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in environment

### Issue 2: 2FA enabled but not asking for code
- **Cause**: Database record has `two_factor_enabled = false` or doesn't exist
- **Fix**: Re-enable 2FA in admin settings
- **Fix**: Check database record manually (Step 1)

### Issue 3: Edge function returns 500 error
- **Cause**: Database table doesn't exist or RLS policy issue
- **Fix**: Run the SQL script again to create table
- **Fix**: Check RLS policies in Supabase Dashboard

### Issue 4: CORS error
- **Cause**: Edge function CORS not configured
- **Fix**: Edge functions should handle CORS automatically, but check function logs

## Quick Fix: Reset 2FA

If nothing works, reset 2FA completely:

1. **Disable in Admin Portal** (if accessible)
2. **Or run SQL:**
```sql
UPDATE public.admin_settings
SET two_factor_enabled = false,
    two_factor_secret = null,
    updated_at = now()
WHERE username = 'zeeshanjay';
```

3. **Re-enable 2FA** in Admin Portal
4. **Test login** on another device

## Still Not Working?

1. Check Supabase Dashboard → Edge Functions → `admin_2fa` → Logs
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Make sure you're using the latest deployed version of the edge function

