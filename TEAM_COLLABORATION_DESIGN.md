# Team Collaboration System - Elite Industry Approach

## Overview
A secure, scalable team collaboration system for hackathons with multiple connection methods.

## Architecture

### 1. **Invite Link System** (Primary Method)
- **Secure Token Generation**: Cryptographically secure tokens (UUID + timestamp hash)
- **Shareable Links**: `https://shadowmesh-six.vercel.app/team-invite/{token}`
- **Time-Limited**: Expires after 7 days (configurable)
- **Usage-Limited**: Can be used up to `max_uses` times (default: 3-4 for team capacity)
- **One-Click Join**: Click link → Verify → Auto-join team

### 2. **Team Discovery** (Secondary Method)
- **Browse Teams**: View all available teams for hackathon
- **Team Details**: See team name, current members, available slots
- **Request to Join**: Send join request to team leader
- **Contact Info**: View team members' email (with privacy controls)

### 3. **Communication Methods**
- **In-App Contact Info**: Show team members' email in team dashboard
- **External Tools**: Teams can use Discord, WhatsApp, Slack, etc.
- **In-App Notifications**: Real-time notifications for team events
- **Email Notifications**: Optional email alerts for important events

### 4. **Security Features**
- ✅ Only approved hackathon registrants can join teams
- ✅ Team capacity limits enforced (max 4 members)
- ✅ Invite tokens expire after set time
- ✅ Usage limits prevent abuse
- ✅ Team leader permissions (can remove members)
- ✅ Audit trail (who joined when)

## Flow Diagrams

### Flow 1: Team Leader Creates Invite Link
```
1. Leader creates team → Team created
2. Leader clicks "Generate Invite Link"
3. System generates secure token
4. Link created: /team-invite/{token}
5. Leader shares link (copy/paste)
6. Link displayed with QR code option
```

### Flow 2: Member Joins via Invite Link
```
1. Member receives invite link
2. Clicks link → Redirected to invite page
3. System verifies:
   - Token is valid
   - Token not expired
   - Token not exceeded max uses
   - Member is approved for hackathon
   - Team has space
4. If valid → Auto-join team
5. Notification sent to team leader
6. Member redirected to hackathon dashboard
```

### Flow 3: Member Joins via Team Discovery
```
1. Member browses available teams
2. Clicks "Request to Join" on team
3. System checks:
   - Member is approved
   - Team has space
   - No pending request exists
4. Request sent to team leader
5. Leader receives notification
6. Leader accepts/rejects
7. If accepted → Member joins team
8. Notification sent to member
```

### Flow 4: Team Communication
```
1. Member views team dashboard
2. Sees all team members with:
   - Full name
   - Email address
   - Role (Leader/Member)
3. Can copy contact info
4. Teams use external tools (Discord, WhatsApp, etc.)
5. In-app notifications for team updates
```

## Database Schema

### `hackathon_invites` Table
```sql
- id (uuid)
- hackathon_id (uuid)
- team_id (uuid)
- created_by (uuid) -- team leader
- invite_token (text, unique) -- secure token
- expires_at (timestamptz)
- max_uses (integer, default: 3)
- uses_count (integer, default: 0)
- is_active (boolean)
- created_at (timestamptz)
```

### `member_notifications` Table (already exists)
```sql
- Used for:
  - Team invite received
  - Team join request
  - Team member joined
  - Team member left
```

## Implementation Plan

### Phase 1: Invite Link System
1. Create edge function `team_invite` for secure token handling
2. Add "Generate Invite Link" button in team dashboard
3. Create invite link page `/team-invite/:token`
4. Implement token verification and auto-join logic

### Phase 2: Enhanced Team Discovery
1. Add contact info display in team cards
2. Improve team browsing UI
3. Add "Copy Contact Info" functionality
4. Show team member emails in team dashboard

### Phase 3: Notifications
1. Create notifications for team events
2. Add notification bell in hackathon dashboard
3. Real-time updates when team changes

### Phase 4: Communication Tools
1. Add "Team Communication" section
2. Optional: Discord/WhatsApp link fields
3. Team chat placeholder (future enhancement)

## Security Considerations

1. **Token Security**:
   - Use cryptographically secure random tokens
   - Store hashed tokens in database
   - Validate token on every use

2. **Access Control**:
   - Only approved hackathon registrants can join
   - Team leader can remove members
   - Cannot join multiple teams for same hackathon

3. **Privacy**:
   - Email sharing is opt-in (can be hidden)
   - Phone numbers optional (not required)
   - Team members can see each other's contact info

4. **Rate Limiting**:
   - Limit invite link generation (5 per team per day)
   - Limit join requests (10 per member per hackathon)

## User Experience

### For Team Leaders:
- Easy invite link generation
- See who joined via link
- Manage team members
- View team contact info

### For Team Members:
- One-click join via link
- Browse and request to join teams
- See all team members' contact info
- Get notified of team updates

## Future Enhancements

1. **In-App Chat**: Real-time team chat (WebSocket)
2. **Video Calls**: Integrated video calling
3. **File Sharing**: Share code, documents within team
4. **Team Calendar**: Shared calendar for meetings
5. **GitHub Integration**: Link team GitHub repos

