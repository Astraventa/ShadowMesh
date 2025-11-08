-- Add password field to members table for secure portal access
-- This prevents unauthorized access if someone sees another user's code

-- Add password_hash column (stores bcrypt hash)
alter table if exists public.members 
  add column if not exists password_hash text;

-- Add area_of_interest column if it doesn't exist (from join_applications)
alter table if exists public.members 
  add column if not exists area_of_interest text;

-- Add secret_code column if it doesn't exist
alter table if exists public.members 
  add column if not exists secret_code text;

-- Create index for secret_code lookups
create index if not exists idx_members_secret_code on public.members(secret_code);

-- Create index for password_hash lookups
create index if not exists idx_members_password_hash on public.members(password_hash) where password_hash is not null;

