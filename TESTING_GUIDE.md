# Complete Testing Guide for ShadowMesh

## What Those Commands Mean

1. **`npm install`** - Installs the QR scanner library (`@yudiel/react-qr-scanner`) needed for event attendance scanning
2. **`npm run dev`** - Starts the development server so you can test locally
3. **Login (Ctrl + Alt + B)** - Secret keyboard shortcut to open admin login on the 404 page
4. **Attendance Tab** - Admin feature to scan QR codes and check in members at events

---

## Complete Testing Flow

### Phase 1: Join Us Application Flow

#### Step 1: Fill Join Us Form
1. Go to your website: `http://localhost:5173` (or your Vercel URL)
2. Navigate to the "Join Us" section
3. Fill out the form:
   - Name
   - Email
   - University
   - Year
   - Skills/Interests
   - Why you want to join
4. Submit the form
5. **Expected Result:**
   - Form switches to "Check Status" tab automatically
   - You see a **unique secret code** (starts with "SM", e.g., "SM4A2B9C")
   - This code is saved in your browser's local storage
   - You receive a confirmation email

#### Step 2: Check Application Status
1. In the "Check Status" tab, enter your secret code
2. Click "Check Status"
3. **Expected Result:**
   - Shows "Pending" status
   - Displays your application details

---

### Phase 2: Admin Approval Flow

#### Step 3: Access Admin Dashboard
1. Go to: `http://localhost:5173/shadow-ops-portal`
2. **OR** go to `/admin` (404 page) and press **Ctrl + Alt + B**
3. Login with:
   - Username: `zeeshanjay`
   - Password: `haiderjax###`
4. **Expected Result:**
   - Admin dashboard opens
   - You see your application in the "Pending" tab

#### Step 4: Review Application
1. In the "Pending" tab, find your application
2. Click "View" to see full details
3. **Expected Result:**
   - Modal shows all application details
   - Includes the secret code

#### Step 5: Approve Application
1. Click "Approve" button
2. **Expected Result:**
   - Application moves to "Approved" tab
   - You receive a **welcome email** with:
     - Congratulations message
     - Your secret code
     - WhatsApp community link
   - Your data is added to the `members` table
   - You can now access the member portal

#### Step 6: Test Rejection (Optional)
1. Fill another test application with a different email
2. In admin, click "Reject"
3. **Expected Result:**
   - A UI dialog appears asking for rejection reason
   - Enter a reason (e.g., "Incomplete information")
   - Click "OK"
   - Application moves to "Rejected" tab
   - User receives a **rejection email** with the reason

---

### Phase 3: Member Portal Access

#### Step 7: Access Member Portal
1. Go to: `http://localhost:5173/member-portal`
2. Enter your **secret code** (the one you got when you registered)
3. Click "Access Portal"
4. **Expected Result:**
   - Member dashboard opens showing:
     - Your profile
     - Upcoming events
     - Private resources
     - Hackathons section
     - Activity history

---

### Phase 4: Event Registration Flow

#### Step 8: Register for a Workshop (Free Event)
1. In member portal, go to "Events" section
2. Find a workshop (e.g., "React Workshop")
3. Click "Register"
4. **Expected Result:**
   - Registration successful
   - You see "Registered" status
   - You receive an email with:
     - Event details
     - Your secret code (for attendance)
     - Event date/time
   - Your registration appears in admin dashboard

#### Step 9: Admin Creates Event (If Not Exists)
1. In admin dashboard, you need to manually create events in Supabase
2. Go to Supabase Dashboard → Table Editor → `events` table
3. Insert a new event:
   ```sql
   INSERT INTO events (title, description, event_type, event_date, location, max_participants)
   VALUES ('React Workshop', 'Learn React basics', 'workshop', '2024-02-15 10:00:00', 'Online', 50);
   ```
4. **Expected Result:**
   - Event appears in member portal
   - Members can register

---

### Phase 5: Hackathon Registration Flow

#### Step 10: Register for Hackathon
1. In member portal, go to "Hackathons" section
2. Click "Register for Hackathon"
3. Fill the form:
   - Payment method (Bank Transfer, JazzCash, EasyPaisa, etc.)
   - Transaction ID
   - Amount
   - Payment date
