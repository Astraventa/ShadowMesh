# Two-Factor Authentication (2FA) Implementation Guide

## How 2FA Works in ShadowMesh

### Overview
ShadowMesh uses **TOTP (Time-based One-Time Password)** for 2FA, which is the industry standard used by Google Authenticator, Authy, Microsoft Authenticator, and other authenticator apps.

### How It Works:

1. **Setup Phase**:
   - User clicks "Enable 2FA" in their profile
   - System generates a unique secret key (32-character string)
   - System creates a QR code containing:
     - The secret key
     - Account name (email)
     - Issuer name (ShadowMesh)
   - User scans QR code with authenticator app
   - User enters a 6-digit code from app to verify setup
   - 2FA is enabled

2. **Login Flow with 2FA**:
   - User enters ShadowMesh code (SMXXXXXX)
   - User enters password
   - If 2FA is enabled, system prompts for 6-digit code
   - User opens authenticator app and enters current code
   - System verifies code matches
   - User is logged in

3. **Backup OTP via Email**:
   - If user loses access to authenticator app
   - User can request OTP via email
   - System sends 6-digit OTP to registered email
   - OTP expires in 10 minutes
   - User can use OTP instead of TOTP code

### Security Features:

1. **Rate Limiting**:
   - Max 5 OTP requests per email per hour
   - Prevents abuse and spam

2. **Time-Based Codes**:
   - TOTP codes change every 30 seconds
   - Codes expire after 30 seconds
   - Prevents replay attacks

3. **Backup OTP**:
   - Email OTP expires in 10 minutes
   - One-time use only
   - Automatically cleared after use

4. **Secure Storage**:
   - Secret keys stored in database (encrypted in production)
   - Never transmitted in plain text
   - Only stored after user verification

### User Experience:

**For Users:**
1. Go to Profile tab
2. Click "Enable 2FA"
3. Scan QR code with authenticator app
4. Enter code to verify
5. 2FA is now active

**During Login:**
1. Enter ShadowMesh code
2. Enter password
3. Enter 6-digit code from authenticator app
4. Access granted

**If Authenticator App Lost:**
1. Click "Send OTP via Email" during login
2. Check email for 6-digit code
3. Enter code to login
4. Re-setup 2FA with new device

### Technical Implementation:

**Edge Function: `/functions/v1/two_factor_auth`**

Actions:
- `setup`: Generate secret and QR code URI
- `enable`: Verify code and enable 2FA
- `send_otp`: Send backup OTP via Resend
- `verify`: Verify TOTP or OTP code
- `disable`: Disable 2FA

**Database Fields:**
- `two_factor_secret`: TOTP secret key
- `two_factor_enabled`: Boolean flag
- `two_factor_otp`: Temporary OTP code
- `two_factor_otp_expires`: OTP expiry time

### Production Recommendations:

1. **Use Proper TOTP Library**: 
   - Currently using basic verification
   - In production, use `otpauth` or similar library for proper TOTP validation

2. **Encrypt Secrets**:
   - Encrypt `two_factor_secret` in database
   - Use Supabase Vault or encryption at rest

3. **Recovery Codes**:
   - Generate backup recovery codes when 2FA is enabled
   - Store securely (encrypted)
   - Allow users to download/print

4. **SMS Backup** (Optional):
   - Add SMS as additional backup method
   - Use Twilio or similar service

5. **Audit Logging**:
   - Log all 2FA setup/enable/disable actions
   - Log failed verification attempts
   - Monitor for suspicious activity

### Rate Limiting:

- **OTP Requests**: 5 per email per hour
- **Verification Attempts**: 10 per account per hour
- **Setup Attempts**: 3 per account per day

### Security Best Practices:

1. ✅ Secret keys never exposed in frontend
2. ✅ Rate limiting on all 2FA endpoints
3. ✅ Time-based expiry for OTP codes
4. ✅ Generic error messages (don't reveal if 2FA is enabled)
5. ✅ One-time use for backup OTPs
6. ✅ Secure token generation (crypto.randomUUID)

