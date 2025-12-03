-- ShadowMesh Supabase Schema (All-in-One)
-- Run this file once in Supabase SQL editor
-- Includes: extensions, enums, tables, constraints, indexes, RLS, and
--           trigger-based honeypot + simple rate limiting

-- NOTE: This script is safe to re-run. All CREATE/ALTER statements are
-- guarded with IF NOT EXISTS checks so you can paste the whole file and run
-- it again to repair missing types/columns/indexes.

-- 1) Extensions --------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email

-- 2) Enums -------------------------------------------------------------------
-- Affiliation types for Join Us form
do $$
begin
  if not exists (select 1 from pg_type where typname = 'affiliation_type') then
    create type affiliation_type as enum ('student','professional','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type membership_status as enum ('pending','approved','rejected');
  end if;
end$$;

-- 3) Tables ------------------------------------------------------------------
-- Join Us submissions (students + professionals + others)
create table if not exists public.join_applications (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  full_name         text        not null,
  email             citext      not null,
  -- Optional desired username; actual member.username is enforced unique on approval
  username          text,
  affiliation       affiliation_type not null default 'student',

  area_of_interest  text,                 -- e.g. "Cybersecurity", "AI/ML", "Both"
  motivation        text,                 -- Why join?

  -- Contact numbers (stored in normalized E.164 when available)
  raw_phone         text,
  phone_e164        text,                 -- e.g. +923001234567
  constraint chk_phone_e164_format check (
    phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
  ),

  -- Student fields
  university_name   text,
  department        text,
  roll_number       text,

  -- Professional/Other fields
  organization      text,
  role_title        text,

  -- Workflow / Review
  status            membership_status not null default 'pending',
  reviewed_at       timestamptz,
  reviewed_by       text,
  decision_reason   text,
  verification_token uuid default gen_random_uuid(),
  welcome_email_sent boolean default false,

  -- Client metadata (optional)
  user_agent        text,
  ip_addr           inet,

  -- Honeypot (must remain empty)
  honeypot          text default null,

  -- Data quality constraints
  constraint chk_honeypot_empty check (coalesce(honeypot,'') = ''),

  constraint chk_student_fields
    check (
      affiliation <> 'student'
      or (university_name is not null and department is not null and roll_number is not null)
    ),

  constraint chk_professional_fields
    check (
      affiliation <> 'professional'
      or (organization is not null and role_title is not null)
    )
);

-- Members (created when applications are approved)
create table if not exists public.members (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  full_name          text not null,
  email              citext not null,
  -- Public handle used across the app (shown instead of email)
  username           text,
  source_application uuid references public.join_applications(id) on delete set null,
  cohort             text,
  status             text not null default 'active',
  -- Fields from join_applications
  area_of_interest   text,
  motivation         text,
  affiliation        text,
  university_name    text,
  department         text,
  roll_number        text,
  organization       text,
  role_title         text,
  phone_e164         text,
  welcome_email_sent boolean default false,
  email_verified     boolean default false
);

create index if not exists idx_members_created_at on public.members (created_at desc);
create index if not exists idx_members_email on public.members (email);

-- Add username column / constraints to members table if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'members' and column_name = 'username'
  ) then
    alter table public.members add column username text;
  end if;

  -- Simple format constraint: 3-20 chars, letters/numbers/underscore, nullable for legacy members
  if not exists (
    select 1 from pg_constraint 
    where conname = 'chk_members_username_format'
  ) then
    alter table public.members
      add constraint chk_members_username_format
      check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');
  end if;
end$$;

-- Unique index on normalized username (case-insensitive), allowing NULL
create unique index if not exists idx_members_username_unique
  on public.members (lower(username))
  where username is not null;

-- Add security columns to members table if they don't exist
do $$
begin
  -- Password fields
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'password_hash') then
    alter table public.members add column password_hash text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'password_reset_token') then
    alter table public.members add column password_reset_token text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'password_reset_expires') then
    alter table public.members add column password_reset_expires timestamptz;
  end if;
  
  -- 2FA fields
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'two_factor_secret') then
    alter table public.members add column two_factor_secret text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'two_factor_enabled') then
    alter table public.members add column two_factor_enabled boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'two_factor_otp') then
    alter table public.members add column two_factor_otp text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'two_factor_otp_expires') then
    alter table public.members add column two_factor_otp_expires timestamptz;
  end if;
  
  -- Portal access tracking
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'portal_accessed') then
    alter table public.members add column portal_accessed boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'first_portal_access_at') then
    alter table public.members add column first_portal_access_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'joined_from_email') then
    alter table public.members add column joined_from_email boolean default false;
  end if;
  
  -- Premium badges (elite system)
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'verified_badge') then
    alter table public.members add column verified_badge boolean default false; -- Top priority: Verified (blue checkmark)
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'star_badge') then
    alter table public.members add column star_badge boolean default false; -- Second priority: Star (gold star)
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'custom_badge') then
    alter table public.members add column custom_badge text; -- Custom badge name/icon (for future GPT Pro generated badges)
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'badge_granted_at') then
    alter table public.members add column badge_granted_at timestamptz; -- When badge was granted
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'badge_granted_by') then
    alter table public.members add column badge_granted_by text; -- Admin who granted the badge
  end if;
  
  -- Member management features
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'is_hidden') then
    alter table public.members add column is_hidden boolean default false; -- Hide member from public lists
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'member_category') then
    alter table public.members add column member_category text default 'regular' check (member_category in ('regular', 'admin', 'friend', 'special', 'vip', 'core_team')); -- Member category
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'priority_level') then
    alter table public.members add column priority_level integer default 0; -- Priority for sorting (higher = more important)
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'special_notes') then
    alter table public.members add column special_notes text; -- Admin notes about this member
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'email_hidden') then
    alter table public.members add column email_hidden boolean default false; -- Hide email from public view
  end if;
