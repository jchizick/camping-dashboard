-- Phase 1 only: private database primitives. No public RPC, delivery or UI.
-- The future trusted server must verify the session and establish auth.uid()
-- from that session, never from an actor ID supplied by the client. Only the
-- service role can execute the invitation/access operations below.

do $preflight$
begin
  if exists (
    select 1 from public.trips t where not exists (
      select 1 from public.trip_members m where m.trip_id = t.id and m.role = 'owner'
    )
  ) then
    raise exception 'Ownerless trips must be reviewed before this migration';
  end if;
end
$preflight$;

-- Existing create_trip is SECURITY DEFINER and remains the creation path.
-- No application consumer currently writes trip_members directly.
revoke insert, update, delete, truncate, references, trigger
  on public.trip_members from public, anon, authenticated;
drop policy tm_owner_insert on public.trip_members;
drop policy tm_owner_update on public.trip_members;
drop policy tm_owner_delete on public.trip_members;

-- Serialize membership changes with acceptance and trip deletion. Writing the
-- parent (rather than only locking it) also prevents snapshot-isolation write
-- skew when two owners are removed in separate REPEATABLE READ transactions.
create function app_private.lock_membership_trip()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and (new.trip_id <> old.trip_id or new.user_id <> old.user_id or new.id <> old.id) then
    raise exception using errcode = '23514', message = 'Membership identity is immutable';
  end if;
  if TG_OP = 'DELETE' then
    update public.trips set id = id where id = old.trip_id;
    return old;
  end if;
  update public.trips set id = id where id = new.trip_id;
  return new;
end;
$$;
create trigger trip_members_serialize
before insert or update or delete on public.trip_members
for each row execute function app_private.lock_membership_trip();

-- Deferred so create_trip can insert the trip and its first owner atomically.
-- A deleted parent is exempt; a merely deletion-pending parent is NOT exempt.
create function app_private.assert_trip_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_trip_id text;
begin
  if TG_TABLE_NAME = 'trips' then v_trip_id := new.id;
  elsif TG_OP = 'DELETE' then v_trip_id := old.trip_id;
  else v_trip_id := new.trip_id;
  end if;
  if exists (select 1 from public.trips where id = v_trip_id)
     and not exists (select 1 from public.trip_members where trip_id = v_trip_id and role = 'owner') then
    raise exception using errcode = '23514', message = 'A surviving trip must have an owner';
  end if;
  return null;
end;
$$;
create constraint trigger trip_requires_owner
after insert on public.trips deferrable initially deferred
for each row execute function app_private.assert_trip_owner();
create constraint trigger membership_requires_owner
after insert or update or delete on public.trip_members deferrable initially deferred
for each row execute function app_private.assert_trip_owner();

-- TRUNCATE does not fire row triggers. Block it even for privileged routines;
-- normal parent deletion still cascades safely.
create function app_private.reject_membership_truncate()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = '23514', message = 'Memberships cannot be truncated';
end;
$$;
create trigger trip_members_no_truncate before truncate on public.trip_members
for each statement execute function app_private.reject_membership_truncate();

-- Preserve the existing deletion RPC contract, but check ownership AFTER the
-- parent lock is acquired. Membership changes now share that serialization
-- point; an authorization subquery in the lock query can predate its wait.
create or replace function public.begin_trip_deletion(p_trip_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_token uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select deletion_token into v_token from public.trips where id = p_trip_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = v_actor and role = 'owner') then
    raise exception using errcode = '42501', message = 'Only the trip owner can delete this trip';
  end if;
  if v_token is null then
    v_token := gen_random_uuid();
    update public.trips set deletion_pending_at = now(), deletion_token = v_token where id = p_trip_id;
  end if;
  return v_token;
end;
$$;
create or replace function public.complete_trip_deletion(p_trip_id text, p_deletion_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_token uuid;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select deletion_token into v_token from public.trips where id = p_trip_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Trip not found'; end if;
  if v_token is null or p_deletion_token is null or v_token <> p_deletion_token
     or not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = v_actor and role = 'owner') then
    raise exception using errcode = '42501', message = 'Deletion ownership or token check failed';
  end if;
  delete from public.trips where id = p_trip_id and deletion_token = p_deletion_token;
  return found;
