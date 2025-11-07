# Admin Dashboard - Complete Guide

## ✅ What's Been Implemented

### 1. **Member Management**
- **View All Members**: See all verified members with details
- **View Member Details**: Click "View Details" to see:
  - Basic info (name, email, join date, cohort)
  - Event registrations
  - Hackathon registrations
  - Teams they're part of
  - Activity history
- **Delete Member**: Delete members with optional reason (sends email notification)

### 2. **Hackathon Management**
- **View All Registrations**: See all hackathon registrations with:
  - Member details
  - Hackathon name
  - Payment method, amount, transaction ID
  - Payment proof link
  - Status (pending/approved/rejected)
- **Approve/Reject**: 
  - Approve: Member gets email + can form teams
  - Reject: Member gets email with reason
- **View Payment Proof**: Click "View Proof" to see uploaded receipts

### 3. **Attendance Management**
- **Attendance Tab**: Pick any event and see registrations vs. check-ins with live metrics
- **Manual Check-In**: Enter a ShadowMesh code to mark attendance instantly
- **QR Scanner**: Built-in scanner (Ctrl+Alt+B → login → Attendance → Open QR Scanner) to validate passes
- **Recent Activity**: View the latest check-ins, method, and staff member who recorded them

### 4. **Application Management** (Existing)
- Pending/Approved/Rejected tabs
- Approve/Reject with reasons
- Delete applications

### 5. **Contact Messages** (Existing)
- View all contact form submissions
- Delete messages

---

## Event Participation Approach

### **Elite Approach: Dual Access**

#### **Regular Events (Workshops, Meetups, Webinars)**
✅ **Members can register from:**
1. **Member Portal** (`/member-portal`) - Primary method
2. **Landing Page** (`/`) - If event is public (optional)

**How it works:**
- Events marked `is_member_only = true` → Only visible in member portal
- Events marked `is_member_only = false` → Visible on landing page too
- **But**: Only members can actually register (requires member token)

**Why this approach:**
- Flexibility: Members can register from anywhere
- Exclusivity: Non-members see events but can't register
- Professional: Clean separation between public view and member access

#### **Hackathons**
✅ **Members must register from Member Portal only**

**Why:**
- Requires payment and proof upload
- Needs admin approval
- Complex registration flow
- Team formation happens in portal

**Flow:**
1. Member sees hackathon in portal
2. Clicks "Register for Hackathon"
3. Fills payment form + uploads proof
4. Admin reviews and approves
5. Member can then form/join teams

---

## Admin Workflow

### **Daily Tasks**

1. **Review Applications** (Join Applications tab)
   - Check pending applications
   - Approve/Reject with reasons
   - Approved → Auto-creates member + sends welcome email

2. **Review Hackathon Registrations** (Hackathons tab)
   - Check payment proofs
   - Verify transaction IDs
   - Approve if payment verified
   - Reject if payment invalid (with reason)

3. **Monitor Members** (Members tab)
   - View member details to see their activity
   - Delete members if needed (with reason + email)

4. **Check Contact Messages** (Contact Messages tab)
   - Respond to inquiries
   - Delete spam/old messages

5. **Manage Attendance** (Attendance tab)
   - Choose the active event
   - Review registrations vs. check-ins before sessions start
   - Use manual check-in for on-site adjustments
   - Launch the QR scanner to validate attendee passes in real time

---

## Member Details View

When you click "View Details" on a member, you see:

### **Basic Info**
- Full name, email
- Member since date
- Cohort (if set)

### **Event Registrations**
- All events they registered for
- Event type and date
- Registration status

### **Hackathon Registrations**
- All hackathons they registered for
- Payment details
- Approval status

### **Teams**
- Teams they're part of
- Team name and status
- Number of members

### **Activity History**
- Last 50 activities
- Event registrations
- Team joins/creates
- Resource access
- Hackathon approvals

---

## Delete Member Process

1. Click "Delete" on member
2. Enter optional reason (sent in email)
3. Confirm deletion
4. System:
   - Deletes member from database
   - Cascades to related records (teams, registrations, etc.)
   - Sends deletion email with reason
   - Updates admin dashboard

**Email includes:**
- Logo
- Deletion notice
- Reason (if provided)
- Contact information

---

## Hackathon Approval Process

1. Member registers with payment proof
2. Admin sees in "Hackathons" tab
3. Admin clicks "View Proof" to verify payment
4. Admin clicks "Approve" or "Reject"
5. If approved:
   - Member gets email
   - Member can form/join teams
   - Status changes to "approved"
6. If rejected:
   - Member gets email with reason
   - Status changes to "rejected"

---

## Attendance & Check-In Flow

1. **Prepare**: Create the event in Supabase (`events` table) and allow members to RSVP from the site or portal.
2. **Before the session**: Open the **Attendance** tab to review registrations and confirm staffing needs.
3. **Check-in options**:
   - **QR Scanner**: Launch the scanner dialog, scan attendee passes, and the system verifies the ShadowMesh code + event in one step.
   - **Manual Entry**: Type the ShadowMesh code to handle edge cases or device issues.
4. **Real-time updates**: Successful check-ins instantly update `event_checkins`, mark the registration as `attended`, and refresh the dashboard widgets.
5. **Audit trail**: Every scan records the method (`qr` or `manual`) plus the staff member who handled it (`recorded_by`).

> **Next step**: hook the registration confirmation email to attach the event QR, so attendees always arrive with the right code in hand.

---

## Best Practices

### **For Hackathon Management**
- Verify payment proofs carefully
- Check transaction IDs match payment method
- Approve quickly to keep members engaged
- Reject with clear reasons

### **For Member Management**
- Use "View Details" before deleting
- Check activity history for context
- Set cohorts for university students
- Delete only when necessary

### **For Event Management**
- Set `is_member_only = true` for exclusive events
- Set `is_member_only = false` for public-facing events
- Use `max_participants` to limit capacity
- Deactivate old events (`is_active = false`)

---

## Summary

✅ **Complete Admin Dashboard** with:
- Member management (view, details, delete)
- Hackathon management (approve/reject with payment verification)
- Attendance dashboard (manual check-in + QR scanner + live metrics)
- Application management
- Contact message management
- Deep member data views
- Email notifications for all actions

✅ **Elite Event Participation**:
- Regular events: Member portal + optional landing page
- Hackathons: Member portal only (payment required)
- All registrations tracked and visible in admin

✅ **Professional Workflow**:
- Clear approval processes
- Email notifications
- Activity tracking
- Comprehensive member profiles

The system is now production-ready for managing your ShadowMesh community! 🚀