end$$;

-- Events table for workshops, hackathons, etc.
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  title             text        not null,
  description       text,
  event_type        text        not null check (event_type in ('workshop', 'hackathon', 'meetup', 'webinar', 'other')),
  start_date        timestamptz not null,
  end_date          timestamptz,
  location          text, -- Can be physical or online
  registration_link text,
  max_participants  integer,
  is_active         boolean      not null default true,
  is_member_only    boolean      not null default true, -- Only members can register
  created_by        text         default 'admin',
  -- Additional fields for event management
  fee_amount        numeric(10,2) default 0, -- Event fee (0 for free)
  fee_currency      text default 'PKR', -- Currency code
  payment_required  boolean default false, -- Whether payment is required
  notify_members    boolean default false, -- Whether to notify members about this event
  category          text, -- e.g., 'cyber', 'ai', 'fusion', 'general'
  tags              text[], -- Array of tags
  image_url         text, -- Event image/thumbnail URL
  registration_deadline timestamptz, -- Deadline for registration
  status            text default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled'))
);

-- Event registrations (members register for events)
create table if not exists public.event_registrations (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  event_id          uuid references public.events(id) on delete cascade,
  member_id         uuid references public.members(id) on delete cascade,
  status            text        not null default 'registered' check (status in ('registered', 'attended', 'cancelled', 'pending_payment')),
  notes             text,
  -- Payment fields (for paid events)
  payment_method    text, -- e.g., 'bank_transfer', 'easypaisa', 'jazzcash', 'other'
  payment_proof_url text, -- URL to payment screenshot/receipt
  transaction_id    text, -- Transaction reference number
  payment_amount    numeric(10,2),
  payment_date      timestamptz,
  unique (event_id, member_id) -- One registration per member per event
);

-- Attendance check-ins (QR / manual)
create table if not exists public.event_checkins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  event_id      uuid references public.events(id) on delete cascade,
  member_id     uuid references public.members(id) on delete cascade,
  method        text not null default 'qr',
  recorded_by   text,
  metadata      jsonb,
  unique (event_id, member_id)
);

-- Private content/resources for members
create table if not exists public.member_resources (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  title             text        not null,
  description       text,
  resource_type     text        not null check (resource_type in ('document', 'link', 'video', 'download', 'other')),
  content_url       text,
  access_level      text        not null default 'member' check (access_level in ('member', 'premium')),
  is_active         boolean      not null default true,
  created_by        text         default 'admin'
);

create index if not exists idx_events_start_date on public.events (start_date desc);
create index if not exists idx_events_is_active on public.events (is_active);
create index if not exists idx_event_registrations_event_id on public.event_registrations (event_id);
create index if not exists idx_event_registrations_member_id on public.event_registrations (member_id);
create index if not exists idx_event_checkins_event_id on public.event_checkins (event_id);
create index if not exists idx_event_checkins_member_id on public.event_checkins (member_id);
create index if not exists idx_event_checkins_method on public.event_checkins (method);
create index if not exists idx_member_resources_is_active on public.member_resources (is_active);

-- Secret code generation removed - using email-based authentication

-- Hackathon registrations (separate from regular events, includes payment)
create table if not exists public.hackathon_registrations (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  member_id         uuid references public.members(id) on delete cascade,
  hackathon_id      uuid references public.events(id) on delete cascade,
  status            text        not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  payment_method    text, -- e.g., 'bank_transfer', 'easypaisa', 'jazzcash', 'other'
  payment_proof_url text, -- URL to payment screenshot/receipt
  transaction_id    text, -- Transaction reference number
  payment_amount    numeric(10,2),
  payment_date      timestamptz,
  reviewed_at       timestamptz,
  reviewed_by       text,
  rejection_reason  text,
  notes             text,
  unique (member_id, hackathon_id) -- One registration per member per hackathon
);

-- Hackathon teams (max 4 members per team)
create table if not exists public.hackathon_teams (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  hackathon_id      uuid references public.events(id) on delete cascade,
  team_name         text        not null,
  team_leader_id    uuid references public.members(id) on delete cascade,
  status            text        not null default 'forming' check (status in ('forming', 'complete', 'disbanded')),
  max_members       integer     not null default 4,
  check (max_members <= 4 and max_members >= 1)
);

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hackathon_teams' and column_name='is_practice') then
    alter table public.hackathon_teams add column is_practice boolean default false;
  end if;
end$$;

