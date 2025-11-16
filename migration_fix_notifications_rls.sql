-- Migration: Fix RLS policy for member_notifications to allow admin panel inserts
-- Run this in Supabase SQL Editor

-- Allow anon/authenticated to insert notifications (for admin panel custom notifications)
drop policy if exists p_member_notifications_insert on public.member_notifications;
create policy p_member_notifications_insert
  on public.member_notifications
  for insert
  to anon, authenticated
  with check (true);

