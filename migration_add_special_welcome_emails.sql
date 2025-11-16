-- Migration: Add special_welcome_emails column to admin_settings
-- Run this in Supabase SQL Editor if the column doesn't exist

-- Add column if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns 
                 where table_schema='public' 
                 and table_name='admin_settings' 
                 and column_name='special_welcome_emails') then
    alter table public.admin_settings add column special_welcome_emails text[] default '{}';
  end if;
end$$;

-- Add RLS policy to allow anon/authenticated access (admin panel uses anon key)
drop policy if exists p_admin_settings_anon_special_emails on public.admin_settings;
create policy p_admin_settings_anon_special_emails
  on public.admin_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);