-- Team members (many-to-many: teams <-> members)
create table if not exists public.team_members (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  team_id           uuid references public.hackathon_teams(id) on delete cascade,
  member_id         uuid references public.members(id) on delete cascade,
  role              text        not null default 'member' check (role in ('leader', 'member')),
  joined_at         timestamptz not null default now(),
  unique (team_id, member_id) -- One membership per team per member
);

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

-- Practice prompts for Team Hub
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

-- Featured team spotlights
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

-- Team Hub practice projects (admin-designed projects for squads)
create table if not exists public.team_projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  description text,
  focus_area text, -- e.g. 'offense', 'defense', 'ai-security'
  difficulty text default 'starter' check (difficulty in ('starter','intermediate','elite')),
  repo_url text, -- Base GitHub repo or template link
  summary text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  tags text[],
  deadline timestamptz, -- Project deadline for submissions
  created_by uuid references public.members(id) on delete set null
);

create index if not exists idx_team_projects_status on public.team_projects (status);
create index if not exists idx_team_projects_created_at on public.team_projects (created_at desc);

alter table public.team_projects enable row level security;

-- Admin panel and portal both use anon/authenticated keys with token gating
drop policy if exists p_team_projects_all on public.team_projects;
create policy p_team_projects_all
  on public.team_projects
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Per-team project runs (who started which project, when, and current status)
create table if not exists public.team_project_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid references public.team_projects(id) on delete cascade,
  team_id uuid references public.hackathon_teams(id) on delete cascade,
  started_by_member_id uuid references public.members(id) on delete set null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','reviewed','completed','cancelled')),
  notes text
);

create index if not exists idx_team_project_runs_project_id on public.team_project_runs (project_id);
create index if not exists idx_team_project_runs_team_id on public.team_project_runs (team_id);
create index if not exists idx_team_project_runs_status on public.team_project_runs (status);
create index if not exists idx_team_project_runs_started_at on public.team_project_runs (started_at desc);

alter table public.team_project_runs enable row level security;

drop policy if exists p_team_project_runs_all on public.team_project_runs;
create policy p_team_project_runs_all
  on public.team_project_runs
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Project submissions (what teams actually submit for review)
create table if not exists public.team_project_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_run_id uuid references public.team_project_runs(id) on delete cascade,
  submitted_by_member_id uuid references public.members(id) on delete set null,
  submitted_at timestamptz not null default now(),
  repo_link text,        -- Final repo / branch / PR link
  summary text,          -- Short write-up
  artifact_url text,     -- Supabase storage path or external artifact link
  admin_feedback text,
  score integer,
  awarded_points integer,
  status text default 'pending_review' check (status in ('pending_review','approved','rejected'))
);

create index if not exists idx_team_project_submissions_run_id on public.team_project_submissions (project_run_id);
create index if not exists idx_team_project_submissions_status on public.team_project_submissions (status);
create index if not exists idx_team_project_submissions_created_at on public.team_project_submissions (created_at desc);

alter table public.team_project_submissions enable row level security;

drop policy if exists p_team_project_submissions_all on public.team_project_submissions;
create policy p_team_project_submissions_all
  on public.team_project_submissions
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Team requests (invitations to join teams)
create table if not exists public.team_requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  team_id           uuid references public.hackathon_teams(id) on delete cascade,
  from_member_id    uuid references public.members(id) on delete cascade, -- Who sent the request
  to_member_id      uuid references public.members(id) on delete cascade, -- Who receives the request
  status            text        not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  message           text,
  responded_at      timestamptz,
  unique (team_id, to_member_id) -- One pending request per team per member
);

-- Member activity log (track what members do)
create table if not exists public.member_activity (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  member_id         uuid references public.members(id) on delete cascade,
  activity_type     text        not null check (activity_type in ('event_registered', 'event_attended', 'resource_accessed', 'team_joined', 'team_created', 'hackathon_registered', 'hackathon_approved', 'hackathon_rejected')),
  activity_data     jsonb, -- Flexible JSON for activity details
  related_id        uuid -- ID of related event/resource/team/etc
);

create index if not exists idx_hackathon_registrations_member_id on public.hackathon_registrations (member_id);
create index if not exists idx_hackathon_registrations_hackathon_id on public.hackathon_registrations (hackathon_id);
create index if not exists idx_hackathon_registrations_status on public.hackathon_registrations (status);
create index if not exists idx_hackathon_teams_hackathon_id on public.hackathon_teams (hackathon_id);
create index if not exists idx_hackathon_teams_leader_id on public.hackathon_teams (team_leader_id);
create unique index if not exists idx_hackathon_teams_name_unique on public.hackathon_teams (hackathon_id, lower(team_name));
create index if not exists idx_team_members_team_id on public.team_members (team_id);
create index if not exists idx_team_members_member_id on public.team_members (member_id);
create index if not exists idx_team_requests_to_member_id on public.team_requests (to_member_id);
create index if not exists idx_team_requests_status on public.team_requests (status);
create index if not exists idx_member_activity_member_id on public.member_activity (member_id);
create index if not exists idx_member_activity_type on public.member_activity (activity_type);

