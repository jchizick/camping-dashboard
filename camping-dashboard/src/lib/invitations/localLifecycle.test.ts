import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { runInvitationOperation, type BridgeCall } from './service';
import type { InvitationMessage } from './delivery';
import { hashTripInvitationToken } from '../tripInvitationToken';

// Explicit opt-in; fixed disposable Docker target, no production URL/credentials.
const enabled = process.env.INVITATION_LOCAL_DB_TEST === 'true';
const sql = (query:string) => execFileSync('docker',['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
  {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const quote = (value:string) => `'${value.replaceAll("'","''")}'`;
const owner = '00000000-0000-0000-0000-000000000871';
const invitee = '00000000-0000-0000-0000-000000000872';
const wrong = '00000000-0000-0000-0000-000000000873';
const tripId = 'phase2-runtime-fixture';
const cleanup = () => sql(`begin; delete from public.trips where id='${tripId}'; delete from auth.users where id in ('${owner}','${invitee}','${wrong}'); commit;`);
const call: BridgeCall = async (actor,operation,input) => JSON.parse(sql(`begin; set local role service_role;
 select public.trip_invitation_bridge(${quote(actor)}::uuid,${quote(operation)},${quote(JSON.stringify(input))}::jsonb); commit;`));
const messages: InvitationMessage[] = [];
const deps = {call,origin:'http://localhost:3000',delivery:{async deliver(message:InvitationMessage){messages.push(message);}}};
const run = (actor:string|null,operation:Parameters<typeof runInvitationOperation>[2],body:Record<string,unknown>) => runInvitationOperation(deps,actor,operation,body);
const deliveredToken = () => new URL(messages.at(-1)!.acceptanceUrl).pathname.split('/').pop()!;
beforeAll(()=>{
  if (!enabled) return;
  cleanup();
  sql(`begin;
    insert into auth.users(id,email,email_confirmed_at) values ('${owner}','owner-phase2@example.test',now()),('${invitee}','invitee-phase2@example.test',now()),('${wrong}','wrong-phase2@example.test',now());
    insert into public.trips(id,name) values ('${tripId}','Synthetic Phase 2 trip');
    insert into public.trip_members(trip_id,user_id,role) values ('${tripId}','${owner}','owner'); commit;`);
});
afterAll(()=>{if(enabled) cleanup();});

it.skipIf(!enabled)('proves fake delivery → read-only check → explicit acceptance → removal → no regrant against the real bridge',async()=>{
  const created = await run(owner,'create',{tripId,email:' INVITEE-PHASE2@example.test ',role:'editor'});
  expect(created).toMatchObject({delivery:'captured_locally',invitation:{email:'invitee-phase2@example.test'}});
  const token = deliveredToken();
  expect(await run(null,'inspect',{token})).toEqual({outcome:'signed_out'});
  expect(await run(wrong,'inspect',{token})).toEqual({outcome:'identity_mismatch',maskedEmail:'i***@example.test'});
  expect(await run(invitee,'inspect',{token})).toMatchObject({outcome:'pending',role:'editor'});
  expect(sql(`select status from public.trip_invitations where trip_id='${tripId}'`)).toBe('pending');
  expect(sql(`select count(*) from public.trip_members where trip_id='${tripId}'`)).toBe('1');
  expect(await run(wrong,'accept',{token})).toEqual({outcome:'identity_mismatch',trip_id:null});
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'accepted',trip_id:tripId});
  expect(sql(`select role from public.trip_members where trip_id='${tripId}' and user_id='${invitee}'`)).toBe('editor');
  expect(sql(`select count(*) from public.crew_members where trip_id='${tripId}'`)).toBe('0');
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'already_accepted',trip_id:tripId});
  sql(`begin; select set_config('request.jwt.claim.sub','${owner}',true);
    select app_private.remove_trip_access('${tripId}',(select id from public.trip_members where trip_id='${tripId}' and user_id='${invitee}')); commit;`);
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'already_accepted',trip_id:null});
  expect(await run(invitee,'inspect',{token})).toEqual({outcome:'already_accepted',trip_id:null});
  expect(sql(`select count(*) from public.trip_members where trip_id='${tripId}' and user_id='${invitee}'`)).toBe('0');
});

