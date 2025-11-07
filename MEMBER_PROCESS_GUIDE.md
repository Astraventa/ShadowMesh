# ShadowMesh Member Management Process Guide

## Overview

This document explains the complete process for managing ShadowMesh members, from application to event participation.

## Two-Track System

### Track 1: University Direct Add (Your Classes)
**Process:**
1. You announce ShadowMesh in your university classes
2. Students sign up directly → **Bypass application process**
3. You manually add them via Admin Dashboard:
   - Go to Admin → Members tab
   - Click "Add Member" (or use bulk import)
   - They immediately get access to member portal

**Why:** Fast onboarding for students you personally vouch for.

### Track 2: External Application (Other Universities/Cities)
**Process:**
1. User visits `/join-us` → Fills application form
2. Gets verification token → Can check status anytime
3. You review in Admin Dashboard → Approve/Reject
4. On approval:
   - Member record created automatically
   - Welcome email sent with WhatsApp link
   - Access to member portal granted

**Why:** Quality control for external applicants.

---

## Complete User Journey

### For Applicants (External)

1. **Register** (`/join-us` → Register tab)
   - Fill form with details
   - Get verification token
   - Auto-switched to "Check Status" tab

2. **Check Status** (`/join-us` → Check Status tab)
   - Enter token
   - See: Pending / Approved / Rejected
   - If approved: Link to member portal

3. **Member Portal** (`/member-portal?token=xxx`)
   - View upcoming events
   - Register for workshops/hackathons
   - Access private resources
   - View profile

### For University Students (Direct Add)

1. You add them via Admin Dashboard
2. They receive welcome email with token
3. They access `/member-portal?token=xxx`
4. Full member access immediately

---

## Event Participation Rules

### Who Can Participate?

✅ **Members Only** (default for all events)
- Approved members (via application OR direct add)
- Must be registered in `members` table
- Access via member portal

❌ **Non-Members**
- Cannot see events
- Cannot register
- Must apply first

### Event Types Supported

- **Workshops**: Technical training sessions
- **Hackathons**: Competitive coding events
- **Meetups**: Networking events
- **Webinars**: Online presentations
- **Other**: Custom event types

---

## Admin Dashboard Features

### Applications Tab
- **Pending**: New applications awaiting review
- **Approved**: Successfully approved applications
- **Rejected**: Applications that were declined

**Actions:**
- View details
- Approve (creates member + sends email)
- Reject (requires reason, sends rejection email)
- Delete

### Members Tab
- All verified members
- Shows: Name, Email, Join Date, Cohort, Status
- Can filter/search

### Contact Messages Tab
- All contact form submissions
- Can delete

---

## Database Schema

### Tables

1. **join_applications**: Application submissions
2. **members**: Verified members (auto-created on approval)
3. **events**: Workshops, hackathons, meetups
4. **event_registrations**: Member event signups
5. **member_resources**: Private content/resources
6. **contact_messages**: Contact form submissions

### Key Fields

**Members:**
- `email` (unique)
- `full_name`
- `source_application` (links to original application)
- `cohort` (optional: e.g., "Fall 2024")
- `status` (active/inactive)

**Events:**
- `is_member_only`: true = only members can register
- `is_active`: false = hidden from portal
- `max_participants`: Optional limit
- `registration_link`: External link (optional)

---

## Best Practices

### For University Direct Adds

1. **Create a cohort**: Set `cohort` field (e.g., "Spring 2024 - CS101")
2. **Bulk import**: Use CSV import if adding many students
3. **Email notification**: Send welcome email with portal link

### For Event Management

1. **Create events early**: Add events 2-4 weeks before date
2. **Set limits**: Use `max_participants` for popular events
3. **External links**: Use `registration_link` for complex registrations
4. **Deactivate old events**: Set `is_active = false` after event

### For Resource Management

1. **Organize by type**: Use `resource_type` (document/link/video/download)
2. **Access levels**: Use `access_level` (member/premium)
3. **Keep active**: Set `is_active = false` for outdated content

---

## Security Notes

1. **Member Portal**: Requires verification token (from application or email)
2. **Admin Dashboard**: Hidden route + login modal (Ctrl+Alt+B)
3. **RLS Policies**: Database-level security via Supabase RLS
4. **Edge Functions**: Server-side validation for all actions

---

## Email Templates

### Approval Email
- Subject: "Welcome to ShadowMesh!"
- Includes: Logo, welcome message, WhatsApp link
- Sent automatically on approval

### Rejection Email
- Subject: "ShadowMesh Application Update"
- Includes: Logo, rejection reason, re-apply encouragement
- Sent automatically on rejection

---

## Next Steps

1. **Run Schema Update**: Execute `supabase_schema.sql` to create events/resources tables
2. **Set WhatsApp Link**: `supabase secrets set COMMUNITY_WHATSAPP_LINK=your-link`
3. **Create First Event**: Add via Admin Dashboard or directly in Supabase
4. **Add Resources**: Upload private content for members
5. **Test Flow**: Submit test application → Approve → Access portal

---

## FAQ

**Q: Can I change an event after creating it?**
A: Yes, edit directly in Supabase or via Admin Dashboard (if you add edit functionality).

**Q: What if a member loses their token?**
A: They can request a new one via contact form, or you can regenerate in Admin.

**Q: Can non-members see events?**
A: No, events are only visible in the member portal (requires token).

**Q: How do I add many university students at once?**
A: Use Supabase CSV import or create a bulk import function in Admin Dashboard.

**Q: Can I have public events?**
A: Yes, set `is_member_only = false` in events table (requires portal update).

---

## Summary

✅ **Two-track system**: Direct add (university) + Application (external)
✅ **Member dashboard**: Events, resources, profile
✅ **Event registration**: Members-only by default
✅ **Private content**: Resources accessible only to members
✅ **Email automation**: Welcome/rejection emails sent automatically
✅ **Status checking**: Users can check application status anytime

This system provides a professional, scalable approach to managing your ShadowMesh community!

