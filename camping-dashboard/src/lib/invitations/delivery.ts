import 'server-only';

export interface InvitationMessage {
  email: string;
  tripName: string;
  role: 'viewer' | 'editor';
  expiresAt: string;
  acceptanceUrl: string;
}
export interface InvitationDelivery { deliver(message: InvitationMessage): Promise<void> }

export function localInvitationsEnabled() {
  return process.env.NODE_ENV !== 'production' && !process.env.VERCEL
    && process.env.TRIP_INVITATIONS_LOCAL === 'true';
}

// Explicit, bounded, process-local test sink. No API reads this; never log its contents.
const messages: InvitationMessage[] = [];
export function takeLocalInvitationMessages(): InvitationMessage[] {
  if (!localInvitationsEnabled()) throw new Error('Delivery unavailable');
  return messages.splice(0);
}
export const localInvitationDelivery: InvitationDelivery = {
  async deliver(message) {
    if (!localInvitationsEnabled()) throw new Error('Delivery unavailable');
    if (messages.length >= 20) messages.shift();
    messages.push({ ...message });
  },
};