end;
$$;
-- CREATE OR REPLACE retains the existing execution grants on these two RPCs.

create function app_private.normalize_invitation_email(p_email text)
returns text language sql immutable strict set search_path = '' as $$
  select lower(btrim(p_email));
$$;

create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  invited_email_normalized text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  invited_by uuid references auth.users(id) on delete set null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint invitation_email_valid check (
    invited_email_normalized = app_private.normalize_invitation_email(invited_email_normalized)
    and length(invited_email_normalized) <= 254
    and invited_email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint invitation_expiry_valid check (expires_at > created_at),
  constraint invitation_lifecycle_valid check (
    (status = 'accepted' and accepted_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null and accepted_at is null and accepted_by is null)
    or (status in ('pending', 'expired') and accepted_at is null and accepted_by is null and revoked_at is null)
  ),
  constraint invitation_timestamps_valid check (
    (accepted_at is null or (accepted_at >= created_at and accepted_at < expires_at))
    and (revoked_at is null or revoked_at >= created_at)
  )
);
create unique index trip_invitations_one_pending
  on public.trip_invitations(trip_id, invited_email_normalized) where status = 'pending';
create index trip_invitations_trip_status on public.trip_invitations(trip_id, status);
create index trip_invitations_invited_by on public.trip_invitations(invited_by);
create index trip_invitations_accepted_by on public.trip_invitations(accepted_by);
alter table public.trip_invitations enable row level security;
revoke all on public.trip_invitations from public, anon, authenticated, service_role;
-- No SELECT policy: even owners receive only an explicit projection below.

create function app_private.guard_invitation_transition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.trip_id <> old.trip_id
     or new.invited_email_normalized <> old.invited_email_normalized
     or new.role <> old.role or new.created_at <> old.created_at
     or (new.invited_by is distinct from old.invited_by and new.invited_by is not null) then
    raise exception using errcode = '23514', message = 'Invitation identity and role are immutable';
  end if;
  if old.status <> 'pending' and (
    new.status <> old.status or new.token_hash <> old.token_hash
    or new.expires_at <> old.expires_at or new.accepted_at is distinct from old.accepted_at
    or new.revoked_at is distinct from old.revoked_at
    or (new.accepted_by is distinct from old.accepted_by and new.accepted_by is not null)
  ) then
    raise exception using errcode = '23514', message = 'Invitation is terminal';
  end if;
  return new;
end;
$$;
create trigger trip_invitations_transition before update on public.trip_invitations
for each row execute function app_private.guard_invitation_transition();

-- Lock BEFORE checking current membership: checks in a lock query's WHERE
-- clause can otherwise use authorization from before a concurrent lock wait.
create function app_private.lock_owned_trip(p_trip_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_deletion uuid;
begin
  if v_actor is null or not exists (select 1 from auth.users where id = v_actor) then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  select deletion_token into v_deletion from public.trips where id = p_trip_id for update;
  if not found or v_deletion is not null then
    raise exception using errcode = '42501', message = 'Trip access management unavailable';
  end if;
  if not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = v_actor and role = 'owner') then
    raise exception using errcode = '42501', message = 'Owner access required';
  end if;
  return v_actor;
end;
$$;

