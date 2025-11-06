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
  status             text not null default 'active'
);

create index if not exists idx_members_created_at on public.members (created_at desc);
create index if not exists idx_members_email on public.members (email);

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
end$$;

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

-- Allow anonymous INSERTs only. No SELECT/UPDATE/DELETE.
-- (Supabase anon key can insert, but cannot read data.)

drop policy if exists p_join_insert on public.join_applications;
create policy p_join_insert
  on public.join_applications
  for insert
  to anon
  with check (true);

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
end$$;
