// ============================================================
// Supabase Client — Singleton Browser/Edge Client
// Used by all data fetching functions. Never import service_role key here.
// ============================================================

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { requiredEnvironmentVariable } from './env';

const supabaseUrl = requiredEnvironmentVariable(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
const supabaseAnonKey = requiredEnvironmentVariable(
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
