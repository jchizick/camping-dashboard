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
/** Idempotent completion; does not disclose whether the target membership existed. */
export interface AccessRemovalResult { outcome: 'access_removed' }
/** Owner-only, token-free management snapshot. Null email means identity unavailable. */
export interface TripAccessManagement {
  people: Array<{
    membershipId: string;
    email: string | null;
    role: 'owner' | 'editor' | 'viewer';
    isCurrentUser: boolean;
  }>;
  pendingInvitations: Array<{
    invitationId: string;
    email: string;
    role: 'editor' | 'viewer';
    status: 'pending';
    createdAt: string;
    expiresAt: string;
  }>;
}
/** Only the token-free invitation route may override the ordinary sign-out destination. */
export function getInvitationReturnPath(value?: string): string | null {
  return value === '/invite' ? value : null;
}
