import 'server-only';
import type { TripAccessManagement } from './contracts';

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Explicit projection prevents new/internal bridge fields from reaching the browser. */
export function parseAccessManagement(value: unknown): TripAccessManagement | null {
  if (!object(value) || !Array.isArray(value.people) || !Array.isArray(value.pendingInvitations)) return null;
  const people: TripAccessManagement['people'] = [];
  const pendingInvitations: TripAccessManagement['pendingInvitations'] = [];
  for (const row of value.people) {
    if (!object(row) || !uuid(row.membershipId)
      || !(row.email === null || typeof row.email === 'string')
      || !['owner','editor','viewer'].includes(String(row.role)) || typeof row.isCurrentUser !== 'boolean') return null;
    people.push({membershipId:row.membershipId,email:row.email,
      role:row.role as TripAccessManagement['people'][number]['role'],isCurrentUser:row.isCurrentUser});
  }
  for (const row of value.pendingInvitations) {
    if (!object(row) || !uuid(row.invitationId) || typeof row.email !== 'string'
      || !['editor','viewer'].includes(String(row.role)) || row.status !== 'pending'
      || !date(row.createdAt) || !date(row.expiresAt)) return null;
    pendingInvitations.push({invitationId:row.invitationId,email:row.email,
      role:row.role as 'editor' | 'viewer',status:'pending',createdAt:row.createdAt,expiresAt:row.expiresAt});
  }
  return {people,pendingInvitations};
}
