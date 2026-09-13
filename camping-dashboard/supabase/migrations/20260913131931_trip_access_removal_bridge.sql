-- Product access management through the existing service-only bridge.
-- The private primitive, Crew FK semantics and all existing grants remain unchanged.
create or replace function public.trip_invitation_bridge(p_actor uuid, p_operation text, p_input jsonb)
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
  -- p_actor is supplied only by the trusted server after auth.getUser().
  -- Reuse the established transaction-local identity; the primitive locks/rechecks ownership.
  if p_operation = 'remove_access' then
    if jsonb_typeof(p_input) is distinct from 'object'
      or p_input - 'tripId' - 'membershipId' <> '{}'::jsonb
      or jsonb_typeof(p_input->'tripId') is distinct from 'string'
      or jsonb_typeof(p_input->'membershipId') is distinct from 'string'
      or p_input->>'tripId' !~ '^[A-Za-z0-9_-]{1,200}$'
      or p_input->>'membershipId' !~* '^[a-f0-9]{8}-([a-f0-9]{4}-){3}[a-f0-9]{12}$' then
      raise exception using errcode='22023',message='Invalid access request';
    end if;
    perform app_private.remove_trip_access(p_input->>'tripId',(p_input->>'membershipId')::uuid);
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
    -- Same result for an absent target after owner authorization (idempotent, no target oracle).
    return jsonb_build_object('outcome','access_removed');
  end if;
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

