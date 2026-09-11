-- Delivery facts are separate from invitation lifecycle. Never persist email payloads/secrets.
alter table public.trip_invitations
  add column delivery_state text not null default 'not_attempted'
    check (delivery_state in ('not_attempted','sending','sent','failed','unknown')),
  add column delivery_attempt_id uuid,
  add column delivery_attempt_count integer not null default 0 check (delivery_attempt_count >= 0),
  add column last_delivery_attempt_at timestamptz,
  add column last_delivery_success_at timestamptz,
  add column delivery_provider text check (delivery_provider in ('local','resend')),
  add column provider_message_id uuid,
  add column delivery_failure_code text check (delivery_failure_code in
    ('invalid_request','provider_auth','provider_rate_limited','provider_rejected','provider_unknown'));

-- Preserve the reviewed domain bridge, inaccessible to Data API clients.
alter function public.trip_invitation_bridge(uuid,text,jsonb) set schema app_private;
revoke all on function app_private.trip_invitation_bridge(uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.trip_invitation_bridge(p_actor uuid, p_operation text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb; v_inv public.trip_invitations;
  v_claims text := current_setting('request.jwt.claims',true);
  v_sub text := current_setting('request.jwt.claim.sub',true);
begin
  if p_operation in ('create','resend','revoke','inspect','accept') then
    v_result := app_private.trip_invitation_bridge(p_actor,p_operation,p_input);
    if p_operation in ('create','resend') and v_result->>'status' = 'pending' then
      update public.trip_invitations set delivery_attempt_id=gen_random_uuid(),
        delivery_state='not_attempted',delivery_provider=null,provider_message_id=null,delivery_failure_code=null
        where id=(v_result->>'id')::uuid returning * into v_inv;
      v_result := v_result || jsonb_build_object('deliveryAttemptId',v_inv.delivery_attempt_id,'deliveryState',v_inv.delivery_state);
    end if;
    return v_result;
  end if;
  if p_actor is null or not exists(select 1 from auth.users where id=p_actor) then
    raise exception using errcode='42501',message='Authentication required';
  end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','service_role')::text,true);
  -- Match the domain's parent-before-invitation lock order and check ownership after locking.
  perform app_private.lock_owned_trip(p_input->>'tripId');
  if p_operation = 'delivery_context' and p_input->>'email' is not null then
    v_result := jsonb_build_object('email',app_private.normalize_invitation_email(p_input->>'email'));
  else
    select * into v_inv from public.trip_invitations
      where trip_id=p_input->>'tripId' and id=(p_input->>'invitationId')::uuid for update;
    if not found then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
    if p_operation = 'delivery_context' then
      v_result := jsonb_build_object('email',v_inv.invited_email_normalized);
    elsif p_operation in ('delivery_start','delivery_finish') then
      v_result := jsonb_build_object('updated',false);
      if v_inv.delivery_attempt_id=(p_input->>'attemptId')::uuid and v_inv.token_hash=p_input->>'tokenHash' then
        if p_operation='delivery_start' and v_inv.delivery_state='not_attempted'
          and v_inv.status='pending' and v_inv.expires_at>clock_timestamp() then
          if p_input->>'provider' not in ('local','resend') or p_input->>'provider' is null then
            raise exception using errcode='22023',message='Invalid provider';
          end if;
          update public.trip_invitations set delivery_state='sending',delivery_provider=p_input->>'provider',
            delivery_attempt_count=delivery_attempt_count+1,last_delivery_attempt_at=clock_timestamp()
            where id=v_inv.id;
          v_result := jsonb_build_object('updated',true);
        elsif p_operation='delivery_finish' and v_inv.delivery_state='sending' then
          if p_input->>'state' not in ('sent','failed','unknown') or p_input->>'state' is null
            or (p_input->>'state'='sent' and p_input->>'failureCode' is not null)
            or (p_input->>'state'<>'sent' and p_input->>'failureCode' is null) then
            raise exception using errcode='22023',message='Invalid delivery result';
          end if;
          update public.trip_invitations set delivery_state=p_input->>'state',
            delivery_failure_code=p_input->>'failureCode',provider_message_id=(p_input->>'providerMessageId')::uuid,
            last_delivery_success_at=case when p_input->>'state'='sent' then clock_timestamp() else last_delivery_success_at end
            where id=v_inv.id;
          v_result := jsonb_build_object('updated',true);
        end if;
      end if;
    else raise exception using errcode='22023',message='Invalid invitation operation';
    end if;
  end if;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return v_result;
end;
$$;
revoke all on function public.trip_invitation_bridge(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.trip_invitation_bridge(uuid,text,jsonb) to service_role;

-- Shared across all server instances; bucket keys are application-secret HMACs, not emails/IPs/tokens.
create table app_private.invitation_rate_limits (
  bucket_key text primary key check(bucket_key ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  requests integer not null check(requests>0)
);
create index invitation_rate_limits_expiry on app_private.invitation_rate_limits(expires_at);
alter table app_private.invitation_rate_limits enable row level security;
revoke all on app_private.invitation_rate_limits from public,anon,authenticated,service_role;

create function public.consume_invitation_rate_limits(p_rules jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rule jsonb; v_row app_private.invitation_rate_limits; v_now timestamptz;
  v_limit integer; v_seconds integer; v_retry integer := 0;
begin
  if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) not between 1 and 8 then
    raise exception using errcode='22023',message='Invalid rate rules';
  end if;
  if (select count(distinct r->>'key') from jsonb_array_elements(p_rules) r) <> jsonb_array_length(p_rules) then
    raise exception using errcode='22023',message='Duplicate rate rules';
  end if;
  -- Stable ordering prevents multi-bucket deadlocks. Advisory locks also serialize absent rows.
  for v_rule in select value from jsonb_array_elements(p_rules) order by value->>'key' loop
    if v_rule->>'key' is null or v_rule->>'key' !~ '^[0-9a-f]{64}$' then
      raise exception using errcode='22023',message='Invalid rate key';
    end if;
    v_limit := (v_rule->>'limit')::integer; v_seconds := (v_rule->>'seconds')::integer;
    if v_limit is null or v_seconds is null or v_limit not between 1 and 10000 or v_seconds not between 1 and 86400 then
      raise exception using errcode='22023',message='Invalid rate budget';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_rule->>'key',713));
  end loop;
  v_now := clock_timestamp();
  for v_rule in select value from jsonb_array_elements(p_rules) order by value->>'key' loop
    v_limit := (v_rule->>'limit')::integer; v_seconds := (v_rule->>'seconds')::integer;
    insert into app_private.invitation_rate_limits(bucket_key,expires_at,requests)
      values(v_rule->>'key',v_now+make_interval(secs=>v_seconds),1)
    on conflict(bucket_key) do update set
      requests=case when invitation_rate_limits.expires_at<=v_now then 1 else least(invitation_rate_limits.requests+1,10001) end,
      expires_at=case when invitation_rate_limits.expires_at<=v_now then excluded.expires_at else invitation_rate_limits.expires_at end
    returning * into v_row;
    if v_row.requests>v_limit then v_retry := greatest(v_retry,ceil(extract(epoch from v_row.expires_at-v_now))::integer,1); end if;
  end loop;
  -- Cleanup last: do not hold deleted-row locks while subsequently acquiring bucket locks.
  delete from app_private.invitation_rate_limits where bucket_key in
    (select bucket_key from app_private.invitation_rate_limits where expires_at<v_now-interval '1 day'
      order by expires_at limit 100 for update skip locked);
  return jsonb_build_object('allowed',v_retry=0,'retryAfter',v_retry);
end;
$$;
revoke all on function public.consume_invitation_rate_limits(jsonb) from public,anon,authenticated;
grant execute on function public.consume_invitation_rate_limits(jsonb) to service_role;
