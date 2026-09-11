import 'server-only';
import { localInvitationsEnabled } from './delivery';

export interface InvitationConfig {
  provider: 'local' | 'resend'; origin: string; from: string; replyTo?: string;
  apiKey: string; rateSecret: string;
}
const email = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export function invitationConfig(): InvitationConfig | null {
  const local = localInvitationsEnabled();
  if (!local && process.env.TRIP_INVITATIONS_ENABLED !== 'true') return null;
  try {
    const origin = new URL(process.env.TRIP_INVITATIONS_ORIGIN ?? '');
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
      || (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))) return null;
    if (local) return { provider:'local', origin:origin.origin, from:'Field Protocol <fixture@example.test>', apiKey:'', rateSecret:'local-only-invitation-rate-test-key' };
    // Real delivery runs only in an explicitly configured Vercel preview/production deployment.
    if (process.env.VERCEL !== '1' || !['preview','production'].includes(process.env.VERCEL_ENV ?? '')
      || process.env.TRIP_INVITATIONS_PROVIDER !== 'resend') return null;
    const address = process.env.TRIP_INVITATIONS_FROM_ADDRESS ?? '';
    const name = process.env.TRIP_INVITATIONS_SENDER_NAME ?? 'Field Protocol';
    const replyTo = process.env.TRIP_INVITATIONS_REPLY_TO;
    const apiKey = process.env.RESEND_API_KEY ?? '';
    const rateSecret = process.env.TRIP_INVITATIONS_RATE_SECRET ?? '';
    if (!email.test(address) || address.length > 254 || /[\r\n<>]/.test(name) || !name.trim() || name.length > 80
      || (replyTo && !email.test(replyTo)) || !/^re_[A-Za-z0-9_-]{16,}$/.test(apiKey)
      || rateSecret.length < 32 || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
    return { provider:'resend', origin:origin.origin, from:`${name} <${address}>`, replyTo, apiKey, rateSecret };
  } catch { return null; }
}
