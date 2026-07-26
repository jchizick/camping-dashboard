// ============================================================
// supabaseAdmin.ts — Server-only Supabase client (service_role)
// ⚠️  NEVER import this from client components / browser code
// Used only inside Next.js API routes (server-side)
// ============================================================

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { requiredEnvironmentVariable } from './env';

const supabaseUrl = requiredEnvironmentVariable(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL
);
const serviceRoleKey = requiredEnvironmentVariable(
  'SUPABASE_SERVICE_ROLE_KEY',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
