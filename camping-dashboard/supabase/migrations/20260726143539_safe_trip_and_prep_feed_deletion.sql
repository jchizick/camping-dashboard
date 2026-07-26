-- Trip/prep-feed deletion contract.
--
-- Storage objects cannot participate in a Postgres transaction. A trip is
-- therefore first marked pending deletion, storage is removed through the
-- Storage API, and only then is the trip deleted through a second restricted
-- RPC. A pending trip is read-only and the operation is safe to retry.

do $guard$
declare
  v_bad_id text;
  v_bad_url text;
  v_duplicate_path text;
begin
  select p.id::text
  into v_bad_id
  from public.prep_feed_items p
  left join public.trips t on t.id = p.trip_id
  where p.trip_id is null or t.id is null
  limit 1;

  if v_bad_id is not null then
    raise exception
      'Prep-feed deletion migration aborted: item % has a null or orphaned trip_id',
      v_bad_id;
  end if;

  -- Every current first-party URL must resolve to an existing object inside
  -- its owning trip namespace. Other HTTP(S) URLs remain external references.
  select p.image_url
  into v_bad_url
  from public.prep_feed_items p
  where p.image_url like '%/storage/v1/object/public/prep-feed/%'
    and (
      split_part(
        p.image_url,
        '/storage/v1/object/public/prep-feed/',
        2
      ) = ''
      or left(
        split_part(
          p.image_url,
          '/storage/v1/object/public/prep-feed/',
          2
        ),
        length(p.trip_id) + 1
      ) <> p.trip_id || '/'
      or not exists (
        select 1
        from storage.objects o
        where o.bucket_id = 'prep-feed'
          and o.name = split_part(
            p.image_url,
            '/storage/v1/object/public/prep-feed/',
            2
          )
      )
    )
  limit 1;

  if v_bad_url is not null then
    raise exception
      'Prep-feed deletion migration aborted: a first-party image URL is outside its trip namespace or missing from Storage';
  end if;

  select derived.storage_path
  into v_duplicate_path
  from (
    select split_part(
      p.image_url,
      '/storage/v1/object/public/prep-feed/',
      2
    ) as storage_path
    from public.prep_feed_items p
    where p.image_url like '%/storage/v1/object/public/prep-feed/%'
  ) derived
  group by derived.storage_path
  having count(*) > 1
  limit 1;

  if v_duplicate_path is not null then
    raise exception
      'Prep-feed deletion migration aborted: storage object % is referenced more than once',
      v_duplicate_path;
  end if;
end
$guard$;

alter table public.prep_feed_items
  add column storage_path text;

update public.prep_feed_items
set storage_path = split_part(
  image_url,
  '/storage/v1/object/public/prep-feed/',
  2
)
where image_url like '%/storage/v1/object/public/prep-feed/%';

alter table public.prep_feed_items
  alter column image_url drop not null,
  drop constraint prep_feed_items_trip_id_fkey,
  add constraint prep_feed_items_trip_id_fkey
    foreign key (trip_id)
    references public.trips(id)
    on delete cascade,
  add constraint prep_feed_items_storage_path_namespace_check
    check (
      storage_path is null
      or (
        left(storage_path, length(trip_id) + 1) = trip_id || '/'
        and length(storage_path) <= 1024
        and position(chr(92) in storage_path) = 0
        and storage_path not like '%..%'
        and storage_path not like '/%'
        and storage_path not like '%//%'
      )
    ),
  add constraint prep_feed_items_first_party_reference_check
    check (
      image_url is null
      or image_url not like '%/storage/v1/object/public/prep-feed/%'
      or storage_path is not null
    );

create index prep_feed_items_trip_id_idx
  on public.prep_feed_items (trip_id);

create unique index prep_feed_items_storage_path_unique_idx
  on public.prep_feed_items (storage_path)
  where storage_path is not null;

create table public.prep_feed_storage_cleanup_jobs (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  item_id uuid,
  storage_path text not null,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  constraint prep_feed_cleanup_path_namespace_check
    check (
      left(storage_path, length(trip_id) + 1) = trip_id || '/'
      and length(storage_path) <= 1024
      and position(chr(92) in storage_path) = 0
      and storage_path not like '%..%'
      and storage_path not like '/%'
      and storage_path not like '%//%'
    )
);

alter table public.prep_feed_storage_cleanup_jobs enable row level security;
revoke all on table public.prep_feed_storage_cleanup_jobs from anon, authenticated;
grant select, insert, update, delete
  on table public.prep_feed_storage_cleanup_jobs
  to service_role;

create unique index prep_feed_storage_cleanup_pending_path_idx
  on public.prep_feed_storage_cleanup_jobs (storage_path)
  where completed_at is null;

alter table public.trips
  add column deletion_pending_at timestamp with time zone,
  add column deletion_token uuid,
  add constraint trips_deletion_state_check
    check (
      (deletion_pending_at is null and deletion_token is null)
      or (deletion_pending_at is not null and deletion_token is not null)
    );

create or replace function public.can_edit_trip(p_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.trip_members tm
    join public.trips t on t.id = tm.trip_id
    where tm.trip_id = p_trip_id
      and tm.user_id = (select auth.uid())
      and tm.role in ('owner', 'editor')
      and t.deletion_token is null
  );
$function$;

revoke all on function public.can_edit_trip(text) from public, anon;
grant execute on function public.can_edit_trip(text) to authenticated;

