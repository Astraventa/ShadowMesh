# Testing 2FA Setup - Step by Step

## Issue Fixed
The "setup" action was using `.update()` which fails if the `admin_settings` record doesn't exist. It's now using `.upsert()` which creates the record if it doesn't exist.

## Testing Steps

### 1. Check Browser Console
1. Open Admin Portal → 2FA Settings
2. Open Browser DevTools (F12) → Console tab
3. Click "Enable 2FA"
4. Look for any errors in the console

### 2. Check Edge Function Logs
1. Go to Supabase Dashboard → Edge Functions → `admin_2fa` → Logs
2. Click "Enable 2FA" in admin portal
3. Check logs for:
   - `"2FA setup - secret stored:"` - Should show the secret was saved
   - Any error messages

### 3. Verify Database Record
After clicking "Enable 2FA" (setup step), check the database:

```sql
SELECT * FROM public.admin_settings WHERE username = 'zeeshanjay';
```

**Expected after setup:**
- `username` = 'zeeshanjay'
- `two_factor_secret` = 32-character base32 string (NOT NULL)
- `two_factor_enabled` = false
- `updated_at` = recent timestamp

### 4. Complete 2FA Setup
1. Scan QR code with authenticator app
2. Enter 6-digit code
3. Click "Enable 2FA" button (the enable action)

**Expected after enable:**
- `two_factor_enabled` = true
- `two_factor_secret` = same secret as before
- `updated_at` = updated timestamp

### 5. Check Logs After Enable
In edge function logs, you should see:
- `"2FA enabled successfully:"` with details

## Common Issues

### Issue: "Secret mismatch" error
- **Cause**: The secret from setup doesn't match what's in the database
- **Fix**: Click "Enable 2FA" again to restart setup

### Issue: No record in database after setup
- **Cause**: Edge function error during upsert
- **Fix**: Check edge function logs for errors
- **Fix**: Verify RLS policies allow service_role to insert/update

### Issue: "Failed to setup 2FA" in browser
- **Cause**: Network error or edge function error
- **Fix**: Check browser console for error details
- **Fix**: Check edge function logs

## Debugging Commands

### Check if record exists:
```sql
SELECT username, 
       two_factor_enabled, 
       CASE WHEN two_factor_secret IS NOT NULL THEN 'HAS_SECRET' ELSE 'NO_SECRET' END as secret_status,
       updated_at
FROM public.admin_settings
WHERE username = 'zeeshanjay';
```

### Delete and start fresh:
```sql
DELETE FROM public.admin_settings WHERE username = 'zeeshanjay';
```

Then try setup again.

### Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'admin_settings';
```

Should have a policy allowing service_role full access.


