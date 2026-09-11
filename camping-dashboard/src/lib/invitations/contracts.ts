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
  deliveryAttemptId: string;
  deliveryState: string;
  id: string;
  email: string;
  role: 'viewer' | 'editor';
  status: string;
  expiresAt: string;
  tripName: string;
}
/** Only the token-free invitation route may override the ordinary sign-out destination. */
export function getInvitationReturnPath(value?: string): string | null {
  return value === '/invite' ? value : null;
}