create function app_private.create_trip_invitation(
  p_trip_id text, p_email text, p_token_hash text, p_role text default 'viewer'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_email text; v_id uuid; v_now timestamptz;
begin
  v_actor := app_private.lock_owned_trip(p_trip_id);
  v_now := clock_timestamp();
  v_email := app_private.normalize_invitation_email(p_email);
  if v_email is null or length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'Invalid invitation email';
  end if;
  if p_role is null or p_role not in ('viewer', 'editor') then
    raise exception using errcode = '22023', message = 'Invalid invitation role';
  end if;
  if exists (select 1 from auth.users where id = v_actor and app_private.normalize_invitation_email(email) = v_email) then
    raise exception using errcode = '22023', message = 'Cannot invite yourself';
  end if;
  if exists (select 1 from public.trip_members m join auth.users u on u.id = m.user_id
             where m.trip_id = p_trip_id and app_private.normalize_invitation_email(u.email) = v_email) then
    raise exception using errcode = '22023', message = 'Already a trip member';
  end if;
  update public.trip_invitations set status = 'expired'
    where trip_id = p_trip_id and invited_email_normalized = v_email and status = 'pending' and expires_at <= v_now;
  if exists (select 1 from public.trip_invitations where trip_id = p_trip_id and invited_email_normalized = v_email and status = 'pending') then
    raise exception using errcode = '23505', message = 'Invitation already pending';
  end if;
  insert into public.trip_invitations(trip_id, invited_email_normalized, role, invited_by, token_hash, created_at, expires_at)
  values (p_trip_id, v_email, p_role, v_actor, p_token_hash, v_now, v_now + interval '7 days') returning id into v_id;
  return v_id;
end;
$$;

create function app_private.revoke_trip_invitation(p_trip_id text, p_invitation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_inv public.trip_invitations; v_now timestamptz;
begin
  perform app_private.lock_owned_trip(p_trip_id);
  select * into v_inv from public.trip_invitations where trip_id = p_trip_id and id = p_invitation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Invitation unavailable'; end if;
  if v_inv.status <> 'pending' then return v_inv.status; end if;
  v_now := clock_timestamp();
  if v_inv.expires_at <= v_now then
    update public.trip_invitations set status = 'expired' where id = v_inv.id;
    return 'expired';
  end if;
  update public.trip_invitations set status = 'revoked', revoked_at = v_now where id = v_inv.id;
  return 'revoked';
end;
$$;

create function app_private.rotate_trip_invitation(p_trip_id text, p_invitation_id uuid, p_token_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_inv public.trip_invitations; v_now timestamptz;
begin
  perform app_private.lock_owned_trip(p_trip_id);
  select * into v_inv from public.trip_invitations where trip_id = p_trip_id and id = p_invitation_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Invitation unavailable'; end if;
  if v_inv.status <> 'pending' then return v_inv.status; end if;
  v_now := clock_timestamp();
  if v_inv.expires_at <= v_now then
    update public.trip_invitations set status = 'expired' where id = v_inv.id;
    return 'expired';
  end if;
  -- Another owner cannot silently assume a former owner's invitation.
  if not exists (select 1 from public.trip_members where trip_id = p_trip_id and user_id = v_inv.invited_by and role = 'owner') then
    raise exception using errcode = '42501', message = 'Inviter no longer authorized';
  end if;
  if p_token_hash = v_inv.token_hash then
    raise exception using errcode = '22023', message = 'A new token is required';
  end if;
  update public.trip_invitations set token_hash = p_token_hash, expires_at = v_now + interval '7 days' where id = v_inv.id;
  return 'rotated';
end;
$$;

-- The server hashes the supplied raw token before invoking this primitive.
-- Never take email/role/actor from the browser. Read current auth.users email,
-- not JWT email or raw_user_meta_data, which may be stale or user-editable.
create function app_private.accept_trip_invitation(p_token_hash text)
returns table(outcome text, trip_id text)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_trip_id text; v_deletion uuid;
  v_inv public.trip_invitations; v_email text; v_confirmed timestamptz; v_now timestamptz;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  -- This initial lookup confers no authority; re-read under the parent lock.
  select i.trip_id into v_trip_id from public.trip_invitations i where i.token_hash = p_token_hash;
  if not found then return query select 'unavailable'::text, null::text; return; end if;
  select t.deletion_token into v_deletion from public.trips t where t.id = v_trip_id for update;
  if not found or v_deletion is not null then return query select 'unavailable'::text, null::text; return; end if;
  select * into v_inv from public.trip_invitations i where i.trip_id = v_trip_id and i.token_hash = p_token_hash for update;
  if not found then return query select 'unavailable'::text, null::text; return; end if;
  select app_private.normalize_invitation_email(u.email), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_actor for share;
  if not found or v_email is null or v_confirmed is null or v_email <> v_inv.invited_email_normalized then
    return query select 'identity_mismatch'::text, null::text; return;
  end if;
  if v_inv.status = 'accepted' and v_inv.accepted_by = v_actor then
    -- Never reinsert, even after access was removed.
    return query select 'already_accepted'::text,
      case when exists (select 1 from public.trip_members m where m.trip_id = v_trip_id and m.user_id = v_actor) then v_trip_id else null end;
    return;
  end if;
  if v_inv.status <> 'pending' then return query select v_inv.status, null::text; return; end if;
  v_now := clock_timestamp();
  if v_inv.expires_at <= v_now then
    update public.trip_invitations set status = 'expired' where id = v_inv.id;
    return query select 'expired'::text, null::text; return;
  end if;
  if not exists (select 1 from public.trip_members m where m.trip_id = v_trip_id and m.user_id = v_inv.invited_by and m.role = 'owner') then
    return query select 'unavailable'::text, null::text; return;
  end if;
  if v_inv.role not in ('viewer', 'editor') then raise exception using errcode = '23514', message = 'Invalid invitation role'; end if;
  if exists (select 1 from public.trip_members m where m.trip_id = v_trip_id and m.user_id = v_actor) then
    return query select 'already_member'::text, v_trip_id; return;
  end if;
  insert into public.trip_members(trip_id, user_id, role) values (v_trip_id, v_actor, v_inv.role);
  update public.trip_invitations set status = 'accepted', accepted_at = v_now, accepted_by = v_actor where id = v_inv.id;
  return query select 'accepted'::text, v_trip_id;
end;
$$;

create function app_private.remove_trip_access(p_trip_id text, p_member_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_member public.trip_members;
begin
  v_actor := app_private.lock_owned_trip(p_trip_id);
  select * into v_member from public.trip_members where trip_id = p_trip_id and id = p_member_id for update;
  if not found then return false; end if;
  if v_member.role = 'owner' or v_member.user_id = v_actor then
    raise exception using errcode = '42501', message = 'Owner removal and leaving are not supported';
  end if;
  delete from public.trip_members where id = v_member.id;
  return true;
end;
$$;

create function app_private.list_trip_invitations(p_trip_id text)
returns table(id uuid, email text, role text, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.lock_owned_trip(p_trip_id);
  update public.trip_invitations i set status = 'expired'
    where i.trip_id = p_trip_id and i.status = 'pending' and i.expires_at <= clock_timestamp();
  return query select i.id, i.invited_email_normalized, i.role, i.status, i.created_at, i.expires_at
    from public.trip_invitations i where i.trip_id = p_trip_id order by i.created_at, i.id;
end;
$$;

create function app_private.list_trip_access(p_trip_id text)
returns table(id uuid, user_id uuid, email text, role text, is_current_user boolean)
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid;
begin
  v_actor := app_private.lock_owned_trip(p_trip_id);
  return query select m.id, m.user_id, u.email::text, m.role, m.user_id = v_actor
    from public.trip_members m join auth.users u on u.id = m.user_id
    where m.trip_id = p_trip_id order by (m.role = 'owner') desc, m.created_at, m.id;
end;
$$;

-- No public API yet. Revoke the default PUBLIC EXECUTE on every new function;
-- helper/trigger functions are not independently callable by service clients.
do $grants$
declare v_signature text;
begin
  foreach v_signature in array array[
    'lock_membership_trip()', 'assert_trip_owner()', 'reject_membership_truncate()',
    'normalize_invitation_email(text)', 'guard_invitation_transition()', 'lock_owned_trip(text)',
    'create_trip_invitation(text,text,text,text)', 'revoke_trip_invitation(text,uuid)',
    'rotate_trip_invitation(text,uuid,text)', 'accept_trip_invitation(text)',
    'remove_trip_access(text,uuid)', 'list_trip_invitations(text)', 'list_trip_access(text)'
  ] loop
    execute 'revoke all on function app_private.' || v_signature || ' from public, anon, authenticated, service_role';
  end loop;
end
$grants$;
grant execute on function app_private.create_trip_invitation(text,text,text,text),
  app_private.revoke_trip_invitation(text,uuid), app_private.rotate_trip_invitation(text,uuid,text),
  app_private.accept_trip_invitation(text), app_private.remove_trip_access(text,uuid),
  app_private.list_trip_invitations(text), app_private.list_trip_access(text) to service_role;