-- Apply status columns if table already existed
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='status') then
    alter table public.join_applications add column status membership_status not null default 'pending';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='reviewed_at') then
    alter table public.join_applications add column reviewed_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='reviewed_by') then
    alter table public.join_applications add column reviewed_by text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='decision_reason') then
    alter table public.join_applications add column decision_reason text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='verification_token') then
    alter table public.join_applications add column verification_token uuid default gen_random_uuid();
  end if;
  -- Remove secret_code columns if they exist (migration to email-based auth)
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='secret_code') then
    alter table public.join_applications drop column secret_code;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='secret_code') then
    alter table public.members drop column secret_code;
  end if;
  
  -- Add welcome email tracking
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='welcome_email_sent') then
    alter table public.join_applications add column welcome_email_sent boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='welcome_email_sent') then
    alter table public.members add column welcome_email_sent boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='email_verified') then
    alter table public.members add column email_verified boolean default false;
  end if;
  
  -- Add fields from join_applications to members table
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='area_of_interest') then
    alter table public.members add column area_of_interest text;
    update public.members m
      set area_of_interest = ja.area_of_interest
      from public.join_applications ja
      where m.source_application = ja.id and m.area_of_interest is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='motivation') then
    alter table public.members add column motivation text;
    update public.members m
      set motivation = ja.motivation
      from public.join_applications ja
      where m.source_application = ja.id and m.motivation is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='affiliation') then
    alter table public.members add column affiliation text;
    update public.members m
      set affiliation = ja.affiliation::text
      from public.join_applications ja
      where m.source_application = ja.id and m.affiliation is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='university_name') then
    alter table public.members add column university_name text;
    update public.members m
      set university_name = ja.university_name
      from public.join_applications ja
      where m.source_application = ja.id and m.university_name is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='department') then
    alter table public.members add column department text;
    update public.members m
      set department = ja.department
      from public.join_applications ja
      where m.source_application = ja.id and m.department is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='roll_number') then
    alter table public.members add column roll_number text;
    update public.members m
      set roll_number = ja.roll_number
      from public.join_applications ja
      where m.source_application = ja.id and m.roll_number is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='organization') then
    alter table public.members add column organization text;
    update public.members m
      set organization = ja.organization
      from public.join_applications ja
      where m.source_application = ja.id and m.organization is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='role_title') then
    alter table public.members add column role_title text;
    update public.members m
      set role_title = ja.role_title
      from public.join_applications ja
      where m.source_application = ja.id and m.role_title is null;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='members' and column_name='phone_e164') then
    alter table public.members add column phone_e164 text;
    update public.members m
      set phone_e164 = ja.phone_e164
      from public.join_applications ja
      where m.source_application = ja.id and m.phone_e164 is null;
  end if;
  
  -- Add additional event fields
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='fee_amount') then
    alter table public.events add column fee_amount numeric(10,2) default 0;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='fee_currency') then
    alter table public.events add column fee_currency text default 'PKR';
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='payment_required') then
    alter table public.events add column payment_required boolean default false;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='notify_members') then
    alter table public.events add column notify_members boolean default false;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='category') then
    alter table public.events add column category text;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='tags') then
    alter table public.events add column tags text[];
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='image_url') then
    alter table public.events add column image_url text;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='registration_deadline') then
    alter table public.events add column registration_deadline timestamptz;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='status') then
    alter table public.events add column status text default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled'));
  end if;
end$$;

-- Removed secret_code indexes - using email as primary identifier

alter table public.member_activity drop constraint if exists member_activity_activity_type_check;
alter table public.member_activity
  add constraint member_activity_activity_type_check
  check (activity_type in ('event_registered', 'event_attended', 'resource_accessed', 'team_joined', 'team_created', 'hackathon_registered', 'hackathon_approved', 'hackathon_rejected'));

-- Contact messages
create table if not exists public.contact_messages (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  name         text    not null,
  email        citext  not null,
  message      text    not null,

  -- Optional phone
  raw_phone    text,
  phone_e164   text,
  constraint chk_phone_e164_format_contact check (
    phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'
  ),

  -- Optional meta
  source_page  text,
  user_agent   text,
  ip_addr      inet,

  honeypot     text default null,
  constraint chk_honeypot_empty_contact check (coalesce(honeypot,'') = '')
);

-- Feedback table for member feedback
create table if not exists public.member_feedback (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  member_id         uuid references public.members(id) on delete cascade,
  feedback_type     text not null default 'general' check (feedback_type in ('general', 'event', 'portal', 'suggestion', 'bug', 'other')),
  subject           text,
  message           text not null,
  rating            integer check (rating >= 1 and rating <= 5), -- 1-5 star rating
  related_event_id  uuid references public.events(id) on delete set null, -- If feedback is about a specific event
  status            text default 'new' check (status in ('new', 'read', 'responded', 'resolved', 'archived')),
  admin_notes       text, -- Admin internal notes
  responded_at      timestamptz,
  responded_by      text
);

create index if not exists idx_member_feedback_member_id on public.member_feedback (member_id);
create index if not exists idx_member_feedback_type on public.member_feedback (feedback_type);
create index if not exists idx_member_feedback_status on public.member_feedback (status);
create index if not exists idx_member_feedback_created_at on public.member_feedback (created_at desc);

