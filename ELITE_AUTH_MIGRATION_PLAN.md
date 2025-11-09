# Elite Authentication Migration Plan

## Decision: Admin Approval Flow

**Recommended Approach:**
1. User fills "Join Us" form
2. **Admin reviews and approves** (maintains exclusivity)
3. System sends **welcome email** with password setup link
4. User sets password (first-time setup)
5. User can login with **Email + Password**
6. User can optionally enable **2FA** for extra security

**Why Admin Approval?**
- Maintains exclusivity for cybersecurity community
- Quality control - only serious members
- Professional vetting process
- Better brand identity

## Migration Steps

### 1. Database Changes
- Remove `secret_code` columns from:
  - `join_applications` table
  - `members` table
- Keep email as primary identifier
- Add welcome email sent flag

### 2. Authentication Changes
- Remove all code-based login
- Implement email + password login
- Add 2FA setup/verification
- Update password reset to use email only

### 3. Attendance System
- QR codes contain member ID (UUID) or email
- Manual check-in uses email lookup
- Remove code scanning

### 4. Admin Panel
- Remove code generation
- Show email instead of code
- Approval triggers welcome email automatically

### 5. Member Portal
- Login with email + password
- Show email instead of code
- 2FA setup in profile

## Security Enhancements
- Email verification required
- Strong password requirements
- 2FA optional but recommended
- Rate limiting on all auth endpoints
- Brute force protection

