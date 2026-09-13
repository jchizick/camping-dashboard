begin;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000941','security-owner-a@example.test',now()),
 ('00000000-0000-0000-0000-000000000942','security-owner-b@example.test',now()),
 ('00000000-0000-0000-0000-000000000943','security-viewer@example.test',now());
insert into public.trips(id,name) values ('access-security','Synthetic security fixture');
insert into public.trip_members(trip_id,user_id,role) values
 ('access-security','00000000-0000-0000-0000-000000000941','owner'),
 ('access-security','00000000-0000-0000-0000-000000000942','owner'),
 ('access-security','00000000-0000-0000-0000-000000000943','viewer');
create temp table security_invite as select public.trip_invitation_bridge(
 '00000000-0000-0000-0000-000000000942','create',
 jsonb_build_object('tripId','access-security','email','security-recipient@example.test','role','editor','tokenHash',repeat('c',64))) r;
select is(jsonb_array_length(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations'),1,'Owner A sees active invitation validly issued by different Owner B');
update public.trip_members set role='editor' where trip_id='access-security' and user_id='00000000-0000-0000-0000-000000000943';
select is(jsonb_array_length(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations'),1,'unrelated membership change does not hide valid pending invite');
update public.trip_members set role='editor' where trip_id='access-security' and user_id='00000000-0000-0000-0000-000000000942';
select is(jsonb_array_length(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations'),0,'creator demotion hides now-unusable pending invite even when A remains Owner');
select is((select status from public.trip_invitations where id=(select (r->>'id')::uuid from security_invite)),'pending','read does not revoke or expire hidden invite');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','create',jsonb_build_object('tripId','access-security','email','security-recipient@example.test','role','editor','tokenHash',repeat('d',64)))$$,'23505',null,'hidden pending record still occupies existing recipient uniqueness constraint');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','resend',jsonb_build_object('tripId','access-security','invitationId',(select r->>'id' from security_invite),'tokenHash',repeat('d',64)))$$,'42501',null,'resend agrees original inviter must currently own trip');
update public.trip_members set role='owner' where trip_id='access-security' and user_id='00000000-0000-0000-0000-000000000942';
select is(jsonb_array_length(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations'),1,'restoring creator ownership restores unchanged pending eligibility');

-- Expiry is DB wall time, not transaction start or a supplied client timestamp.
insert into public.trip_invitations(trip_id,invited_email_normalized,invited_by,token_hash,created_at,expires_at) values
 ('access-security','boundary-equal@example.test','00000000-0000-0000-0000-000000000941',repeat('e',64),transaction_timestamp()-interval '1 day',transaction_timestamp()),
 ('access-security','boundary-future@example.test','00000000-0000-0000-0000-000000000941',repeat('f',64),transaction_timestamp()-interval '1 day',clock_timestamp()+interval '1 second');
select ok(not exists(select 1 from jsonb_array_elements(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations') i where i->>'email'='boundary-equal@example.test'),'expiry equal to transaction start is excluded');
select ok(exists(select 1 from jsonb_array_elements(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations') i where i->>'email'='boundary-future@example.test'),'future expiry included');
select pg_sleep(1.1);
select ok(not exists(select 1 from jsonb_array_elements(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}')->'pendingInvitations') i where i->>'email'='boundary-future@example.test'),'same transaction excludes invitation after wall-clock expiry');
select is((select count(*)::int from public.trip_invitations where trip_id='access-security' and status='pending'),3,'expiry reads leave all stored statuses pending');

create temp table state_before as select
 (select jsonb_agg(to_jsonb(i) order by id) from public.trip_invitations i) invitations,
 (select jsonb_agg(to_jsonb(m) order by id) from public.trip_members m) members,
 (select jsonb_agg(to_jsonb(r) order by bucket_key) from app_private.invitation_rate_limits r) rates;
create temp table owner_response as select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}') r;
select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','list_access','{"tripId":"access-security"}'),(select r from owner_response),'repeat produces same snapshot');
select is((select jsonb_agg(to_jsonb(i) order by id) from public.trip_invitations i),(select invitations from state_before),'all invitation/delivery/attempt/token columns unchanged');
select is((select jsonb_agg(to_jsonb(m) order by id) from public.trip_members m),(select members from state_before),'membership state unchanged');
select is((select jsonb_agg(to_jsonb(r) order by bucket_key) from app_private.invitation_rate_limits r),(select rates from state_before),'durable rate storage unchanged');
select is((select array_agg(k order by k) from owner_response,jsonb_object_keys(r) k),array['pendingInvitations','people'],'exact outer response keys');
select is((select array_agg(k order by k) from owner_response,jsonb_object_keys(r#>'{people,0}') k),array['email','isCurrentUser','membershipId','role'],'exact member keys');
select is((select array_agg(k order by k) from owner_response,jsonb_object_keys(r#>'{pendingInvitations,0}') k),array['createdAt','email','expiresAt','invitationId','role','status'],'exact invitation keys');
select ok((select r::text !~ '00000000-0000-0000-0000-00000000094[123]' and r::text not like '%'||repeat('c',64)||'%' from owner_response),'actual response excludes auth IDs and fixture token hash values');

select is((select pg_get_userbyid(proowner) from pg_proc where oid='app_private.list_trip_access(text)'::regprocedure),'postgres','private resolver owned by postgres');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='app_private.list_trip_access(text)'::regprocedure),'private resolver SECURITY DEFINER with empty search path');
select ok(has_function_privilege('service_role','app_private.list_trip_access(text)','EXECUTE'),'existing private service grant retained');
select ok(not has_function_privilege('authenticated','app_private.list_trip_access(text)','EXECUTE'),'no authenticated resolver execution');
select ok(not has_function_privilege('anon','app_private.list_trip_access(text)','EXECUTE'),'no anon resolver execution');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.trip_invitation_bridge(uuid,text,jsonb)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'no PUBLIC bridge execution');
select is((select pg_get_userbyid(proowner) from pg_proc where oid='public.trip_invitation_bridge(uuid,text,jsonb)'::regprocedure),'postgres','public bridge owner unchanged');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000941','unknown_operation','{"tripId":"access-security"}')$$,null,null,'unknown bridge operation fails');
select * from finish();
rollback;
