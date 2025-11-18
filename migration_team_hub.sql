-- Migration: Team Hub infrastructure (practice teams + team updates)
-- Run this in the Supabase SQL editor.

-- Add is_practice flag to hackathon_teams if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hackathon_teams'
      and column_name = 'is_practice'
  ) then
    alter table public.hackathon_teams add column is_practice boolean default false;
  end if;
end$$;

-- Team updates table
create table if not exists public.team_updates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  team_id     uuid references public.hackathon_teams(id) on delete cascade,
  member_id   uuid references public.members(id) on delete cascade,
  message     text not null check (char_length(message) <= 2000)
);

create index if not exists idx_team_updates_team_id on public.team_updates (team_id);
create index if not exists idx_team_updates_created_at on public.team_updates (created_at desc);

alter table public.team_updates enable row level security;

drop policy if exists p_team_updates_select on public.team_updates;
create policy p_team_updates_select
  on public.team_updates
  for select
  to anon, authenticated
  using (true);

drop policy if exists p_team_updates_insert on public.team_updates;
create policy p_team_updates_insert
  on public.team_updates
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists p_team_updates_delete on public.team_updates;
create policy p_team_updates_delete
  on public.team_updates
  for delete
  to anon, authenticated
  using (true);

-- Practice prompts -----------------------------------------------------------
create table if not exists public.team_practice_prompts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  description text,
  focus_area text,
  difficulty text default 'starter' check (difficulty in ('starter','intermediate','elite')),
  reward text,
  status text not null default 'active' check (status in ('active','archived')),
  start_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.members(id) on delete set null
);

create index if not exists idx_team_practice_prompts_status on public.team_practice_prompts (status);
create index if not exists idx_team_practice_prompts_expires on public.team_practice_prompts (expires_at);

alter table public.team_practice_prompts enable row level security;

drop policy if exists p_team_prompts_select on public.team_practice_prompts;
create policy p_team_prompts_select
  on public.team_practice_prompts
  for select
  to anon, authenticated
  using (true);

drop policy if exists p_team_prompts_all on public.team_practice_prompts;
create policy p_team_prompts_all
  on public.team_practice_prompts
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Featured spotlight --------------------------------------------------------
create table if not exists public.team_spotlights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid references public.hackathon_teams(id) on delete cascade,
  headline text not null,
  summary text,
  cta_label text default 'Join Team',
  cta_link text,
  image_url text,
  is_active boolean default true
);

create index if not exists idx_team_spotlights_active on public.team_spotlights (is_active);

alter table public.team_spotlights enable row level security;

drop policy if exists p_team_spotlights_select on public.team_spotlights;
create policy p_team_spotlights_select
  on public.team_spotlights
  for select
  to anon, authenticated
  using (true);

drop policy if exists p_team_spotlights_all on public.team_spotlights;
create policy p_team_spotlights_all
  on public.team_spotlights
  for all
  to anon, authenticated
  using (true)
  with check (true);