4. Upload payment proof (screenshot/receipt)
5. Submit
6. **Expected Result:**
   - Registration submitted
   - Payment proof uploaded to Supabase Storage
   - Status shows "Pending Approval"
   - Admin receives notification in "Hackathons" tab

#### Step 11: Admin Approves Hackathon Registration
1. In admin dashboard, go to "Hackathons" tab
2. Find the pending registration
3. Click "View" to see payment details and proof
4. Click "Approve"
5. **Expected Result:**
   - Status changes to "Approved"
   - Member receives approval email
   - Member portal shows "Find Teammates" option

---

### Phase 6: Team Formation Flow

#### Step 12: Find Teammates
1. In member portal (as approved hackathon participant)
2. Click "Find Teammates"
3. **Expected Result:**
   - List of all approved members appears
   - You can see their skills/interests

#### Step 13: Send Team Request
1. Click "Send Request" on a member
2. **Expected Result:**
   - Request sent
   - Member receives email notification
   - Request appears in their member portal

#### Step 14: Accept Team Request
1. As the requested member, go to member portal
2. Go to "Teams" section
3. See pending requests
4. Click "Accept"
5. **Expected Result:**
   - You're added to the team
   - Team creator receives notification
   - Team appears in both members' portals
   - Maximum 4 members per team enforced

---

### Phase 7: Event Attendance Flow

#### Step 15: Admin Attendance Check-In
1. In admin dashboard, go to "Attendance" tab
2. Select an event from dropdown
3. **Expected Result:**
   - Two lists appear:
     - "Registered" (members who registered)
     - "Checked In" (members who attended)

#### Step 16: Manual Check-In
1. In admin attendance tab
2. Find a registered member
3. Enter their **secret code** manually
4. Click "Check In"
5. **Expected Result:**
   - Member moves to "Checked In" list
   - Check-in time recorded
   - Member's activity log updated

#### Step 17: QR Code Check-In (Advanced)
1. In admin attendance tab
2. Click "Scan QR Code"
3. **Expected Result:**
   - Camera opens
   - Scan member's QR code (if they have one)
   - Automatically checks them in

**Note:** QR codes can be generated later. For now, manual check-in with secret code works.

---

## Quick Test Checklist

- [ ] Fill Join Us form → Get secret code
- [ ] Check status with secret code → See "Pending"
- [ ] Login to admin → See application in "Pending" tab
- [ ] Approve application → See in "Approved" tab + Receive welcome email
- [ ] Access member portal with secret code → See dashboard
- [ ] Register for workshop → Receive event email
- [ ] Register for hackathon → Upload payment proof
- [ ] Admin approves hackathon → Member sees "Find Teammates"
- [ ] Send team request → Member receives notification
- [ ] Accept team request → Team formed (max 4 members)
- [ ] Admin checks in member at event → Attendance recorded

---

## Testing Tips

1. **Use Different Emails:** Create multiple test accounts with different emails to test the full flow
2. **Check Email Inbox:** All notifications go to the email addresses used in forms
3. **Check Browser Console:** Open DevTools (F12) to see any errors
4. **Check Supabase Dashboard:** Verify data is being saved correctly
5. **Test Edge Cases:**
   - Reject an application (with reason)
   - Delete a member from admin
   - Try to join a team when already in one
   - Try to check in without registering

---

## Common Issues & Solutions

### Issue: "Can't access admin dashboard"
- **Solution:** Make sure you're on `/shadow-ops-portal` or press Ctrl+Alt+B on `/admin`

### Issue: "Secret code not working"
- **Solution:** Check if you're using the exact code (case-sensitive, includes "SM" prefix)

### Issue: "No events showing in member portal"
- **Solution:** Create events manually in Supabase `events` table first

### Issue: "Payment proof upload fails"
- **Solution:** Ensure `Payment-Proofs` bucket exists in Supabase Storage and is public

### Issue: "Email not received"
- **Solution:** Check Resend API key is set correctly in Supabase secrets

---

## Next Steps After Testing

Once everything works:
1. Deploy to production (Vercel)
2. Set all environment variables in Vercel
3. Set all Supabase secrets via CLI
4. Test on production URL
5. Share with your team!

---

**Need Help?** Check the console logs, Supabase logs, and Vercel function logs for detailed error messages.