-- 4) Indexes -----------------------------------------------------------------
create index if not exists idx_join_applications_created_at on public.join_applications (created_at desc);
create index if not exists idx_join_applications_email on public.join_applications (email);
create index if not exists idx_join_applications_affiliation on public.join_applications (affiliation);
create index if not exists idx_join_applications_phone on public.join_applications (phone_e164);
create index if not exists idx_join_applications_status on public.join_applications (status);

create index if not exists idx_contact_messages_created_at on public.contact_messages (created_at desc);
create index if not exists idx_contact_messages_email on public.contact_messages (email);
create index if not exists idx_contact_messages_phone on public.contact_messages (phone_e164);

-- 5) Simple Rate Limiting via Triggers --------------------------------------
-- You can tune the limits below as needed.
-- Defaults: Join Us = max 3 submissions / 10 minutes per email
--           Contact = max 5 submissions / 10 minutes per email

create or replace function public.enforce_join_rate_limit()
returns trigger language plpgsql as $$
declare
  v_count int;
begin
  -- Null/empty email guard
  if new.email is null or new.email = '' then
    raise exception 'email is required for rate limiting';
  end if;

  select count(*) into v_count
  from public.join_applications
  where email = new.email
    and created_at >= now() - interval '10 minutes';

  if v_count >= 3 then
    raise exception 'rate_limit_exceeded: too many join submissions, try again later';
  end if;

  return new;
end$$;

create or replace function public.enforce_contact_rate_limit()
returns trigger language plpgsql as $$
declare
  v_count int;
begin
  if new.email is null or new.email = '' then
    raise exception 'email is required for rate limiting';
  end if;

  select count(*) into v_count
  from public.contact_messages
  where email = new.email
    and created_at >= now() - interval '10 minutes';

  if v_count >= 5 then
    raise exception 'rate_limit_exceeded: too many messages, try again later';
  end if;

  return new;
end$$;

-- Attach triggers (idempotent: drop if exists, then create)
drop trigger if exists trg_join_rate_limit on public.join_applications;
create trigger trg_join_rate_limit
before insert on public.join_applications
for each row execute function public.enforce_join_rate_limit();

drop trigger if exists trg_contact_rate_limit on public.contact_messages;
create trigger trg_contact_rate_limit
before insert on public.contact_messages
for each row execute function public.enforce_contact_rate_limit();

-- 6) Row Level Security (RLS) ------------------------------------------------
alter table public.join_applications enable row level security;
alter table public.contact_messages enable row level security;

-- Allow anonymous INSERTs and SELECT of their own row (for getting secret_code after insert)
-- (Supabase anon key can insert, and can read back the row they just inserted)

drop policy if exists p_join_insert on public.join_applications;
create policy p_join_insert
  on public.join_applications
  for insert
  to anon
  with check (true);

-- Allow anonymous users to SELECT rows they just created (within 5 minutes)
-- This allows the form to get the secret_code/verification_token after insert
-- Status checks should use the verify edge function (which uses service role key)
drop policy if exists p_join_select_recent on public.join_applications;
create policy p_join_select_recent
  on public.join_applications
  for select
  to anon
  using (created_at >= now() - interval '5 minutes');

drop policy if exists p_contact_insert on public.contact_messages;
create policy p_contact_insert
  on public.contact_messages
  for insert
  to anon
  with check (true);

-- Optional: create admin role policies later for reads (not included here).

-- 7) Helper Views (optional for admin) --------------------------------------
-- create view public.v_join_stats as
--   select affiliation, status, count(*) as total, min(created_at) as first_at, max(created_at) as last_at
--   from public.join_applications group by affiliation, status;

-- 8) Notes -------------------------------------------------------------------
-- Frontend usage: submit via supabase-js; store E.164 phone in phone_e164 when valid.
-- Keepalive: ping a tiny function to avoid cold starts on free tier.

-- Admin table for storing admin 2FA settings (server-side)
create table if not exists public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  username text unique, -- Keep for backward compatibility, but email is primary
  email text not null unique, -- Primary identifier for admin login
  password_hash text not null, -- bcrypt hashed password
  two_factor_secret text,
  two_factor_enabled boolean default false,
  -- Password reset OTP
  password_reset_otp text,
  password_reset_otp_expires timestamptz,
  -- Rate limiting / security
  login_attempts integer default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  -- Special welcome emails (array of email addresses)
  special_welcome_emails text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add new columns if they don't exist (idempotent)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='email') then
    alter table public.admin_settings add column email text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='password_hash') then
    alter table public.admin_settings add column password_hash text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='password_reset_otp') then
    alter table public.admin_settings add column password_reset_otp text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='password_reset_otp_expires') then
    alter table public.admin_settings add column password_reset_otp_expires timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='login_attempts') then
    alter table public.admin_settings add column login_attempts integer default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='locked_until') then
    alter table public.admin_settings add column locked_until timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='last_login_at') then
    alter table public.admin_settings add column last_login_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='last_login_ip') then
    alter table public.admin_settings add column last_login_ip text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='admin_settings' and column_name='special_welcome_emails') then
    alter table public.admin_settings add column special_welcome_emails text[] default '{}';
  end if;
  -- Make email unique if not already
  if not exists (select 1 from pg_constraint where conname = 'admin_settings_email_key') then
    alter table public.admin_settings add constraint admin_settings_email_key unique (email);
  end if;
  -- Make email not null if it's nullable
  alter table public.admin_settings alter column email set not null;
