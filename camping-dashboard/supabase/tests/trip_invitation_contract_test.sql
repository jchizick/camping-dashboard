begin;
select no_plan();

-- Fictional identities; every fixture is rolled back. No external services.
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'invite-' || n || '@example.test', case when n = 908 then null else now() end,
  case when n = 908 then '{"email_verified":true}'::jsonb else '{}'::jsonb end
from generate_series(901,915) n;
insert into public.trips(id,name) values ('invite-a','Invitation A'),('invite-b','Invitation B');
insert into public.trip_members(trip_id,user_id,role) values
 ('invite-a','00000000-0000-0000-0000-000000000901','owner'),
 ('invite-a','00000000-0000-0000-0000-000000000902','editor'),
 ('invite-a','00000000-0000-0000-0000-000000000903','viewer'),
 ('invite-b','00000000-0000-0000-0000-000000000904','owner');
create function pg_temp.actor(n integer) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-' || lpad(n::text,12,'0'), 'role','authenticated')::text,true);
end;
$$;
create temporary table invitations_test_ids(name text primary key, id uuid);

select is(app_private.normalize_invitation_email('  Alice+Lake@Example.Test  '), 'alice+lake@example.test', 'trim/lowercase only');
select is(app_private.normalize_invitation_email('a.lice@example.test'), 'a.lice@example.test', 'dots preserved');
select ok((select relrowsecurity from pg_class where oid='public.trip_invitations'::regclass), 'invitation RLS enabled');
select is((select count(*)::int from pg_policies where tablename='trip_invitations' and schemaname='public'), 0, 'no invitation SELECT or mutation policies');
select ok(not has_table_privilege('authenticated','public.trip_invitations','SELECT'), 'authenticated cannot read hashes');
select ok(not has_table_privilege('service_role','public.trip_invitations','SELECT'), 'service uses projection, not table');
select ok(not has_table_privilege('anon','public.trip_invitations','SELECT'), 'anonymous cannot list invitations');
select ok(not has_table_privilege('authenticated','public.trip_members','INSERT,UPDATE,DELETE,TRUNCATE'), 'no direct membership writes');
select ok(has_table_privilege('authenticated','public.trip_members','SELECT'), 'existing membership read retained');
select ok(not has_function_privilege('authenticated','app_private.create_trip_invitation(text,text,text,text)','EXECUTE'), 'hash creation contract is server-only');
select ok(not has_function_privilege('anon','app_private.accept_trip_invitation(text)','EXECUTE'), 'anonymous cannot accept');
select ok(has_function_privilege('service_role','app_private.accept_trip_invitation(text)','EXECUTE'), 'trusted server may accept');
select ok(not has_function_privilege('service_role','app_private.lock_owned_trip(text)','EXECUTE'), 'internal lock helper not exposed');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where pronamespace='app_private'::regnamespace and proname in ('create_trip_invitation','accept_trip_invitation','remove_trip_access')), 'definer functions fix search_path');

