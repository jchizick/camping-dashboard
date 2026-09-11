begin;
select no_plan();
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-000000000881','owner-delivery@example.test',now()),
 ('00000000-0000-0000-0000-000000000882','invitee-delivery@example.test',now());
insert into public.trips(id,name) values ('delivery-fixture','Delivery fixture');
insert into public.trip_members(trip_id,user_id,role) values ('delivery-fixture','00000000-0000-0000-0000-000000000881','owner');
create function pg_temp.bridge(op text, data jsonb) returns jsonb language sql as $$
 select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000881',op,data);
$$;
create temporary table attempt(data jsonb);
insert into attempt select pg_temp.bridge('create',jsonb_build_object('tripId','delivery-fixture','email','invitee-delivery@example.test','role','viewer','tokenHash',repeat('d',64)));
create function pg_temp.input() returns jsonb language sql as $$
 select jsonb_build_object('tripId','delivery-fixture','invitationId',data->>'id','attemptId',data->>'deliveryAttemptId','tokenHash',repeat('d',64),'provider','resend') from attempt;
$$;
select is((select delivery_state from public.trip_invitations where trip_id='delivery-fixture'),'not_attempted','persist before sending');
select is(pg_temp.bridge('delivery_start',pg_temp.input())->>'updated','true','first attempt acquires send');
select is(pg_temp.bridge('delivery_start',pg_temp.input())->>'updated','false','duplicate cannot send again');
select is((select delivery_attempt_count from public.trip_invitations where trip_id='delivery-fixture'),1,'one attempt counted');
select is(pg_temp.bridge('delivery_finish',pg_temp.input()||'{"state":"failed","failureCode":"provider_auth"}')->>'updated','true','durable failure');
select is((select status from public.trip_invitations where trip_id='delivery-fixture'),'pending','failure does not revoke');
select is((select delivery_state from public.trip_invitations where trip_id='delivery-fixture'),'failed','failed state recorded');
select is((select count(*)::int from public.trip_members where trip_id='delivery-fixture'),1,'no membership from delivery');
select is(pg_temp.bridge('delivery_finish',pg_temp.input()||'{"state":"sent"}')->>'updated','false','cannot rewrite final fact');
create temporary table old_attempt as select pg_temp.input() as data;
update attempt set data=pg_temp.bridge('resend',pg_temp.input()||jsonb_build_object('tokenHash',repeat('e',64)));
select isnt((select data->>'deliveryAttemptId' from attempt),(select data->>'attemptId' from old_attempt),'resend new attempt identity');
select is((select token_hash from public.trip_invitations where trip_id='delivery-fixture'),repeat('e',64),'old token invalidated');
select is(pg_temp.bridge('delivery_finish',(select data from old_attempt)||'{"state":"sent"}')->>'updated','false','stale completion cannot overwrite rotated attempt');
select is(pg_temp.bridge('delivery_start',pg_temp.input()||jsonb_build_object('tokenHash',repeat('e',64)))->>'updated','true','new attempt acquired');
select throws_ok($$select pg_temp.bridge('delivery_finish',pg_temp.input()||jsonb_build_object('tokenHash',repeat('e',64),'state','failed','failureCode','arbitrary private content'))$$,'23514',null,'arbitrary provider errors cannot persist');
select is(pg_temp.bridge('delivery_finish',pg_temp.input()||jsonb_build_object('tokenHash',repeat('e',64),'state','sent','providerMessageId','11111111-1111-1111-1111-111111111111'))->>'updated','true','provider acceptance persisted');
select ok((select last_delivery_success_at is not null and last_delivery_attempt_at is not null and delivery_attempt_count=2 from public.trip_invitations where trip_id='delivery-fixture'),'timestamps and cumulative attempts');
select throws_ok($$select public.trip_invitation_bridge('00000000-0000-0000-0000-000000000882','delivery_context','{"tripId":"delivery-fixture","email":"victim@example.test"}')$$,'42501','Owner access required','unauthorized recipient lookup rejected');
select ok(not has_function_privilege('anon','public.consume_invitation_rate_limits(jsonb)','execute'),'anonymous cannot bypass API limiter');
select ok(not has_function_privilege('authenticated','public.consume_invitation_rate_limits(jsonb)','execute'),'authenticated cannot reset limiter');
select ok(not has_function_privilege('service_role','app_private.trip_invitation_bridge(uuid,text,jsonb)','execute'),'old bridge remains private');
select ok(has_function_privilege('service_role','public.consume_invitation_rate_limits(jsonb)','execute'),'service can consume budget');
select ok(not has_table_privilege('service_role','app_private.invitation_rate_limits','SELECT,INSERT,UPDATE,DELETE'),'no direct counter access');
select ok((select relrowsecurity from pg_class where oid='app_private.invitation_rate_limits'::regclass),'private limiter RLS enabled');
create function pg_temp.rates(k text) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('key',repeat(k,64),'limit',2,'seconds',60));
$$;
select is(public.consume_invitation_rate_limits(pg_temp.rates('a'))->>'allowed','true','initial request allowed');
select is(public.consume_invitation_rate_limits(pg_temp.rates('a'))->>'allowed','true','threshold request allowed');
select is(public.consume_invitation_rate_limits(pg_temp.rates('a'))->>'allowed','false','above threshold denied');
select ok((public.consume_invitation_rate_limits(pg_temp.rates('a'))->>'retryAfter')::int between 1 and 60,'Retry-After bounded');
select is(public.consume_invitation_rate_limits(pg_temp.rates('b'))->>'allowed','true','other bucket isolated');
update app_private.invitation_rate_limits set expires_at=now()-interval '1 second' where bucket_key=repeat('a',64);
select is(public.consume_invitation_rate_limits(pg_temp.rates('a'))->>'allowed','true','expired window resumes');
select throws_ok($$select public.consume_invitation_rate_limits('[]')$$,'22023','Invalid rate rules','empty rules rejected');
select throws_ok($$select public.consume_invitation_rate_limits(pg_temp.rates('a')||pg_temp.rates('a'))$$,'22023','Duplicate rate rules','duplicate keys rejected');
-- Housekeeping is bounded, leaves active/recent windows intact, and drains old buckets on later calls.
insert into app_private.invitation_rate_limits(bucket_key,expires_at,requests)
  select md5('cleanup-fixture-'||n)||repeat('0',32),clock_timestamp()-interval '2 days',1 from generate_series(1,150) n;
insert into app_private.invitation_rate_limits values(repeat('c',64),clock_timestamp()-interval '1 hour',1);
select public.consume_invitation_rate_limits(pg_temp.rates('b'));
select is((select count(*)::int from app_private.invitation_rate_limits where expires_at<clock_timestamp()-interval '1 day'),50,'one request prunes at most 100 expired buckets');
select is((select count(*)::int from app_private.invitation_rate_limits where bucket_key=repeat('c',64)),1,'recently expired bucket retained');
select public.consume_invitation_rate_limits(pg_temp.rates('b'));
select is((select count(*)::int from app_private.invitation_rate_limits where expires_at<clock_timestamp()-interval '1 day'),0,'subsequent request drains remaining old buckets');
select is((select count(*)::int from app_private.invitation_rate_limits where bucket_key=repeat('a',64)),1,'active window survives cleanup');
select * from finish();
rollback;
