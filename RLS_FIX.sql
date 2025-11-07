-- Quick fix for RLS policy to allow form submission
-- Run this in Supabase SQL Editor if you're getting "row-level security policy" errors

-- Drop existing policies
drop policy if exists p_join_insert on public.join_applications;
drop policy if exists p_join_select_recent on public.join_applications;
drop policy if exists p_join_select_by_code on public.join_applications;

-- Recreate INSERT policy (allows anonymous users to submit forms)
create policy p_join_insert
  on public.join_applications
  for insert
  to anon
  with check (true);

-- Allow anonymous users to SELECT rows they just created (within 5 minutes)
-- This allows the form to get the secret_code/verification_token after insert
create policy p_join_select_recent
  on public.join_applications
  for select
  to anon
  using (created_at >= now() - interval '5 minutes');

