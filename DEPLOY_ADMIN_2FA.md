# Deploy Server-Side Admin 2FA

This guide will help you deploy the server-side admin 2FA system that works across all devices using Supabase (no Render needed).

## ✅ What's Changed

- **Before**: 2FA settings stored in `localStorage` (device-specific)
- **After**: 2FA settings stored in Supabase database (works on all devices)

## 📋 Deployment Steps

### Step 1: Create Database Table

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Run this SQL to create the `admin_settings` table:

```sql
-- Admin table for storing admin 2FA settings (server-side)
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  two_factor_secret text,
  two_factor_enabled boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for admin_settings (only accessible via edge functions with admin token)
alter table public.admin_settings enable row level security;

-- Policy: Only service role can access (edge functions will use service role)
create policy p_admin_settings_service_role
  on public.admin_settings
  for all
  to service_role
  using (true)
  with check (true);
```

**OR** you can run the updated `supabase_schema.sql` file which includes this table.

### Step 2: Deploy Edge Function

Deploy the `admin_2fa` edge function:

```bash
cd shadowmesh
supabase functions deploy admin_2fa
```

You should see:
```
Deployed Functions on project [your-project-id]: admin_2fa
```

### Step 3: Test the Setup

1. **Clear old localStorage** (if you had 2FA enabled before):
   - Open browser DevTools (F12)
   - Go to Application/Storage → Local Storage
   - Delete `shadowmesh_admin_2fa_enabled` and `shadowmesh_admin_2fa_secret`

2. **Re-enable 2FA**:
   - Go to Admin Portal
   - Navigate to 2FA settings
   - Click "Enable 2FA"
   - Scan QR code with your authenticator app
   - Enter the real code from your app
   - 2FA should now be enabled

3. **Test on Another Device**:
   - Open admin portal on a different device/browser
   - Enter username and password
   - **It should now ask for 2FA code** ✅
   - Enter code from your authenticator app
   - Should successfully log in

## 🔍 How It Works

1. **Login Flow**:
   - User enters username/password
   - Frontend calls `admin_2fa` edge function with `action: "check_status"`
   - Server checks database and returns if 2FA is enabled
   - If enabled, frontend shows 2FA code input
   - User enters code
   - Frontend calls `admin_2fa` edge function with `action: "verify"`
   - Server verifies TOTP code against stored secret
   - If valid, user is authenticated

2. **Enable 2FA Flow**:
   - User clicks "Enable 2FA"
   - Frontend calls `admin_2fa` edge function with `action: "setup"`
   - Server generates secret and returns QR code URI
   - User scans QR code and enters code
   - Frontend calls `admin_2fa` edge function with `action: "enable"`
   - Server verifies code and stores secret in database
   - 2FA is now enabled

## 🛠️ Edge Function Actions

The `admin_2fa` edge function supports these actions:

- `check_status` - Check if 2FA is enabled (for login)
- `setup` - Generate secret and QR code
- `enable` - Verify code and enable 2FA
- `verify` - Verify 2FA code during login
- `disable` - Disable 2FA

## 🔒 Security

- ✅ 2FA secrets stored in Supabase database (server-side)
- ✅ Only service role can access admin_settings table
- ✅ TOTP verification happens server-side
- ✅ Works across all devices (no localStorage dependency)
- ✅ No Render needed - pure Supabase solution

## 🐛 Troubleshooting

**Issue**: "Failed to check 2FA status"
- **Solution**: Make sure the `admin_2fa` edge function is deployed
- Check Supabase Dashboard → Edge Functions → `admin_2fa` is listed

**Issue**: "2FA not configured"
- **Solution**: Re-enable 2FA in admin settings
- The old localStorage-based 2FA won't work anymore

**Issue**: Edge function returns 500 error
- **Solution**: Check Supabase Dashboard → Edge Functions → Logs
- Make sure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set (they should be auto-configured)

## ✅ Success Criteria

After deployment, you should be able to:

1. ✅ Enable 2FA on one device
2. ✅ Log in on another device and be prompted for 2FA code
3. ✅ Enter real code from authenticator app → Success
4. ✅ Enter random code → Failure

---

**Note**: The old localStorage-based 2FA will no longer work. You need to re-enable 2FA after deploying this update.