select pg_temp.actor(902);
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test',repeat('a',64))$$,'42501','Owner access required','editor denied');
select pg_temp.actor(903);
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test',repeat('a',64))$$,'42501','Owner access required','viewer denied');
select pg_temp.actor(904);
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test',repeat('a',64))$$,'42501','Owner access required','other-trip owner denied');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test',repeat('a',64))$$,'42501','Authentication required','missing session denied');
select pg_temp.actor(901);
select throws_ok($$select app_private.create_trip_invitation('invite-a','bad',repeat('a',64))$$,'22023','Invalid invitation email','malformed email');
select throws_ok($$select app_private.create_trip_invitation('invite-a',null,repeat('a',64))$$,'22023','Invalid invitation email','missing email');
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test',repeat('a',64),'owner')$$,'22023','Invalid invitation role','cannot invite owner');
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-901@example.test',repeat('a',64))$$,'22023','Cannot invite yourself','self invitation');
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-902@example.test',repeat('a',64))$$,'22023','Already a trip member','existing member');
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test','plaintext')$$,'23514',null,'only digest format accepted');
insert into invitations_test_ids values ('viewer',app_private.create_trip_invitation('invite-a','  INVITE-905@EXAMPLE.TEST  ',repeat('a',64)));
select is((select role from public.trip_invitations where token_hash=repeat('a',64)),'viewer','default viewer');
select is((select expires_at-created_at from public.trip_invitations where token_hash=repeat('a',64)),interval '7 days','seven day expiry');
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-905@example.test',repeat('b',64))$$,'23505','Invitation already pending','normalized pending uniqueness');
select throws_ok($$select app_private.create_trip_invitation('invite-a','invite-906@example.test',repeat('a',64))$$,'23505',null,'token hash unique');
insert into invitations_test_ids values ('editor',app_private.create_trip_invitation('invite-a','invite-906@example.test',repeat('b',64),'editor'));
select ok(not (select to_jsonb(s) ? 'token_hash' from app_private.list_trip_invitations('invite-a') s limit 1),'summary omits token hash');
select is((select count(*)::int from app_private.list_trip_access('invite-a')),3,'member summary restricted to trip');
select is((select count(*)::int from app_private.list_trip_access('invite-a') where is_current_user),1,'summary identifies current user');
select pg_temp.actor(904);
select throws_ok($$select * from app_private.list_trip_access('invite-a')$$,'42501','Owner access required','cross-trip directory denied');
select throws_ok($$select app_private.revoke_trip_invitation('invite-b',(select id from invitations_test_ids where name='viewer'))$$,'P0002','Invitation unavailable','cross-trip invitation denied');
select pg_temp.actor(902);
select throws_ok($$select * from app_private.list_trip_invitations('invite-a')$$,'42501','Owner access required','editor cannot list');
select throws_ok($$select app_private.rotate_trip_invitation('invite-a',(select id from invitations_test_ids where name='viewer'),repeat('c',64))$$,'42501','Owner access required','editor cannot rotate');
select throws_ok($$select app_private.revoke_trip_invitation('invite-a',(select id from invitations_test_ids where name='viewer'))$$,'42501','Owner access required','editor cannot revoke');

