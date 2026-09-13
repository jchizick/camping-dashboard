# Migration 34 security and database review

Verdict: **PASS — no reportable security findings identified in the scoped package.**
Local review only; this does not authorize a hosted migration, deployment or UI rollout.
Baseline: `a1bc8bf0aa4ea3d238f58ce00388a76a22329d6e`.

## Reviewed immutable migration

- File: `supabase/migrations/20260913204351_trip_access_management_read.sql`
- Version: `20260913204351` (migration 34)
- SHA-256: `e54a591b31157766771fdef6cf7b4de3eff539434ae6156a690d16041a91aaf3`
- Only modified object: `public.trip_invitation_bridge(uuid,text,jsonb) RETURNS jsonb`.
- Only changed executable behavior: the `list_access` branch at lines 42–71.
- Owner remains postgres; SECURITY DEFINER and empty search_path remain unchanged.
- Effective grants changed: none. EXECUTE remains postgres/service_role; PUBLIC,
  authenticated and anon cannot execute the bridge.
- No tables, RLS, triggers, FKs, private functions or public type signatures change.
- The existing create/resend/revoke/inspect/accept/removal and delivery branches match
  final-33 code after accounting for checkout line endings and the new branch/comments.

No migration bytes or production implementation files were changed during this review.

## Trust boundary and confidentiality

`src/app/api/invitations/route.ts:42–69` validates origin and a bounded JSON body,
uses the closed operation allowlist, and gets the caller from server `auth.getUser()`.
`src/lib/invitations/service.ts:13–28,40–50` permits only `tripId` for `list_access`;
actor IDs, roles, owner booleans, claims and token input are rejected.
`src/lib/invitations/server.ts:14–24` uses a lazy, separate service-only client and
the fixed bridge RPC. SQL details are mapped to safe errors, not returned/logged.

The bridge validates the actor exists, establishes transaction-local identity,
validates its own tripId-only payload and calls `app_private.lock_owned_trip` before
the projection. That primitive locks the parent trip, rejects absent/deleting trips,
then checks current owner membership. Membership changes serialize on the same parent.
The owner-demotion race passes: a read waiting behind demotion is denied without a
roster, email or pending-recipient result. No client/page role grants authority.

There is no dynamic SQL, arbitrary function dispatcher or caller-controlled object
name. Unknown HTTP operations fail 400; unknown bridge operations fail without data.
Owner succeeds; Viewer, Editor and another trip's Owner receive safe 403. Missing or
invalid sessions receive 401. Missing schema/transport failures remain safe 503.

## Identity resolver and response

`app_private.list_trip_access(text)` is an existing postgres-owned SECURITY DEFINER
function with empty search_path. Its existing effective EXECUTE access is
postgres/service_role, not PUBLIC/anon/authenticated. `lock_owned_trip` is likewise
postgres-owned with empty search_path and has no direct application-role grant.
Permanent references are schema-qualified; unqualified built-ins resolve in pg_catalog.

The resolver joins `public.trip_members` to `auth.users` and returns membership ID,
user ID, email, role and current-user flag. The new bridge discards user ID, then the
server DTO explicitly projects its allowlisted fields again. No browser Auth grant
or denormalized public identity table is introduced.

People expose only `membershipId`, `email`, `role`, `isCurrentUser`. The last field is
useful for a future “you” label and adds no independent Auth identity. Null/empty or
whitespace-only email becomes null; a future neutral “Unknown member” label is safe.
Deleted Auth identities cascade their membership deletion and do not break the roster.
Provider identities, OAuth/user metadata, password, phone, session and refresh fields
are neither queried nor serialized.

Ordering is Owner, Editor, Viewer, then lowercased email using C collation (null treated
as empty), then membership UUID. Null ordering and ties are deterministic.

Pending rows expose only `invitationId`, `email`, `role`, literal `status: pending`,
`createdAt`, `expiresAt`. The literal status is redundant but consistent with existing
invitation summaries and explicit for future consumers; no expansion is needed.
Order is newest creation time first, then UUID. Returned IDs work unchanged with
resend/revoke/remove_access, verified through the real local bridge.

SQL assertions on an actual serialized Owner result prove exact keys and absence of
fixture Auth IDs/token-hash values. Defensive service tests discard extra fields.
No raw token, hash, provider message/response, delivery attempt, idempotency key,
rate key, service credential, Auth metadata or token lineage reaches the DTO.

## Current creator and expiry semantics

The predicate is the requested trip, `status = 'pending'`,
`expires_at > clock_timestamp()`, and an existing membership with
`user_id = invitation.invited_by`, the same trip, and `role = 'owner'`.
This means the **original creator currently owns the same trip**; it does not require
that creator to be the requesting Owner, and merely having another Owner is insufficient.

Tests create a valid invitation as Owner B and read it as Owner A. Changing an unrelated
Viewer to Editor leaves it visible. Demoting B hides it and existing resend denies it,
consistent with existing acceptance/rotation rules. Re-promoting B restores eligibility.
These are legal DB fixture operations, not a new ownership-transfer product flow.

