import 'server-only';
import { createTripInvitationToken, hashTripInvitationToken } from '@/lib/tripInvitationToken';
import { DeliveryError, type InvitationDelivery, type DeliveryReceipt } from './delivery';
import type { LimitOperation } from './rateLimit';
import type { AccessRemovalResult, InvitationSummary, InvitationView } from './contracts';
import { parseAccessManagement } from './management';

export type InvitationOperation = 'create' | 'resend' | 'revoke' | 'inspect' | 'accept' | 'remove_access' | 'list_access';
export type BridgeCall = (actor: string, operation: InvitationOperation | 'delivery_context' | 'delivery_start' | 'delivery_finish', input: Record<string, string>) => Promise<unknown>;
export class InvitationFailure extends Error {
  constructor(public code: string, public status: number, public retryAfter?:number) { super(code); }
}
function parseInput(operation: InvitationOperation, body: Record<string, unknown>): Record<string,string> {
  const keys = operation === 'create' ? ['tripId','email','role']
    : operation === 'list_access' ? ['tripId']
    : operation === 'remove_access' ? ['tripId','membershipId']
    : operation === 'resend' || operation === 'revoke' ? ['tripId','invitationId'] : ['token'];
  if (Object.keys(body).some(key => !keys.includes(key)) || keys.some(key =>
    key !== 'role' && (typeof body[key] !== 'string' || !(body[key] as string).length))) {
    throw new InvitationFailure('invalid_request',400);
  }
  if ('tripId' in body && (typeof body.tripId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(body.tripId))) throw new InvitationFailure('invalid_request',400);
  if ('invitationId' in body && (typeof body.invitationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.invitationId))) throw new InvitationFailure('invalid_request',400);
  if (operation === 'remove_access' && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(String(body.membershipId))) throw new InvitationFailure('invalid_request',400);
  if (operation === 'create' && ((body.role !== undefined && body.role !== 'viewer' && body.role !== 'editor')
    || typeof body.email !== 'string' || body.email.length > 254)) throw new InvitationFailure('invalid_request',400);
  return { ...body, ...(operation === 'create' ? { role: body.role ?? 'viewer' } : {}) } as Record<string,string>;
}

/** actor must come from server auth.getUser(), never request JSON or decoded JWT claims. */
export async function removeTripAccess(call: BridgeCall, actor: string | null, body: Record<string,unknown>): Promise<AccessRemovalResult> {
  if (!actor) throw new InvitationFailure('not_authenticated',401);
  const input = parseInput('remove_access',body);
  const result = await call(actor,'remove_access',input);
  if (!result || typeof result !== 'object' || !('outcome' in result) || result.outcome !== 'access_removed') {
    throw new InvitationFailure('invitation_failed',503);
  }
  return {outcome:'access_removed'};
}

export async function runInvitationOperation(deps: { call: BridgeCall; delivery: InvitationDelivery; origin: string; provider:'local'|'resend'; limit:LimitOperation },
  actor: string | null, operation: InvitationOperation, body: Record<string,unknown>) {
  // Management reads do not consume durable mutation/delivery rate buckets.
  if (operation === 'list_access') {
    if (!actor) throw new InvitationFailure('not_authenticated',401);
    const input = parseInput(operation,body);
    const snapshot = parseAccessManagement(await deps.call(actor,operation,input));
    if (!snapshot) throw new InvitationFailure('invitation_failed',503);
    return snapshot;
  }
  if (actor) await deps.limit(actor,operation);
  if (operation === 'remove_access') return removeTripAccess(deps.call,actor,body);
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
  const context=await deps.call(actor,'delivery_context',input) as {email:string};
  await deps.limit(actor,operation,input.tripId,context.email);
  const token = createTripInvitationToken();
  const summary = await deps.call(actor,operation,{ ...input, tokenHash:token.tokenHash }) as InvitationSummary;
  if (summary.status !== 'pending') return { invitation:summary, delivery:'not_sent' };
  // Persist/rotate first; never retain a raw token for retries. Every resend rotates again.
  const attempt={tripId:input.tripId,invitationId:summary.id,attemptId:summary.deliveryAttemptId,tokenHash:token.tokenHash};
  const started=await deps.call(actor,'delivery_start',{...attempt,provider:deps.provider}) as {updated:boolean};
  if (!started.updated) return {invitation:summary,delivery:'not_sent'};
  let receipt:DeliveryReceipt|undefined;
  let state='sent'; let failureCode:string|undefined;
  try {
    receipt=await deps.delivery.deliver({ email:summary.email, tripName:summary.tripName, role:summary.role,
      expiresAt:summary.expiresAt, acceptanceUrl:new URL(`/invite#${token.rawToken}`,deps.origin).toString() },summary.deliveryAttemptId);
  } catch (error) {
    failureCode=error instanceof DeliveryError ? error.code : 'provider_unknown';
    state=failureCode==='provider_unknown' ? 'unknown' : 'failed';
  }
  try {
    const finished=await deps.call(actor,'delivery_finish',{...attempt,state,
      ...(failureCode ? {failureCode} : {}),...(receipt?.providerMessageId ? {providerMessageId:receipt.providerMessageId} : {})}) as {updated:boolean};
    if (!finished.updated) return {invitation:{...summary,deliveryState:'unknown'},delivery:'unknown'};
  } catch { return {invitation:{...summary,deliveryState:'unknown'},delivery:'unknown'}; }
  return {invitation:{...summary,deliveryState:state},delivery:receipt?.status??state};
}