select pg_temp.actor(907);
select is((select outcome from app_private.accept_trip_invitation(repeat('a',64))),'identity_mismatch','wrong account rejected');
select pg_temp.actor(901);
insert into invitations_test_ids values ('unverified',app_private.create_trip_invitation('invite-a','invite-908@example.test',repeat('d',64)));
select pg_temp.actor(908);
select is((select outcome from app_private.accept_trip_invitation(repeat('d',64))),'identity_mismatch','unverified email rejected despite metadata');
update auth.users set email_confirmed_at=now(), email=null where id='00000000-0000-0000-0000-000000000908';
select is((select outcome from app_private.accept_trip_invitation(repeat('d',64))),'identity_mismatch','missing email rejected');
update auth.users set email='changed@example.test' where id='00000000-0000-0000-0000-000000000908';
select is((select outcome from app_private.accept_trip_invitation(repeat('d',64))),'identity_mismatch','changed email rejected');
select pg_temp.actor(901);
select is(app_private.rotate_trip_invitation('invite-a',(select id from invitations_test_ids where name='viewer'),repeat('c',64)),'rotated','owner rotates');
select throws_ok($$select app_private.rotate_trip_invitation('invite-a',(select id from invitations_test_ids where name='viewer'),repeat('c',64))$$,'22023','A new token is required','same token cannot be reused for resend');
select pg_temp.actor(905);
select is((select outcome from app_private.accept_trip_invitation(repeat('a',64))),'unavailable','old token immediately invalid');
select is((select outcome from app_private.accept_trip_invitation(repeat('c',64))),'accepted','viewer accepts');
select is((select role from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000905'),'viewer','viewer access created');
select is((select outcome from app_private.accept_trip_invitation(repeat('c',64))),'already_accepted','repeat acceptance idempotent');
select is((select count(*)::int from public.crew_members where trip_id='invite-a'),0,'acceptance creates no Crew');
select pg_temp.actor(906);
select is((select outcome from app_private.accept_trip_invitation(repeat('b',64))),'accepted','editor accepts');
select is((select role from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000906'),'editor','editor role correct');
select throws_ok($$update public.trip_invitations set status='pending',accepted_at=null,accepted_by=null where token_hash=repeat('b',64)$$,'23514','Invitation is terminal','accepted cannot return to pending');

insert into public.crew_members(id,trip_id,name,trip_member_id)
select 'invite-linked-crew','invite-a','Fictional camper',id from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000905';
select pg_temp.actor(902);
select throws_ok($$select app_private.remove_trip_access('invite-a',(select id from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000905'))$$,'42501','Owner access required','editor cannot remove');
select pg_temp.actor(901);
select is(app_private.remove_trip_access('invite-a',(select id from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000905')),true,'owner removes non-owner');
select ok((select trip_member_id is null from public.crew_members where id='invite-linked-crew'),'Crew retained with null access link');
select pg_temp.actor(905);
select is((select outcome from app_private.accept_trip_invitation(repeat('c',64))),'already_accepted','consumed link stays consumed');
select is((select trip_id from app_private.accept_trip_invitation(repeat('c',64))),null::text,'no destination for removed membership');
select is((select count(*)::int from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000905'),0,'consumed token cannot regrant');
select ok(not app_private.is_trip_member('invite-a'),'revoked user fails canonical RLS helper');

select pg_temp.actor(901);
insert into invitations_test_ids values ('revoked',app_private.create_trip_invitation('invite-a','invite-909@example.test',repeat('e',64)));
select is(app_private.revoke_trip_invitation('invite-a',(select id from invitations_test_ids where name='revoked')),'revoked','owner revokes');
select is(app_private.revoke_trip_invitation('invite-a',(select id from invitations_test_ids where name='revoked')),'revoked','repeat revocation safe');
select is(app_private.rotate_trip_invitation('invite-a',(select id from invitations_test_ids where name='revoked'),repeat('f',64)),'revoked','revoked cannot rotate');
select pg_temp.actor(909);
select is((select outcome from app_private.accept_trip_invitation(repeat('e',64))),'revoked','revoked cannot accept');
select pg_temp.actor(901);
-- Create expired fixtures directly as test administrator, not through a clock override.
insert into public.trip_invitations(trip_id,invited_email_normalized,invited_by,token_hash,created_at,expires_at)
values ('invite-a','invite-910@example.test','00000000-0000-0000-0000-000000000901',repeat('f',64),now()-interval '8 days',now()-interval '1 day');
select pg_temp.actor(910);
select is((select outcome from app_private.accept_trip_invitation(repeat('f',64))),'expired','DB expiry checked');
select is((select status from public.trip_invitations where token_hash=repeat('f',64)),'expired','expiry persisted without exception rollback');
select pg_temp.actor(901);
select lives_ok($$select app_private.create_trip_invitation('invite-a','invite-910@example.test',repeat('1',64))$$,'expired invitation can be replaced');
insert into public.trip_invitations(trip_id,invited_email_normalized,invited_by,token_hash,created_at,expires_at)
values ('invite-a','invite-911@example.test','00000000-0000-0000-0000-000000000901',repeat('2',64),now()-interval '8 days',now()-interval '1 day');
select lives_ok($$select app_private.create_trip_invitation('invite-a','invite-911@example.test',repeat('3',64))$$,'creation expires pending row transactionally');
select is((select status from public.trip_invitations where token_hash=repeat('2',64)),'expired','prior pending transitioned');
select throws_ok($$update public.trip_invitations set role='owner' where token_hash=repeat('3',64)$$,'23514','Invitation identity and role are immutable','role tampering blocked');
select throws_ok($$update public.trip_invitations set status='accepted',accepted_at=now() where token_hash=repeat('2',64)$$,'23514','Invitation is terminal','expired cannot accept by direct update');

select lives_ok($$select app_private.create_trip_invitation('invite-a','invite-912@example.test',repeat('4',64))$$,'invite before externally added membership');
insert into public.trip_members(trip_id,user_id,role) values ('invite-a','00000000-0000-0000-0000-000000000912','viewer');
select pg_temp.actor(912);
select is((select outcome from app_private.accept_trip_invitation(repeat('4',64))),'already_member','existing membership rejected during acceptance');
select is((select role from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000912'),'viewer','existing role never overwritten');
select pg_temp.actor(904);
select lives_ok($$select app_private.create_trip_invitation('invite-b','invite-913@example.test',repeat('5',64))$$,'second owner creates');
insert into public.trip_members(trip_id,user_id,role) values ('invite-b','00000000-0000-0000-0000-000000000901','owner');
update public.trip_members set role='editor' where trip_id='invite-b' and user_id='00000000-0000-0000-0000-000000000904';
select pg_temp.actor(913);
select is((select outcome from app_private.accept_trip_invitation(repeat('5',64))),'unavailable','inviter no longer owner');
select pg_temp.actor(901);
update public.trips set deletion_token=gen_random_uuid(),deletion_pending_at=now() where id='invite-b';
select throws_ok($$select app_private.create_trip_invitation('invite-b','invite-914@example.test',repeat('6',64))$$,'42501','Trip access management unavailable','deletion-pending create denied');
select pg_temp.actor(913);
select is((select outcome from app_private.accept_trip_invitation(repeat('5',64))),'unavailable','deletion-pending accept denied');
delete from public.trips where id='invite-b';
select is((select count(*)::int from public.trip_invitations where trip_id='invite-b'),0,'trip cascades invitations');
select is((select outcome from app_private.accept_trip_invitation(repeat('5',64))),'unavailable','deleted trip cannot accept');

select throws_ok($$do $test$ begin delete from public.trip_members where trip_id='invite-a' and role='owner'; set constraints all immediate; end $test$;$$,'23514','A surviving trip must have an owner','final owner cannot be removed');
select throws_ok($$do $test$ begin update public.trip_members set role='editor' where trip_id='invite-a' and role='owner'; set constraints all immediate; end $test$;$$,'23514','A surviving trip must have an owner','final owner cannot be demoted');
select throws_ok($$do $test$ begin delete from auth.users where id='00000000-0000-0000-0000-000000000901'; set constraints all immediate; end $test$;$$,'23514','A surviving trip must have an owner','account deletion cannot orphan trip');
select throws_ok($$do $test$ begin insert into public.trips(id,name) values ('orphan','Orphan'); set constraints all immediate; end $test$;$$,'23514','A surviving trip must have an owner','trip creation must include owner');
set constraints all immediate;
select throws_ok($$truncate public.trip_members cascade$$,'23514','Memberships cannot be truncated','truncate cannot bypass invariant');
insert into public.trip_members(trip_id,user_id,role) values ('invite-a','00000000-0000-0000-0000-000000000914','owner');
select lives_ok($$do $test$ begin update public.trip_members set role='viewer' where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000914'; set constraints all immediate; end $test$;$$,'non-final owner demotion remains possible for trusted administration');
select pg_temp.actor(901);
select throws_ok($$select app_private.remove_trip_access('invite-a',(select id from public.trip_members where trip_id='invite-a' and role='owner'))$$,'42501','Owner removal and leaving are not supported','product primitive cannot remove owner');

-- Force a late failure after the membership INSERT: both writes must roll back.
select lives_ok($$select app_private.create_trip_invitation('invite-a','invite-915@example.test',repeat('7',64))$$,'atomicity fixture invitation');
create function pg_temp.reject_acceptance() returns trigger language plpgsql as $$
begin
  if new.status='accepted' then raise exception 'forced acceptance failure'; end if;
  return new;
end;
$$;
create trigger invitation_test_failure before update on public.trip_invitations
for each row execute function pg_temp.reject_acceptance();
select pg_temp.actor(915);
select throws_ok($$select * from app_private.accept_trip_invitation(repeat('7',64))$$,'P0001','forced acceptance failure','late acceptance failure surfaced');
select is((select count(*)::int from public.trip_members where trip_id='invite-a' and user_id='00000000-0000-0000-0000-000000000915'),0,'failed consumption rolls back membership');
select is((select status from public.trip_invitations where token_hash=repeat('7',64)),'pending','failed acceptance does not consume invitation');
drop trigger invitation_test_failure on public.trip_invitations;
select hasnt_column('public','trip_invitations','raw_token','no plaintext token column');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select * from app_private.accept_trip_invitation(repeat('7',64))$$,'42501','Authentication required','acceptance requires session');
select pg_temp.actor(901);

set local role authenticated;
select throws_ok($$delete from public.trip_members where trip_id='invite-a'$$,'42501',null,'actual direct DELETE denied');
select throws_ok($$update public.trip_members set role='owner' where trip_id='invite-a'$$,'42501',null,'actual direct UPDATE denied');
select throws_ok($$insert into public.trip_members(trip_id,user_id) values ('invite-a','00000000-0000-0000-0000-000000000915')$$,'42501',null,'actual direct INSERT denied');
select throws_ok($$select * from public.trip_invitations$$,'42501',null,'actual direct invitation read denied');
select throws_ok($$select app_private.accept_trip_invitation(repeat('3',64))$$,'42501',null,'client cannot call private acceptance');
reset role;
set local role anon;
select throws_ok($$select * from public.trip_invitations$$,'42501',null,'anonymous direct read denied');
reset role;
set local role service_role;
select is((select count(*)::int from app_private.list_trip_access('invite-a')),6,'trusted-server projection works with session identity');
reset role;
select * from finish();
rollback;
