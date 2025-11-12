# Admin Account Setup

## Default Admin Credentials

**⚠️ IMPORTANT: Change these credentials immediately after first login!**

- **Email:** `zeeshanjay7@gmail.com`
- **Password:** `ShadowMesh2024!Secure#Admin`

## Setup Instructions

1. **Run the database migration:**
   ```sql
   -- Execute supabase_schema.sql to add new columns
   ```

2. **Create the default admin account:**
   ```bash
   # Call the admin_setup edge function once
   curl -X POST https://your-project.supabase.co/functions/v1/admin_setup \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json"
   ```

3. **Deploy all edge functions:**
   ```bash
   supabase functions deploy admin_login
   supabase functions deploy admin_password_reset
   supabase functions deploy admin_password_reset_verify
   supabase functions deploy admin_setup
   ```

4. **Login and change password immediately!**

## Security Features Implemented

✅ Email-based authentication (replaces username)
✅ Bcrypt password hashing
✅ Rate limiting (5 attempts, 15-minute lockout)
✅ Password reset via OTP email
✅ Strong password requirements (12+ chars, uppercase, lowercase, number, special)
✅ 2FA support (existing)
✅ Login attempt tracking
✅ Account lockout after failed attempts

## Password Requirements

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character (!@#$%^&*()_+-=[]{}|;':",./<>?)

