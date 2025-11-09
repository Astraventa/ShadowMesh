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
  username text not null unique,
  two_factor_secret text,
  two_factor_enabled boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS for admin_settings (only accessible via edge functions with admin token)
alter table public.admin_settings enable row level security;

-- Policy: Only service role can access (edge functions will use service role)
create policy p_admin_settings_service_role
  on public.admin_settings
  for all
  to service_role
  using (true)
  with check (true);

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
