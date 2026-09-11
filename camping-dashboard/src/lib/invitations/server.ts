import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requiredEnvironmentVariable } from '@/lib/env';
import type { Database } from '@/types/database';
import { InvitationFailure, type BridgeCall } from './service';

// Lazy construction: disabled production routes/builds do not require privileged credentials.
export const callInvitationBridge: BridgeCall = async (actor,operation,input) => {
  const client = createClient<Database>(
    requiredEnvironmentVariable('NEXT_PUBLIC_SUPABASE_URL',process.env.NEXT_PUBLIC_SUPABASE_URL),
    requiredEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY',process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth:{ persistSession:false, autoRefreshToken:false }, global:{ fetch:(url,init) => fetch(url,{...init,cache:'no-store'}) } }
  );
  const {data,error} = await client.rpc('trip_invitation_bridge',{p_actor:actor,p_operation:operation,p_input:input});
  // Never surface/log raw Supabase errors: they may contain SQL parameters or hashes.
  if (error) {
    const code = error.code === '42501' ? 'not_authorized' : error.code === '23505' ? 'invitation_pending'
      : error.code === '22023' || error.code === '22P02' ? 'invalid_request' : error.code === 'P0002' ? 'unavailable' : 'invitation_failed';
    throw new InvitationFailure(code,code === 'not_authorized' ? 403 : code === 'invitation_failed' ? 503 : 400);
  }
  return data;
};
