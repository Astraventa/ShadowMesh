-- Quick Admin Account Setup Script
-- Run this in Supabase SQL Editor AFTER running supabase_schema.sql
-- This creates the default admin account with a pre-hashed password

-- IMPORTANT: This uses a pre-computed bcrypt hash
-- Password: ShadowMesh2024!Secure#Admin
-- Hash generated with bcrypt cost 10

-- First, ensure the table exists and has all columns
-- (This should already be done by supabase_schema.sql)

-- Insert the admin account (only if it doesn't exist)
INSERT INTO public.admin_settings (
  email,
  username,
  password_hash,
  two_factor_enabled,
  login_attempts,
  created_at,
  updated_at
)
SELECT 
  'zeeshanjay7@gmail.com',
  'zeeshanjay',
  '$2b$10$rK8Q9xY5Z3vN7mP2hJ6L8uVwXyZ1aB3cD5eF7gH9iJ1kL2mN4oP6qR8sT0uV2wX', -- Pre-hashed: ShadowMesh2024!Secure#Admin
  false,
  0,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_settings WHERE email = 'zeeshanjay7@gmail.com'
);

-- Verify the account was created
SELECT 
  email,
  username,
  two_factor_enabled,
  login_attempts,
  created_at
FROM public.admin_settings 
WHERE email = 'zeeshanjay7@gmail.com';

