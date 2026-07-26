# Supabase advisory remediation report

Date: 2026-07-26
Hosted project: `Camping Dashboard` (`gdsmyxzqtmhwbcyobzou`)
Scope: hosted migration application, advisor verification, RLS and function
security, cleanup-queue privileges, foreign-key indexes, Storage behavior, and
production regression QA.

No commit, push, dependency change, UI change, MapTiler change, authentication
provider change, plan change, or cleanup-worker change was made.

## 1. Hosted precondition comparison

Before application, the hosted migration history ended at
`20260726143737`; neither approved migration was present.

The affected hosted objects matched the migration guards:

- the three RLS helpers had the expected signatures, owners, volatility,
  definer status, search paths, and grants;
- the unused `public.user_trip_role(text)` helper matched its expected legacy
  definition and had no database dependency;
- `can_edit_trip`, `is_trip_member`, and `is_trip_owner` were referenced only
  by the expected policies (29, 14, and 3 dependencies respectively);
- all 40 application policies that targeted `PUBLIC` were identified;
- no application code, API route, Edge Function, cron job, trigger, rule, view,
  or additional hosted function directly invoked the four helper RPCs;
- no Edge Functions or cron schema were present;
- the cleanup queue had RLS enabled, no policies, no ordinary-role access, and
  service-role DML;
- all six guarded foreign keys matched their expected columns, targets, and
  `ON DELETE CASCADE` behavior;
- none of the six proposed indexes or an equivalent conflicting index existed.

`ALTER FUNCTION ... SET SCHEMA` preserves the function OID, so dependent
policies remained attached while their expressions were rewritten to
`app_private.*`.

## 2. Migration application result

Applied through the linked Supabase migration workflow, in order:

1. `20260726174306_harden_rls_helpers_and_cleanup_queue.sql`
2. `20260726174312_index_remaining_foreign_keys.sql`

Post-application inspection found that an older broad service-role table grant
still supplied `TRUNCATE`, `REFERENCES`, and `TRIGGER` on the cleanup queue.
The already-applied migrations were not edited. A focused follow-up migration
was created, tested, and applied:

3. `20260726181155_narrow_cleanup_queue_service_role_privileges.sql`

Hosted migration history contains all three versions exactly once. The CLI
reported a post-application catalog-cache warning caused by its temporary CA
file, but independent migration-history and catalog checks confirmed every
application succeeded.

## 3. Live function and grant state

The three RLS helpers now exist only in `app_private`; no helper remains in
`public`, and `user_trip_role` is absent.

All remaining application `SECURITY DEFINER` functions are owned by `postgres`,
use an empty fixed `search_path`, and fully qualify application objects.

| Function | Live execute grants | Purpose |
| --- | --- | --- |
| `app_private.is_trip_member(text)` | `authenticated`, `service_role` | RLS evaluation only |
| `app_private.is_trip_owner(text)` | `authenticated`, `service_role` | RLS evaluation only |
| `app_private.can_edit_trip(text)` | `authenticated`, `service_role` | RLS and Storage policy evaluation |
| `public.create_trip(...)` | `authenticated` | Atomic authenticated trip creation |
| `public.begin_trip_deletion(text)` | `authenticated`, `service_role` | Owner-checked, retry-safe deletion start |
| `public.complete_trip_deletion(text,uuid)` | `authenticated`, `service_role` | Owner/token-checked deletion completion |
| `public.replace_prep_feed_image(...)` | `service_role` | Trusted server-side image replacement |

`PUBLIC` and `anon` have no execution on these functions. Authenticated users
retain only the three intended public workflow RPCs. The cleanup queue grants
are now exactly `SELECT`, `INSERT`, `UPDATE`, and `DELETE` for `service_role`;
ordinary roles have no queue access, and the service role no longer has
`TRUNCATE`, `REFERENCES`, or `TRIGGER`.

All 44 current public-table policies target `authenticated`. Their helper
expressions resolve to `app_private.*`, including the Storage mutation
policies. An anonymous REST request using `Accept-Profile: app_private`
returned HTTP 406, confirming that the private schema is not exposed through
the project API configuration.

## 4. Final hosted advisor matrix

### Security

| Code | Object | Severity | Classification | Reason retained |
| --- | --- | --- | --- | --- |
| 0008 `rls_enabled_no_policy` | `public.prep_feed_storage_cleanup_jobs` | INFO | Intentional | Service-only queue; RLS plus no user policy is deliberate |
| 0029 `authenticated_security_definer_function_executable` | `public.create_trip(...)` | WARN | Intentional | Authenticated atomic workflow with internal identity checks |
| 0029 `authenticated_security_definer_function_executable` | `public.begin_trip_deletion(text)` | WARN | Intentional | Owner check and retry token are enforced inside the function |
| 0029 `authenticated_security_definer_function_executable` | `public.complete_trip_deletion(text,uuid)` | WARN | Intentional | Owner and deletion-token checks are enforced inside the function |
| `auth_leaked_password_protection` | Supabase Auth | WARN | Plan-limited | Current Free plan does not expose the control |

The former helper exposure findings are gone.

### Performance

