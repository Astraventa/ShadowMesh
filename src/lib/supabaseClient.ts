import { createClient } from '@supabase/supabase-js';

// Supabase client configured for ShadowMesh
// For production, prefer storing these in env vars.
export const SUPABASE_URL = 'https://cnqxivqxueglihpubeob.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNucXhpdnF4dWVnbGlocHViZW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NzM4NDgsImV4cCI6MjA3NzM0OTg0OH0.jEvuccxZ7Sfw2b_6Rzu8xZ6TFuAvlvdD901n5d_-uLc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