create or replace function public.is_trip_owner(p_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.trip_members tm
    join public.trips t on t.id = tm.trip_id
    where tm.trip_id = p_trip_id
      and tm.user_id = (select auth.uid())
      and tm.role = 'owner'
      and t.deletion_token is null
  );
$function$;

revoke all on function public.is_trip_owner(text) from public, anon;
grant execute on function public.is_trip_owner(text) to authenticated;

create or replace function public.begin_trip_deletion(p_trip_id text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_token uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select t.deletion_token
  into v_token
  from public.trips t
  where t.id = p_trip_id
    and exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = t.id
        and tm.user_id = v_user_id
        and tm.role = 'owner'
    )
  for update;

  if not found then
    if exists (select 1 from public.trips t where t.id = p_trip_id) then
      raise exception using
        errcode = '42501',
        message = 'Only the trip owner can delete this trip';
    end if;

    raise exception using
      errcode = 'P0002',
      message = 'Trip not found';
  end if;

  if v_token is null then
    v_token := gen_random_uuid();
    update public.trips
    set deletion_pending_at = now(),
        deletion_token = v_token
    where id = p_trip_id;
  end if;

  return v_token;
end
$function$;

create or replace function public.complete_trip_deletion(
  p_trip_id text,
  p_deletion_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  perform 1
  from public.trips t
  where t.id = p_trip_id
    and t.deletion_token = p_deletion_token
    and exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = t.id
        and tm.user_id = v_user_id
        and tm.role = 'owner'
    )
  for update;

  if not found then
    if exists (select 1 from public.trips t where t.id = p_trip_id) then
      raise exception using
        errcode = '42501',
        message = 'Deletion ownership or token check failed';
    end if;

    raise exception using
      errcode = 'P0002',
      message = 'Trip not found';
  end if;

  delete from public.trips
  where id = p_trip_id
    and deletion_token = p_deletion_token;

  return found;
end
$function$;

revoke all on function public.begin_trip_deletion(text) from public, anon;
revoke all on function public.complete_trip_deletion(text, uuid) from public, anon;
grant execute on function public.begin_trip_deletion(text) to authenticated;
grant execute on function public.complete_trip_deletion(text, uuid) to authenticated;

create or replace function public.replace_prep_feed_image(
  p_item_id uuid,
  p_actor_user_id uuid,
  p_image_url text,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_trip_id text;
  v_old_path text;
  v_cleanup_id uuid;
begin
  select p.trip_id, p.storage_path
  into v_trip_id, v_old_path
  from public.prep_feed_items p
  join public.trips t on t.id = p.trip_id
  where p.id = p_item_id
    and t.deletion_token is null
    and exists (
      select 1
      from public.trip_members tm
      where tm.trip_id = p.trip_id
        and tm.user_id = p_actor_user_id
        and tm.role in ('owner', 'editor')
    )
  for update of p;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Prep-feed item not found or actor cannot edit it';
  end if;

  if p_storage_path is not null and (
    left(p_storage_path, length(v_trip_id) + 1) <> v_trip_id || '/'
    or length(p_storage_path) > 1024
    or position(chr(92) in p_storage_path) > 0
    or p_storage_path like '%..%'
    or p_storage_path like '/%'
    or p_storage_path like '%//%'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid prep-feed storage path';
  end if;

  update public.prep_feed_items
  set image_url = p_image_url,
      storage_path = p_storage_path
  where id = p_item_id;

  if v_old_path is not null and v_old_path is distinct from p_storage_path then
    insert into public.prep_feed_storage_cleanup_jobs (
      trip_id,
      item_id,
      storage_path
    )
    values (v_trip_id, p_item_id, v_old_path)
    on conflict (storage_path) where completed_at is null
    do update set item_id = excluded.item_id
    returning id into v_cleanup_id;
  end if;

  return jsonb_build_object(
    'trip_id', v_trip_id,
    'old_storage_path', v_old_path,
    'cleanup_id', v_cleanup_id
  );
end
$function$;

revoke all on function public.replace_prep_feed_image(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.replace_prep_feed_image(uuid, uuid, text, text)
  to service_role;

-- Trip deletion must go through the storage-aware server route/RPC sequence.
drop policy if exists owner_delete on public.trips;

drop policy if exists member_select on public.prep_feed_items;
drop policy if exists editor_insert on public.prep_feed_items;
drop policy if exists editor_update on public.prep_feed_items;
drop policy if exists editor_delete on public.prep_feed_items;

create policy member_select
on public.prep_feed_items
for select
to authenticated
using (public.is_trip_member(trip_id));

create policy editor_insert
on public.prep_feed_items
for insert
to authenticated
with check (public.can_edit_trip(trip_id));

create policy editor_update
on public.prep_feed_items
for update
to authenticated
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

create policy editor_delete
on public.prep_feed_items
for delete
to authenticated
using (public.can_edit_trip(trip_id));

-- Remove the legacy policies that let any authenticated user mutate any
-- prep-feed object, then make membership and pending-deletion checks explicit.
drop policy if exists auth_delete_prep_feed_objects on storage.objects;
drop policy if exists auth_upload_prep_feed_objects on storage.objects;
drop policy if exists member_delete_prep_feed on storage.objects;
drop policy if exists member_upload_prep_feed on storage.objects;
drop policy if exists public_read_prep_feed_objects on storage.objects;

create policy member_upload_prep_feed
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'prep-feed'
  and public.can_edit_trip((storage.foldername(name))[1])
);

create policy member_delete_prep_feed
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'prep-feed'
  and public.can_edit_trip((storage.foldername(name))[1])
);
