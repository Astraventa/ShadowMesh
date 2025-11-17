-- Migration: Fix notification policies and constraint so the admin panel can
-- send custom notifications using the anon key safely.
-- Run this entire script in the Supabase SQL Editor.

-- Allow anon/authenticated clients (admin panel) to select notifications.
drop policy if exists p_member_notifications_select on public.member_notifications;
create policy p_member_notifications_select
  on public.member_notifications
  for select
  to anon, authenticated
  using (true);

-- Allow anon/authenticated clients (admin panel) to insert notifications.
drop policy if exists p_member_notifications_insert on public.member_notifications;
create policy p_member_notifications_insert
  on public.member_notifications
  for insert
  to anon, authenticated
  with check (true);

-- Refresh the check constraint so the new notification_type `admin_message`
-- is accepted.
alter table public.member_notifications
  drop constraint if exists member_notifications_notification_type_check;
alter table public.member_notifications
  add constraint member_notifications_notification_type_check
  check (
    notification_type in (
      'team_invite',
      'team_joined',
      'team_request',
      'hackathon_approved',
      'hackathon_started',
      'submission_reminder',
      'results_published',
      'general',
      'team_chat',
      'team_deleted',
      'admin_message'
    )
  );
-- Allow anon/authenticated to read notifications (Member Portal uses anon key)
drop policy if exists p_member_notifications_select on public.member_notifications;
create policy p_member_notifications_select
  on public.member_notifications
  for select
  to anon, authenticated
  using (true);

-- Refresh notification_type constraint to include admin_message
alter table public.member_notifications
  drop constraint if exists member_notifications_notification_type_check;
alter table public.member_notifications
  add constraint member_notifications_notification_type_check
  check (
    notification_type in (
      'team_invite',
      'team_joined',
      'team_request',
      'hackathon_approved',
      'hackathon_started',
      'submission_reminder',
      'results_published',
      'general',
      'team_chat',
      'team_deleted',
      'admin_message'
    )
  );

