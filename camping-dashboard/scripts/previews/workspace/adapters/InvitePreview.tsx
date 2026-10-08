import { UserPlus } from 'lucide-react';

/** Resting product appearance only: no provider, permission checks, or handler. */
export function InvitePreview() {
  return <span className="trip-access-invite">
    <UserPlus size={16} strokeWidth={2} aria-hidden="true" />Invite
  </span>;
}