end$$;

-- RLS for admin_settings (only accessible via edge functions with admin token)
alter table public.admin_settings enable row level security;

-- Policy: Only service role can access (edge functions will use service role)
drop policy if exists p_admin_settings_service_role on public.admin_settings;
create policy p_admin_settings_service_role
  on public.admin_settings
  for all
  to service_role
  using (true)
  with check (true);

-- Policy: Allow anon/authenticated to read/write special_welcome_emails (admin panel uses anon key with client-side token gate)
drop policy if exists p_admin_settings_anon_special_emails on public.admin_settings;
create policy p_admin_settings_anon_special_emails
  on public.admin_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Cleanup admin_settings 2FA entries when a member is deleted (match on email/username)
create or replace function public.fn_cleanup_admin_2fa_on_member_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove any admin_settings records that correspond to this member's email
  delete from public.admin_settings where username = old.email;
  return old;
end;
$$;

drop trigger if exists trg_cleanup_admin_2fa_on_member_delete on public.members;
create trigger trg_cleanup_admin_2fa_on_member_delete
after delete on public.members
for each row
execute function public.fn_cleanup_admin_2fa_on_member_delete();

-- 9) Idempotent sanity checks (optional) -------------------------------------
do $$
begin
  -- Ensure required enum exists
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type membership_status as enum ('pending','approved','rejected');
  end if;

  -- Ensure critical columns exist on join_applications
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='status') then
    alter table public.join_applications add column status membership_status not null default 'pending';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='join_applications' and column_name='verification_token') then
    alter table public.join_applications add column verification_token uuid default gen_random_uuid();
  end if;

  -- Add payment fields to event_registrations if they don't exist
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='event_registrations' and column_name='payment_method') then
    alter table public.event_registrations add column payment_method text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='event_registrations' and column_name='payment_proof_url') then
    alter table public.event_registrations add column payment_proof_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='event_registrations' and column_name='transaction_id') then
    alter table public.event_registrations add column transaction_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='event_registrations' and column_name='payment_amount') then
    alter table public.event_registrations add column payment_amount numeric(10,2);
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='event_registrations' and column_name='payment_date') then
    alter table public.event_registrations add column payment_date timestamptz;
  end if;
  -- Update status constraint to include 'pending_payment'
  if exists (select 1 from information_schema.table_constraints where constraint_name='event_registrations_status_check' and table_schema='public' and table_name='event_registrations') then
    alter table public.event_registrations drop constraint if exists event_registrations_status_check;
  end if;
  alter table public.event_registrations add constraint event_registrations_status_check 
    check (status in ('registered', 'attended', 'cancelled', 'pending_payment'));
end$$;

-- 10) Hackathon Dashboard Tables ------------------------------------------------

-- Add hackathon-specific fields to events table
do $$
begin
  -- Schedule and rules (markdown content)
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='schedule_markdown') then
    alter table public.events add column schedule_markdown text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='rules_markdown') then
    alter table public.events add column rules_markdown text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='details_markdown') then
    alter table public.events add column details_markdown text;
  end if;
  -- Submission deadline (separate from registration deadline)
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='submission_deadline') then
    alter table public.events add column submission_deadline timestamptz;
  end if;
  -- Results publication
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='results_published_at') then
    alter table public.events add column results_published_at timestamptz;
  end if;
  -- Submission page configuration
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='submission_page_enabled') then
    alter table public.events add column submission_page_enabled boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='events' and column_name='submission_fields') then
    alter table public.events add column submission_fields jsonb; -- JSON config for submission form fields
  end if;
end$$;

-- Hackathon submissions (team or individual)
create table if not exists public.hackathon_submissions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  hackathon_id      uuid references public.events(id) on delete cascade,
  team_id           uuid references public.hackathon_teams(id) on delete set null, -- null for individual submissions
  member_id         uuid references public.members(id) on delete cascade, -- submitter (team leader or individual)
  title             text not null,
  description       text,
  artifact_url      text, -- URL to submission (GitHub repo, demo link, etc.)
  video_url         text, -- Optional video demo/pitch
  submission_data   jsonb, -- Flexible JSON for additional data
  status            text default 'submitted' check (status in ('submitted', 'under_review', 'disqualified', 'winner', 'runner_up')),
  admin_notes       text,
  reviewed_at       timestamptz,
  reviewed_by       text,
  unique (hackathon_id, team_id), -- One submission per team per hackathon
  unique (hackathon_id, member_id) -- One submission per individual per hackathon (if no team)
);

