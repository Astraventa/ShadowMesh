import { createClient } from '@supabase/supabase-js';

// Supabase client configured for ShadowMesh
// Values are provided via Vite environment variables
export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Warn in dev if env vars are missing
  // eslint-disable-next-line no-console
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Configure your environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