The unindexed-foreign-key findings are gone. The advisor now reports six INFO
`unused_index` findings, one for each newly created index. These are expected
immediately after creation, before a meaningful statistics window, and are not
application defects or candidates for removal.

## 5. Owner, editor, viewer, and non-member QA

A hosted transaction created four synthetic identities and one disposable
trip, exercised the live RLS and RPC paths, and rolled everything back. All 29
assertions passed:

- owner: create/read trip, update campsite coordinates and settings,
  create/update park intel and offline state, create prep-feed data, use a
  same-trip Storage upload path, begin deletion twice with the same token, and
  complete whole-trip deletion;
- editor: load member-authorized data, edit the trip, create/update/delete
  prep-feed data, use a same-trip Storage upload path, and receive rejection
  for deletion and owner-only membership operations;
- viewer: read member-authorized private data and receive rejection for trip,
  prep-feed, Storage, and deletion mutations;
- authenticated non-member: see zero trip and membership rows and receive
  rejection from the deletion RPC;
- anonymous: see zero private trip and membership rows and be unable to resolve
  the removed public helper RPCs;
- service role: replace an image, enqueue the old path, and update the cleanup
  queue;
- pending trip: reject ordinary trip and prep-feed edits;
- completed deletion: cascade all application rows.

Anonymous HTTP verification also returned:

- private trip query: HTTP 200 with no visible rows;
- removed `can_edit_trip` RPC: HTTP 404;
- removed `user_trip_role` RPC: HTTP 404;
- unauthenticated trip-create route: HTTP 401;
- unauthenticated trip-delete route: HTTP 401.

Interactive Google OAuth reached Supabase successfully and Supabase logged a
successful Google login, but the deployed callback returned to `/trips`
without retaining the browser session. A second attempt behaved identically.
Consequently, authenticated browser control visibility and live weather
refresh were not claimed as passed; the database/RLS equivalents above were
used for mutation coverage.

## 6. Storage and trip-deletion regression

- An existing public known-object URL returned HTTP 200 with `image/jpeg`.
- Anonymous listing of a QA-only prefix returned HTTP 200 with an empty array;
  no object name was disclosed.
- An authenticated role could insert same-trip owner/editor object rows but
  could not enumerate them through SQL because no Storage `SELECT` policy
  exists.
- Viewer uploads were rejected.
- Storage mutation policies reference `app_private.can_edit_trip`, retaining
  the first-path-segment trip scope and pending-trip check.
- Direct SQL deletion from `storage.objects` was correctly blocked by
  Supabase's `storage.protect_delete()` safeguard; production deletion must go
  through the Storage API.
- The hosted transactional suite confirmed retry-safe deletion, pending-trip
  protections, application-row cascades, image replacement, and cleanup-queue
  service DML.

An authenticated production Storage API edit/replace/delete could not be
completed because of the deployed OAuth callback limitation described above.
The policy contracts and local end-to-end database tests passed.

## 7. Index verification

All six indexes are live, valid, ready, and use the intended B-tree leading
column:

- `alerts_trip_id_idx`
- `crew_members_trip_id_idx`
- `gear_items_trip_id_idx`
- `meals_trip_id_idx`
- `timeline_events_trip_id_idx`
- `trip_members_user_id_idx`

No invalid or redundant duplicate index was found. With sequential scans
disabled only to prove planner usability, representative hosted `EXPLAIN`
plans selected all six expected indexes.

## 8. Leaked-password classification

The project is on the Free plan, which does not expose leaked-password
protection. Production authentication uses Google OAuth, and hosted aggregation
found two Google-primary users and zero password-authenticated users.

No provider or plan setting was changed. Enable leaked-password protection if
the project moves to a supporting plan or before email/password authentication
is introduced.

## 9. Validation results

- `npm run types:supabase:check`: passed
- `npm test`: 40/40 passed
- `npm run test:db`: 87/87 passed
- `npx tsc --noEmit`: passed
- `npm run lint`: passed with 22 pre-existing warnings and zero errors
- `npm run build`: passed
- `git diff --check`: passed
- hosted security advisor: rerun; only the five classified findings above
- hosted performance advisor: rerun; only six new-index observation-window
  INFO findings

## 10. QA cleanup confirmation

The hosted role suite ran inside a transaction and ended with `ROLLBACK`.
Independent cleanup verification found:

- zero synthetic QA Auth users;
- zero disposable QA trips;
- zero disposable QA Storage rows.

No credentials, OAuth tokens, generated screenshots, or hosted data artifacts
were written to the repository.

## 11. Remaining limitations

- The deployed Google OAuth callback does not retain the production browser
  session even though Supabase records a successful login. This prevented
  authenticated UI-control checks, authenticated Storage API deletion, and a
  live weather refresh.
- Fresh-index `idx_scan = 0` statistics are expected until production traffic
  exercises the new access paths.
- Advisor 0008 cannot model the cleanup queue's intentional service-only RLS
  design.
- Leaked-password protection remains plan-limited.
- ESLint still reports 22 unrelated warnings and zero errors.

## 12. Proposed commit message

`harden Supabase helpers and index remaining foreign keys`
