begin;
select no_plan();
select ok(has_function_privilege('service_role','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE'),'bridge remains service only');
select ok(not has_function_privilege('anon','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE'),'anon cannot set actor');
select ok(not has_function_privilege('authenticated','public.trip_invitation_bridge(uuid,text,jsonb)','EXECUTE'),'authenticated cannot set actor');
select ok(not has_function_privilege('authenticated','app_private.remove_trip_access(text,uuid)','EXECUTE'),'primitive not broadened to authenticated');
select ok(not has_function_privilege('anon','app_private.remove_trip_access(text,uuid)','EXECUTE'),'primitive not broadened to anon');
select ok(has_function_privilege('service_role','app_private.remove_trip_access(text,uuid)','EXECUTE'),'existing private grant retained');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.trip_invitation_bridge(uuid,text,jsonb)'::regprocedure),'definer has fixed empty search path');

insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000821','removal-owner@example.test',now()),
 ('00000000-0000-0000-0000-000000000822','removal-viewer@example.test',now());
insert into public.trips(id,name) values ('removal-sql-fixture','Synthetic removal');
insert into public.trip_members(id,trip_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000821','removal-sql-fixture','00000000-0000-0000-0000-000000000821','owner'),
 ('10000000-0000-0000-0000-000000000822','removal-sql-fixture','00000000-0000-0000-0000-000000000822','viewer');
set local role service_role;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000822';
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000822","role":"authenticated"}';
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000822','remove_access','{"tripId":"removal-sql-fixture","membershipId":"10000000-0000-0000-0000-000000000821"}')$$,'42501',null,'service connection does not grant owner rights to viewer');
select is(auth.uid()::text,'00000000-0000-0000-0000-000000000822','denial restores caller sub');
select throws_ok($$select public.trip_invitation_bridge(null,'remove_access','{}')$$,'42501',null,'null actor denied');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000829','remove_access','{}')$$,'42501',null,'unknown actor denied');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000821','remove_access','{"tripId":"removal-sql-fixture","membershipId":"10000000-0000-0000-0000-000000000822","isOwner":true}')$$,'22023',null,'bridge also rejects unexpected actor claims');
select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000821','remove_access','{"tripId":"removal-sql-fixture","membershipId":"10000000-0000-0000-0000-000000000822"}'),'{"outcome":"access_removed"}'::jsonb,'verified owner wins over connection claims');
select is(auth.uid()::text,'00000000-0000-0000-0000-000000000822','success restores prior sub');
select is(current_setting('request.jwt.claims'),'{'||'"sub":"00000000-0000-0000-0000-000000000822","role":"authenticated"}','success restores exact prior claims');
select is(public.trip_invitation_bridge('00000000-0000-0000-0000-000000000821','remove_access','{"tripId":"removal-sql-fixture","membershipId":"10000000-0000-0000-0000-000000000822"}'),'{"outcome":"access_removed"}'::jsonb,'absent member does not disclose existence');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000821','remove_access','{"tripId":"missing-trip","membershipId":"10000000-0000-0000-0000-000000000822"}')$$,'42501',null,'missing trip safely denied');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000821','remove_access','{"tripId":"removal-sql-fixture","membershipId":"10000000-0000-0000-0000-000000000821"}')$$,'42501',null,'final owner self-removal denied');
reset role;
select is((select count(*)::int from public.trip_members where trip_id='removal-sql-fixture'),1,'only owner remains');
select throws_ok($$delete from public.trip_members where trip_id='removal-sql-fixture'; set constraints all immediate;$$,'23514',null,'final-owner invariant survives even privileged direct deletion');
select * from finish();
rollback;
