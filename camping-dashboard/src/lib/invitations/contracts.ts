export type InvitationOutcome = 'pending' | 'accepted' | 'already_accepted' | 'already_member'
  | 'identity_mismatch' | 'expired' | 'revoked' | 'unavailable' | 'signed_out';
export interface InvitationView {
  outcome: InvitationOutcome;
  trip_id?: string | null;
  tripName?: string;
  role?: 'viewer' | 'editor';
  expiresAt?: string;
  maskedEmail?: string;
}
export interface InvitationSummary {
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  status: string;
  expiresAt: string;
  tripName: string;
}
/** Only opaque invitation paths may override the ordinary sign-out destination. */
export function getInvitationReturnPath(value?: string): string | null {
  return value && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
