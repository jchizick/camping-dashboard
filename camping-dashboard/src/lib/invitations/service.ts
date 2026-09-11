import 'server-only';
import { createTripInvitationToken, hashTripInvitationToken } from '@/lib/tripInvitationToken';
import type { InvitationDelivery } from './delivery';
import type { InvitationSummary, InvitationView } from './contracts';

export type InvitationOperation = 'create' | 'resend' | 'revoke' | 'inspect' | 'accept';
export type BridgeCall = (actor: string, operation: InvitationOperation, input: Record<string, string>) => Promise<unknown>;
export class InvitationFailure extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
function parseInput(operation: InvitationOperation, body: Record<string, unknown>): Record<string,string> {
  const keys = operation === 'create' ? ['tripId','email','role']
    : operation === 'resend' || operation === 'revoke' ? ['tripId','invitationId'] : ['token'];
  if (Object.keys(body).some(key => !keys.includes(key)) || keys.some(key =>
    key !== 'role' && (typeof body[key] !== 'string' || !(body[key] as string).length))) {
    throw new InvitationFailure('invalid_request',400);
  }
  if ('tripId' in body && (typeof body.tripId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(body.tripId))) throw new InvitationFailure('invalid_request',400);
  if ('invitationId' in body && (typeof body.invitationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.invitationId))) throw new InvitationFailure('invalid_request',400);
  if (operation === 'create' && ((body.role !== undefined && body.role !== 'viewer' && body.role !== 'editor')
    || typeof body.email !== 'string' || body.email.length > 254)) throw new InvitationFailure('invalid_request',400);
  return { ...body, ...(operation === 'create' ? { role: body.role ?? 'viewer' } : {}) } as Record<string,string>;
}

export async function runInvitationOperation(deps: { call: BridgeCall; delivery: InvitationDelivery; origin: string },
  actor: string | null, operation: InvitationOperation, body: Record<string,unknown>) {
  const input = parseInput(operation, body);
  if (operation === 'inspect' || operation === 'accept') {
    if (operation === 'accept' && !actor) throw new InvitationFailure('not_authenticated',401);
    let tokenHash: string;
    try { tokenHash = hashTripInvitationToken(input.token); }
    catch { return { outcome: 'unavailable' } satisfies InvitationView; }
    if (!actor && operation === 'inspect') return { outcome: 'signed_out' } satisfies InvitationView;
    if (!actor) throw new InvitationFailure('not_authenticated',401);
    return await deps.call(actor,operation,{ tokenHash }) as InvitationView;
  }
  if (!actor) throw new InvitationFailure('not_authenticated',401);
  if (operation === 'revoke') return deps.call(actor,operation,input);
  const token = createTripInvitationToken();
  const summary = await deps.call(actor,operation,{ ...input, tokenHash:token.tokenHash }) as InvitationSummary;
  if (summary.status !== 'pending') return { invitation:summary, delivery:'not_sent' };
  // Persist/rotate first; never retain a raw token for retries. Every resend rotates again.
  try {
    await deps.delivery.deliver({ email:summary.email, tripName:summary.tripName, role:summary.role,
      expiresAt:summary.expiresAt, acceptanceUrl:new URL(`/invite/${token.rawToken}`,deps.origin).toString() });
    return { invitation:summary, delivery:'captured_locally' };
  } catch {
    return { invitation:summary, delivery:'unavailable' };
  }
}