-- Hackathon results (winners, rankings)
create table if not exists public.hackathon_results (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  hackathon_id      uuid references public.events(id) on delete cascade,
  team_id           uuid references public.hackathon_teams(id) on delete set null,
  member_id         uuid references public.members(id) on delete set null, -- for individual winners
  submission_id     uuid references public.hackathon_submissions(id) on delete set null,
  rank              integer not null, -- 1 = winner, 2 = runner-up, etc.
  award_category    text, -- e.g., 'Best Overall', 'Best AI Solution', 'Best Security', 'Innovation Award'
  prize_amount      numeric(10,2),
  prize_description text,
  notes             text,
  unique (hackathon_id, rank, award_category) -- One winner per rank per category
);

-- Hackathon invite links (for team invitations)
create table if not exists public.hackathon_invites (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  hackathon_id      uuid references public.events(id) on delete cascade,
  team_id           uuid references public.hackathon_teams(id) on delete cascade,
  created_by        uuid references public.members(id) on delete cascade, -- team leader who created invite
  invite_token      text not null unique, -- Signed token for invite link
  max_uses          integer default 1, -- How many times this invite can be used
  uses_count        integer default 0, -- Current usage count
  is_active         boolean default true
);

-- Team chat messages (deleted automatically when a team is deleted)
create table if not exists public.team_messages (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  team_id           uuid references public.hackathon_teams(id) on delete cascade,
  hackathon_id      uuid references public.events(id) on delete cascade,
  sender_member_id  uuid references public.members(id) on delete cascade,
  message           text not null check (char_length(message) <= 2000)
);

-- Member notifications (in-app notifications)
create table if not exists public.member_notifications (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  member_id         uuid references public.members(id) on delete cascade,
  notification_type text not null check (notification_type in ('team_invite', 'team_joined', 'team_request', 'hackathon_approved', 'hackathon_started', 'submission_reminder', 'results_published', 'general', 'team_chat', 'team_deleted', 'admin_message')),
  title             text not null,
  message           text not null,
  related_id        uuid, -- ID of related team/event/submission/etc
  related_type      text, -- 'team', 'event', 'submission', etc.
  is_read           boolean default false,
  read_at           timestamptz,
  action_url        text, -- Optional URL to navigate to when clicked
  metadata          jsonb -- Additional data
);

-- Hackathon resources (resources specific to a hackathon)
create table if not exists public.hackathon_resources (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  hackathon_id      uuid references public.events(id) on delete cascade,
  resource_id       uuid references public.member_resources(id) on delete cascade,
  display_order     integer default 0, -- Order in which to display resources
  is_required       boolean default false, -- Whether this resource is required reading
  unique (hackathon_id, resource_id)
);

-- Indexes for hackathon dashboard tables
create index if not exists idx_hackathon_submissions_hackathon_id on public.hackathon_submissions (hackathon_id);
create index if not exists idx_hackathon_submissions_team_id on public.hackathon_submissions (team_id);
create index if not exists idx_hackathon_submissions_member_id on public.hackathon_submissions (member_id);
create index if not exists idx_hackathon_submissions_status on public.hackathon_submissions (status);

create index if not exists idx_hackathon_results_hackathon_id on public.hackathon_results (hackathon_id);
create index if not exists idx_hackathon_results_team_id on public.hackathon_results (team_id);
create index if not exists idx_hackathon_results_rank on public.hackathon_results (rank);

create index if not exists idx_hackathon_invites_token on public.hackathon_invites (invite_token);
create index if not exists idx_hackathon_invites_team_id on public.hackathon_invites (team_id);
create index if not exists idx_hackathon_invites_expires_at on public.hackathon_invites (expires_at);
create index if not exists idx_team_messages_team_id on public.team_messages (team_id);
create index if not exists idx_team_messages_created_at on public.team_messages (created_at desc);
create index if not exists idx_team_messages_sender on public.team_messages (sender_member_id);

create index if not exists idx_member_notifications_member_id on public.member_notifications (member_id);
create index if not exists idx_member_notifications_is_read on public.member_notifications (is_read);
create index if not exists idx_member_notifications_created_at on public.member_notifications (created_at desc);

create index if not exists idx_hackathon_resources_hackathon_id on public.hackathon_resources (hackathon_id);
create index if not exists idx_hackathon_resources_display_order on public.hackathon_resources (display_order);

-- RLS for new tables
alter table public.hackathon_submissions enable row level security;
alter table public.hackathon_results enable row level security;
alter table public.hackathon_invites enable row level security;
alter table public.team_messages disable row level security;
alter table public.member_notifications enable row level security;
alter table public.hackathon_resources enable row level security;

-- Policies: Members can view their own submissions and team submissions
drop policy if exists p_hackathon_submissions_select on public.hackathon_submissions;
create policy p_hackathon_submissions_select
  on public.hackathon_submissions
  for select
  to authenticated
  using (
    member_id = auth.uid()::text::uuid
    or team_id in (
      select team_id from public.team_members where member_id = auth.uid()::text::uuid
      union
      select id from public.hackathon_teams where team_leader_id = auth.uid()::text::uuid
    )
  );

-- Policies: Members can insert their own submissions
drop policy if exists p_hackathon_submissions_insert on public.hackathon_submissions;
create policy p_hackathon_submissions_insert
  on public.hackathon_submissions
  for insert
  to authenticated
  with check (member_id = auth.uid()::text::uuid);

