begin;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000901','owner-access@example.test',now(),'{"private":"never expose"}'),
 ('00000000-0000-0000-0000-000000000902','viewer-access@example.test',now(),'{}'),
 ('00000000-0000-0000-0000-000000000903','editor-access@example.test',now(),'{}'),
 ('00000000-0000-0000-0000-000000000904','other-owner-access@example.test',now(),'{}'),
 ('00000000-0000-0000-0000-000000000905',null,null,'{}');
insert into public.trips(id,name) values ('access-read-a','Synthetic access A'),('access-read-b','Synthetic access B');
insert into public.trip_members(id,trip_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000901','access-read-a','00000000-0000-0000-0000-000000000901','owner'),
 ('10000000-0000-0000-0000-000000000902','access-read-a','00000000-0000-0000-0000-000000000902','viewer'),
 ('10000000-0000-0000-0000-000000000903','access-read-a','00000000-0000-0000-0000-000000000903','editor'),
 ('10000000-0000-0000-0000-000000000904','access-read-b','00000000-0000-0000-0000-000000000904','owner');
insert into public.trip_invitations(id,trip_id,invited_email_normalized,role,invited_by,token_hash,created_at,expires_at,status,accepted_at,accepted_by,revoked_at) values
 ('20000000-0000-0000-0000-000000000901','access-read-a','pending-viewer@example.test','viewer','00000000-0000-0000-0000-000000000901',repeat('1',64),now()-interval '2 hours',now()+interval '1 day','pending',null,null,null),
 ('20000000-0000-0000-0000-000000000902','access-read-a','pending-editor@example.test','editor','00000000-0000-0000-0000-000000000901',repeat('2',64),now()-interval '1 hour',now()+interval '1 day','pending',null,null,null),
 ('20000000-0000-0000-0000-000000000903','access-read-a','consumed@example.test','viewer','00000000-0000-0000-0000-000000000901',repeat('3',64),now()-interval '1 day',now()+interval '1 day','accepted',now(), '00000000-0000-0000-0000-000000000902',null),
 ('20000000-0000-0000-0000-000000000904','access-read-a','revoked@example.test','viewer','00000000-0000-0000-0000-000000000901',repeat('4',64),now()-interval '1 day',now()+interval '1 day','revoked',null,null,now()),
 ('20000000-0000-0000-0000-000000000905','access-read-a','expired-pending@example.test','viewer','00000000-0000-0000-0000-000000000901',repeat('5',64),now()-interval '2 days',now()-interval '1 day','pending',null,null,null),
 ('20000000-0000-0000-0000-000000000906','access-read-a','expired@example.test','viewer','00000000-0000-0000-0000-000000000901',repeat('6',64),now()-interval '2 days',now()-interval '1 day','expired',null,null,null),
 ('20000000-0000-0000-0000-000000000907','access-read-a','former-owner@example.test','viewer','00000000-0000-0000-0000-000000000902',repeat('7',64),now()-interval '1 day',now()+interval '1 day','pending',null,null,null);

create temp table access_before as select
 (select jsonb_agg(to_jsonb(i) order by id) from public.trip_invitations i) invitations,
 (select jsonb_agg(to_jsonb(m) order by id) from public.trip_members m) members;
create temp table access_result(result jsonb);
grant all on access_result to service_role;
set local role service_role;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000902';
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000902","role":"authenticated"}';
insert into access_result select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-a"}');
select is(auth.uid()::text,'00000000-0000-0000-0000-000000000902','read restores original connection identity');
select is((select jsonb_array_length(result->'people') from access_result),3,'all three current members');
select is((select result#>>'{people,0,role}' from access_result),'owner','owner first');
select is((select result#>>'{people,1,role}' from access_result),'editor','editor before viewer');
select is((select result#>>'{people,2,role}' from access_result),'viewer','viewer last');
select is((select result#>>'{people,0,email}' from access_result),'owner-access@example.test','safe email resolved by private identity resolver');
select is((select result#>>'{people,0,isCurrentUser}' from access_result),'true','current user derives from verified actor');
select is((select result#>>'{people,2,isCurrentUser}' from access_result),'false','connection claim does not set current user');
select is((select jsonb_array_length(result->'pendingInvitations') from access_result),2,'only active pending invitations from current owner');
select is((select result#>>'{pendingInvitations,0,email}' from access_result),'pending-editor@example.test','pending newest first');
select is((select result#>>'{pendingInvitations,1,email}' from access_result),'pending-viewer@example.test','pending stable order');
select ok((select result::text !~* 'token|provider|secret|user_id|userId|metadata|delivery|attempt|rate.limit|idempotency|never expose' from access_result),'serialized response excludes internal fields and secrets');
select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-a"}'),(select result from access_result),'repeated reads deterministic');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000902','list_access','{"tripId":"access-read-a"}')$$,'42501',null,'viewer denied');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000903','list_access','{"tripId":"access-read-a"}')$$,'42501',null,'editor denied');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-b"}')$$,'42501',null,'cross-trip owner denied');
select throws_ok($$select public.trip_invitation_bridge(null,'list_access','{"tripId":"access-read-a"}')$$,'42501',null,'unauthenticated denied');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-a","isOwner":true}')$$,'22023',null,'DB rejects authority injection');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{}')$$,'22023',null,'DB requires trip ID');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"unknown-trip"}')$$,'42501',null,'unknown trip same denial');
reset role;
select is((select jsonb_agg(to_jsonb(i) order by id) from public.trip_invitations i),(select invitations from access_before),'read does not mutate invitations, expiry or delivery');
select is((select jsonb_agg(to_jsonb(m) order by id) from public.trip_members m),(select members from access_before),'read does not mutate members');
select ok(not has_function_privilege('anon','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE'),'anon not granted bridge');
select ok(not has_function_privilege('authenticated','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE'),'authenticated not granted bridge');
select ok(has_function_privilege('service_role','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE'),'service_role retains bridge');

insert into public.trip_members(id,trip_id,user_id,role) values ('10000000-0000-0000-0000-000000000905','access-read-a','00000000-0000-0000-0000-000000000905','viewer');
select ok(exists(select 1 from jsonb_array_elements(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-a"}')->'people') p
 where p->>'membershipId'='10000000-0000-0000-0000-000000000905' and p->'email'='null'::jsonb),'email-less identity retained with null email');
delete from auth.users where id='00000000-0000-0000-0000-000000000905';
select is(jsonb_array_length(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-a"}')->'people'),3,'deleted identity membership cascades without crashing roster');

select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','resend',jsonb_build_object('tripId','access-read-a','invitationId',(select result#>>'{pendingInvitations,0,invitationId}' from access_result),'tokenHash',repeat('8',64)))->>'status','pending','snapshot invitation ID accepted by resend');
select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','revoke',jsonb_build_object('tripId','access-read-a','invitationId',(select result#>>'{pendingInvitations,1,invitationId}' from access_result)))->>'status','revoked','snapshot invitation ID accepted by revoke');
select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','remove_access',jsonb_build_object('tripId','access-read-a','membershipId',(select result#>>'{people,2,membershipId}' from access_result)))->>'outcome','access_removed','snapshot membership ID accepted by removal');
update public.trip_members set role='owner' where trip_id='access-read-a' and user_id='00000000-0000-0000-0000-000000000903';
update public.trip_members set role='editor' where trip_id='access-read-a' and user_id='00000000-0000-0000-0000-000000000901';
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000901','list_access','{"tripId":"access-read-a"}')$$,'42501',null,'later call rechecks demoted owner');
select * from finish();
rollback;
