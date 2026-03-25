// ============================================================
// supabaseAdmin.ts — Server-only Supabase client (service_role)
// ⚠️  NEVER import this from client components / browser code
// Used only inside Next.js API routes (server-side)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