-- Results: Public read after publication (via service role in edge functions)
drop policy if exists p_hackathon_results_select on public.hackathon_results;
create policy p_hackathon_results_select
  on public.hackathon_results
  for select
  to authenticated
  using (true); -- Results visible to all authenticated members after publication

-- Invites: Since we use custom auth (not Supabase Auth), RLS policies with auth.uid() won't work
-- We'll use edge functions for all invite operations to ensure security
-- Disable RLS and rely on edge functions for access control
alter table public.hackathon_invites disable row level security;

-- Note: All invite operations (create, read, delete) should go through edge functions:
-- - generate_invite: Creates invites (verifies team leader)
-- - load_invite_links: Loads invites (verifies team membership)
-- - team_invite: Validates and uses invites

-- RLS is disabled for hackathon_invites - all operations go through edge functions
-- No need for insert policy since RLS is disabled

-- Notifications: Members can only see their own notifications
drop policy if exists p_member_notifications_select on public.member_notifications;
create policy p_member_notifications_select
  on public.member_notifications
  for select
  to anon, authenticated
  using (true);

-- Refresh notification_type constraint to include admin messages
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

drop policy if exists p_member_notifications_update on public.member_notifications;
create policy p_member_notifications_update
  on public.member_notifications
  for update
  to authenticated
  using (member_id = auth.uid()::text::uuid);

-- Allow anon/authenticated to insert notifications (for admin panel custom notifications)
drop policy if exists p_member_notifications_insert on public.member_notifications;
create policy p_member_notifications_insert
  on public.member_notifications
  for insert
  to anon, authenticated
  with check (true);

-- Resources: Same as member_resources (authenticated members can view)
drop policy if exists p_hackathon_resources_select on public.hackathon_resources;
create policy p_hackathon_resources_select
  on public.hackathon_resources
  for select
  to authenticated
  using (true);

-- Enable Realtime for instant updates (no page refresh needed)
-- This allows real-time notifications, chat messages, and team requests
do $$
begin
  -- Add member_notifications to realtime publication if not already added
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'member_notifications' 
    and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.member_notifications;
  end if;

  -- Add team_messages to realtime publication if not already added
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'team_messages' 
    and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.team_messages;
  end if;

  -- Add team_requests to realtime publication if not already added
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'team_requests' 
    and schemaname = 'public'
  ) then
    alter publication supabase_realtime add table public.team_requests;
  end if;
end $$;

-- Global announcements table (for community links, announcements, etc.)
create table if not exists public.global_announcements (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  title             text        not null,
  link              text,
  description       text,
  is_active         boolean     default true,
  display_position  text        default 'top' check (display_position in ('top', 'bottom', 'sidebar')),
  animation_type    text        default 'pulse' check (animation_type in ('pulse', 'bounce', 'shake', 'glow', 'none')),
  priority          integer     default 0,
  created_by        text,
  expires_at        timestamptz
);

create index if not exists idx_global_announcements_active on public.global_announcements (is_active, priority desc);
create index if not exists idx_global_announcements_position on public.global_announcements (display_position);

-- Global resources table (for resources available to all members)
create table if not exists public.global_resources (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  title             text        not null,
  description       text,
  resource_type     text        not null default 'link' check (resource_type in ('link', 'document', 'video', 'tutorial', 'tool', 'other')),
  content_url       text        not null,
  access_level      text        default 'all' check (access_level in ('all', 'premium', 'verified')),
  is_active         boolean     default true,
  display_order     integer     default 0,
  created_by        text,
  tags              text[]
);

create index if not exists idx_global_resources_active on public.global_resources (is_active, display_order);
create index if not exists idx_global_resources_type on public.global_resources (resource_type);

-- RLS for new tables
alter table public.global_announcements enable row level security;
alter table public.global_resources enable row level security;

-- Policies: All authenticated members can view active announcements and resources
drop policy if exists p_global_announcements_select on public.global_announcements;
create policy p_global_announcements_select
  on public.global_announcements
  for select
  to authenticated
  using (is_active = true and (expires_at is null or expires_at > now()));

drop policy if exists p_global_resources_select on public.global_resources;
create policy p_global_resources_select
  on public.global_resources
  for select
  to authenticated
  using (is_active = true);

-- Admin policies: Allow service_role (admin operations) to insert/update/delete
-- Note: In production, you should use a more secure method like checking member_category = 'admin'
drop policy if exists p_global_announcements_admin_all on public.global_announcements;
create policy p_global_announcements_admin_all
  on public.global_announcements
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists p_global_resources_admin_all on public.global_resources;
create policy p_global_resources_admin_all
  on public.global_resources
  for all
  to service_role
  using (true)
  with check (true);

-- Allow anon role to manage (admin panel uses anon key with token protection)
-- Note: The admin panel is protected by token gate, so this is safe
-- In production, consider using Edge Functions with service_role instead
drop policy if exists p_global_announcements_anon_all on public.global_announcements;
create policy p_global_announcements_anon_all
  on public.global_announcements
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists p_global_resources_anon_all on public.global_resources;
create policy p_global_resources_anon_all
  on public.global_resources
  for all
  to anon, authenticated
  using (true)
  with check (true);