it.skipIf(!enabled)('rotates, rejects unauthorized owners and old URLs, revokes and handles expiry/deletion',async()=>{
  const created = await run(owner,'create',{tripId,email:'invitee-phase2@example.test'}) as {invitation:{id:string}};
  const old = deliveredToken();const invitationId = created.invitation.id;
  await expect(run(wrong,'resend',{tripId,invitationId})).rejects.toThrow();
  await run(owner,'resend',{tripId,invitationId});const token = deliveredToken();
  expect(token).not.toBe(old);
  expect(await run(invitee,'accept',{token:old})).toEqual({outcome:'unavailable',trip_id:null});
  await expect(run(wrong,'revoke',{tripId,invitationId})).rejects.toThrow();
  expect(await run(owner,'revoke',{tripId,invitationId})).toEqual({status:'revoked'});
  expect(await run(owner,'revoke',{tripId,invitationId})).toEqual({status:'revoked'});
  expect(await run(invitee,'inspect',{token})).toEqual({outcome:'revoked'});
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'revoked',trip_id:null});
  await run(owner,'create',{tripId,email:'invitee-phase2@example.test'});const expired = deliveredToken();
  sql(`update public.trip_invitations set expires_at=clock_timestamp() where token_hash='${hashTripInvitationToken(expired)}'`);
  expect(await run(invitee,'inspect',{token:expired})).toEqual({outcome:'expired'});
  expect(sql(`select status from public.trip_invitations where token_hash='${hashTripInvitationToken(expired)}'`)).toBe('pending');
  expect(await run(invitee,'accept',{token:expired})).toEqual({outcome:'expired',trip_id:null});
});

it.skipIf(!enabled)('preserves independent roles and rejects an inviter who loses ownership',async()=>{
  await run(owner,'create',{tripId,email:'invitee-phase2@example.test',role:'editor'});const token = deliveredToken();
  sql(`insert into public.trip_members(trip_id,user_id,role) values ('${tripId}','${invitee}','viewer')`);
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'already_member',trip_id:tripId});
  expect(sql(`select role from public.trip_members where trip_id='${tripId}' and user_id='${invitee}'`)).toBe('viewer');
  sql(`begin; update public.trip_members set role='owner' where trip_id='${tripId}' and user_id='${wrong}';
    insert into public.trip_members(trip_id,user_id,role) values ('${tripId}','${wrong}','owner') on conflict do nothing;
    update public.trip_members set role='editor' where trip_id='${tripId}' and user_id='${owner}'; commit;`);
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'unavailable',trip_id:null});
  expect(await run(invitee,'inspect',{token})).toEqual({outcome:'unavailable'});
  sql(`delete from public.trips where id='${tripId}'`);
  expect(await run(invitee,'inspect',{token})).toEqual({outcome:'unavailable'});
  expect(await run(invitee,'accept',{token})).toEqual({outcome:'unavailable',trip_id:null});
});

it.skipIf(!enabled)('denies ordinary roles, restores claims, and keeps private schemas unexposed',()=>{
  for (const role of ['anon','authenticated']) expect(()=>sql(`begin; set local role ${role}; select public.trip_invitation_bridge('${owner}','inspect','{}'); rollback;`)).toThrow();
  expect(sql(`select has_function_privilege('service_role','public.trip_invitation_bridge(uuid,text,jsonb)','execute')`)).toBe('t');
  expect(sql(`begin; set local role service_role; set local request.jwt.claim.sub='${wrong}';
    select public.trip_invitation_bridge('${owner}','inspect','{}'); select current_setting('request.jwt.claim.sub'); rollback;`).split('\n').at(-1)).toBe(wrong);
});