Product caveat: hiding is not revocation. The stored pending row still occupies the
existing trip/recipient unique constraint, so another create is rejected until it is
revoked or expired. An Owner who retains its ID can use the existing revoke operation.
Future ownership-management UX must account for this; migration 34 introduces no new
lifecycle mutation and does not accidentally exclude still-eligible invitations.

Expiry tests exclude equality at transaction start and include a future deadline,
then cross that deadline within the same transaction and prove exclusion. DB wall time,
not a client timestamp or transaction-start-only clock, controls the read. No expiry
status is written. Repeated full-row snapshots prove invitations, memberships, delivery
attempts/state, resend hashes and persistent rate storage remain identical.

## Availability, quotas and production dormancy

Authenticated `GET /api/invitations` returns only `{tripAccessAvailable:boolean}`,
private/no-store. It rejects query parameters and cross-site fetches. Any authenticated
user can safely learn aggregate feature readiness. It does not query schema or return
provider/key/migration/environment diagnostic fields. A true value necessarily indicates
the existing configuration gate passed; it is not independent evidence of a particular
secret or delivery health. False cannot distinguish disabled from incomplete config.

With the real configuration helper disabled and no privileged keys, GET returns false
and POST returns 503 without a bridge call or rate write. This does not require production's
missing invitation tables. Missing-schema enabled calls also fail safely. No separate
28-migration runtime was instantiated; pre-RPC disabled-path tests and a disabled isolated
production build establish this code-path safety without contacting production.

Management reads intentionally skip both the route's durable network limiter and the
service's durable actor limiter. GET skips them too. There is no separate in-process
management limiter in this patch. Opening a future sheet cannot consume send/accept
quotas. Existing valid mutation requests retain their limiting. Malformed requests now
fail bounded parsing before that network limiter; this is not a permission bypass.

## Fresh validation

- Exact fresh history: 34 migrations, final `20260913204351` — PASS.
- Final-33 strict catalog: `58c4311b982fe8716cbc19ea5c687093` — MATCH.
- Final-34 strict catalog: `3c6049625e9eb174cbe148eb44592da0` — MATCH.
- Only catalog delta: public bridge definition; all grants/private bodies unchanged.
- `NORMALIZED_TYPE_EQUIVALENT` and `TYPE_STRUCTURE_EQUIVALENT` — PASS.
- Focused Vitest: **144 passed, 20 skipped** across 9 passing and 2 skipped files.
  Skips are existing opt-in local HTTP integration suites, not the new assertions.
- SQL: **456 passed**, including 31 management and 27 additional review assertions.
- Concurrency: **8 passed**, including stale-owner management denial after lock wait.
- Existing create/resend/revoke/inspect/accept/remove_access regression coverage — PASS.
- Standard TypeScript and production build — PASS in isolated candidate source.
- Scoped ESLint, whitespace and secret/private-path scan — PASS.

The isolated build used only loopback Supabase settings/non-secret placeholders with
invitations disabled. No hosted invitation QA or private account data was used. The
reviewed historical EOL reconstruction reproduces pinned bytes; expected fingerprints
and migration bytes were not changed to pass replay.

## Future guarded transition (documentation only)

`STAGING_ACCESS_MANAGEMENT_33_TO_34` must require the exact existing staging project
identity, approved source/dependency pins, exact 33 starting versions, and strict
`58c4311b982fe8716cbc19ea5c687093` catalog. Pin migration 34 to the SHA above; allow only
that single pending migration. Require a dry-run, one apply, exact 34 ending versions,
`3c6049625e9eb174cbe148eb44592da0`, unchanged privileges and normalized/structural types.
Refuse already-complete or any unexpected state. Retain existing identity/TLS, abort,
recovery and deployment-hold gates. No transition implementation or execution occurred.

`ACCOUNT_SWITCH_SIGNOUT_SCOPE_REVIEW` remains deferred. No auth/sign-out changes.
Crew stays independent. Existing REAL INVITATION PIPELINE — FULL QA PASS is unchanged
by this local review; that does not mean migration 34 has hosted QA approval.

## Review additions and safety

Only three package files were added during this review:

- `src/app/api/invitations/managementSecurity.test.ts`
- `supabase/tests/trip_access_management_security_test.sql`
- `docs/trip-access-management-security-review.md`

The original 11-file candidate was reviewed unchanged. Generated local evidence resides
under ignored `output/trip-access-management/` and the Codex scan directory. All 28
pre-existing unrelated files retain their hashes; nothing is staged or committed.
Production was untouched. Staging remains last-verified PAUSED and Our Adventures
last-verified ACTIVE_HEALTHY; neither was contacted. No hosted migration, email,
deployment, commit or push. No visible UI built.

## Scan artifact bookkeeping limitation

Codex Security finalized scan `b675409c-8eab-4176-9d55-0b157ffcfe87` with zero findings.
Its sealed coverage retained an earlier “Local validation — In progress” checkpoint
despite the final submission reporting completed checks, so its coverage label is
partial. The actual completed validation and limitations are recorded above and in
the local evidence. The sealed artifact was not rewritten or finalized again.
Its working-tree snapshot warning reflects the added review tests/report; the reviewed
migration hash and original candidate remain unchanged. Usage telemetry is partial
and includes an invalid-record warning, so it is not a reliable complete usage total.
