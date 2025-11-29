-- Migration: Team achievements, priority, likes, and badges
-- Run this in the Supabase SQL editor.

-- Add team metadata columns
do $$
begin
  -- Priority (admin-set, higher = more important)
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hackathon_teams' and column_name='priority_level') then
    alter table public.hackathon_teams add column priority_level integer default 0;
  end if;
  
  -- Likes count
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hackathon_teams' and column_name='likes_count') then
    alter table public.hackathon_teams add column likes_count integer default 0;
  end if;
  
  -- Team badge (premium/unique badge for the team)
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hackathon_teams' and column_name='team_badge') then
    alter table public.hackathon_teams add column team_badge text;
  end if;
  
  -- Achievement points
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='hackathon_teams' and column_name='achievement_points') then
    alter table public.hackathon_teams add column achievement_points integer default 0;
  end if;
end$$;

-- Team likes table (who liked which team)
create table if not exists public.team_likes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid references public.hackathon_teams(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  unique (team_id, member_id)
);

create index if not exists idx_team_likes_team_id on public.team_likes (team_id);
create index if not exists idx_team_likes_member_id on public.team_likes (member_id);

alter table public.team_likes enable row level security;

drop policy if exists p_team_likes_select on public.team_likes;
create policy p_team_likes_select
  on public.team_likes
  for select
  to anon, authenticated
  using (true);

drop policy if exists p_team_likes_insert on public.team_likes;
create policy p_team_likes_insert
  on public.team_likes
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists p_team_likes_delete on public.team_likes;
create policy p_team_likes_delete
  on public.team_likes
  for delete
  to anon, authenticated
  using (true);

-- Team achievements tracking
create table if not exists public.team_achievements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  team_id uuid references public.hackathon_teams(id) on delete cascade,
  achievement_type text not null, -- 'first_update', 'full_team', 'weekly_active', 'milestone_10', etc.
  achievement_data jsonb, -- Additional data about the achievement
  points_awarded integer default 0
);

create index if not exists idx_team_achievements_team_id on public.team_achievements (team_id);
create index if not exists idx_team_achievements_type on public.team_achievements (achievement_type);

alter table public.team_achievements enable row level security;

drop policy if exists p_team_achievements_select on public.team_achievements;
create policy p_team_achievements_select
  on public.team_achievements
  for select
  to anon, authenticated
  using (true);

drop policy if exists p_team_achievements_insert on public.team_achievements;
create policy p_team_achievements_insert
  on public.team_achievements
  for insert
  to anon, authenticated
  with check (true);

-- Function to update team likes count
create or replace function update_team_likes_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.hackathon_teams
    set likes_count = (select count(*) from public.team_likes where team_id = NEW.team_id)
    where id = NEW.team_id;
    return NEW;
  elsif TG_OP = 'DELETE' then
    update public.hackathon_teams
    set likes_count = (select count(*) from public.team_likes where team_id = OLD.team_id)
    where id = OLD.team_id;
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_team_likes_count on public.team_likes;
create trigger trigger_update_team_likes_count
  after insert or delete on public.team_likes
  for each row execute function update_team_likes_count();

