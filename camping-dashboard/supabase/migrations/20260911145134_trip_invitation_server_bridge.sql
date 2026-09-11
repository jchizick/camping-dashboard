-- Narrow server-only API bridge. Never expose app_private through PostgREST.
-- p_actor is supplied ONLY by application code after auth.getUser verification.
create function public.trip_invitation_bridge(p_actor uuid, p_operation text, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_id uuid; v_status text; v_result jsonb;
  v_inv public.trip_invitations; v_trip public.trips;
  v_email text; v_confirmed timestamptz; v_member boolean;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',p_actor,'role','service_role')::text, true);
  case p_operation
    when 'create' then
      v_id := app_private.create_trip_invitation(p_input->>'tripId',p_input->>'email',p_input->>'tokenHash',p_input->>'role');
    when 'resend' then
      v_id := (p_input->>'invitationId')::uuid;
      v_status := app_private.rotate_trip_invitation(p_input->>'tripId',v_id,p_input->>'tokenHash');
    when 'revoke' then
      v_status := app_private.revoke_trip_invitation(p_input->>'tripId',(p_input->>'invitationId')::uuid);
      v_result := jsonb_build_object('status',v_status);
    when 'accept' then
      select to_jsonb(r) into v_result from app_private.accept_trip_invitation(p_input->>'tokenHash') r;
    when 'inspect' then
      -- A read-only projection: no expiry writes, locks, acceptance, or membership mutation.
      select * into v_inv from public.trip_invitations where token_hash = p_input->>'tokenHash';
      select * into v_trip from public.trips where id = v_inv.trip_id and deletion_token is null;
      v_result := jsonb_build_object('outcome','unavailable');
      if v_inv.id is not null and v_trip.id is not null then
        select app_private.normalize_invitation_email(email),email_confirmed_at into v_email,v_confirmed from auth.users where id = p_actor;
        if v_email is null or v_confirmed is null or v_email <> v_inv.invited_email_normalized then
          v_result := jsonb_build_object('outcome','identity_mismatch','maskedEmail',
            left(split_part(v_inv.invited_email_normalized,'@',1),1) || '***@' || split_part(v_inv.invited_email_normalized,'@',2));
        else
          select exists(select 1 from public.trip_members where trip_id=v_inv.trip_id and user_id=p_actor) into v_member;
          if v_inv.status = 'accepted' and v_inv.accepted_by = p_actor then
            v_result := jsonb_build_object('outcome','already_accepted','trip_id',case when v_member then v_inv.trip_id end);
          elsif v_inv.status <> 'pending' then
            v_result := jsonb_build_object('outcome',v_inv.status);
          elsif v_inv.expires_at <= clock_timestamp() then
            v_result := jsonb_build_object('outcome','expired');
          elsif not exists(select 1 from public.trip_members where trip_id=v_inv.trip_id and user_id=v_inv.invited_by and role='owner') then
            v_result := jsonb_build_object('outcome','unavailable');
          elsif v_member then
            v_result := jsonb_build_object('outcome','already_member','trip_id',v_inv.trip_id);
          else
            v_result := jsonb_build_object('outcome','pending','tripName',v_trip.name,'role',v_inv.role,'expiresAt',v_inv.expires_at);
          end if;
        end if;
      end if;
    else
      raise exception using errcode = '22023', message = 'Invalid invitation operation';
  end case;
  if p_operation in ('create','resend') then
    select jsonb_build_object('id',i.id,'email',i.invited_email_normalized,'role',i.role,'status',i.status,
      'expiresAt',i.expires_at,'tripName',t.name) into v_result
      from public.trip_invitations i join public.trips t on t.id=i.trip_id where i.id=v_id;
  end if;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return v_result;
end;
$$;
revoke all on function public.trip_invitation_bridge(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.trip_invitation_bridge(uuid,text,jsonb) to service_role;
