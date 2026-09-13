# Trusted trip access removal

Packaging note: the partial manifest and historical totals below are superseded by [the authoritative combined package](trip-access-removal-package.md). Retain this report as implementation history; use the combined package for the current file set and release gate.

Repository-only candidate. No UI, hosted migration, delivery enablement or deployment.
Real Google-account execution: **REAL_STAGING_SESSION_QA_PENDING**.

## Product request and authorization

`POST /api/invitations`, same-origin JSON:

```json
{"operation":"remove_access","tripId":"synthetic-trip-id","membershipId":"10000000-0000-0000-0000-000000000812"}
```

The request route retains mandatory exact Origin and cross-site rejection, the existing
invitation configuration gate, bounded JSON, distributed throttling and private/no-store
responses. `createRequestSupabaseClient()` creates the cookie-backed SSR client for the
configured Supabase project. The route calls **`client.auth.getUser()`**; only a user
returned without an authentication error supplies the actor ID. Decoded JWT contents,
body actor/owner/role fields and user metadata are not authorization sources.

`runInvitationOperation()` routes to `removeTripAccess()`. Strict input accepts only the
target trip and membership UUID. It invokes `callInvitationBridge()` using the separate
lazy service-role client, with session persistence and auto-refresh disabled. No application
code deletes membership rows. Database errors are mapped to the existing generic codes;
no raw database error, cookie, token or key is logged.

The existing `public.trip_invitation_bridge(uuid,text,jsonb)` is a coherent trusted
access/invitation dispatcher: acceptance already manages memberships. Its new
`remove_access` branch reuses its verified-actor mechanism. The public RPC is executable
only by `service_role` among application roles. It checks that `p_actor` is a real Auth
user and establishes **transaction-local** `request.jwt.claim.sub` and
`request.jwt.claims` from that server-verified actor. This is why `auth.uid()` inside
`app_private.remove_trip_access(text,uuid)` sees the end user rather than an anonymous
privileged connection. Browser roles cannot call the bridge and select an actor.

The private primitive remains unchanged. It locks the parent trip, checks current owner
membership after acquiring the lock, locks the target, and rejects owners/self-removal.
The existing deferred final-owner constraints remain unchanged. Prior claims are restored
on success; statement rollback restores them on exception. SQL tests exercise both paths.
Neither private schema exposure nor function grants are broadened.

Success is `{ "outcome": "access_removed" }`. After owner authorization, an absent or
already-removed membership has the same result, so it does not disclose membership
existence. Unauthenticated callers receive 401, authorization denial 403, unexpected
input 400. Missing schema/transport errors fail closed. Disabled configuration returns
503 before session/bridge use. No email/provider delivery operation is invoked by removal.
The existing configuration gate still requires the configured invitation infrastructure;
this task does not split access-management enablement from delivery configuration.

Crew is independent: only its optional `trip_member_id` link clears via the existing
`ON DELETE SET NULL` FK. The Crew row and gear/meal responsibility rows and assignments
survive unchanged. “Leave trip” and owner transfer/removal remain unsupported.

## Migration and strict staging target

New migration: `20260913131931_trip_access_removal_bridge.sql` (migration 33).
It replaces only the existing public bridge definition and reiterates the same public
bridge grants. The private primitive, private grants and all other catalog entries remain
unchanged. Generated public types are unchanged because the RPC signature remains JSONB.

The separate `accessRemovalContract.mjs` is the **33-migration verification target**:

- Exact ordered historical 32 versions plus migration 33, with pinned migration bytes.
- Strict final catalog: `58c4311b982fe8716cbc19ea5c687093`.
- Existing local normalized/structural and hosted semantic/capability type checks reused.
- No apply, repair, deployment or hold-release operation.

The reviewed `postMigrationContract.mjs`, manifest and `STAGING_REPAIR_31_TO_32` remain
frozen. They must not be repurposed to apply migration 33. Staging is still paused at its
last-verified 32 migrations; **a separately reviewed 32→33 migration/deployment window is
required before real removal QA**. The new verifier can be consumed only after the existing
project/TLS/SQL identity gates; it does not replace provenance checks or authorize downtime.

Fresh replay exposed historical checkout EOL differences: the existing manifest pins CRLF
function bodies while Git source here contains LF. The local validator reconstructs only
bytes matching the already-pinned hash (LF or CRLF); any semantic/other change fails. It
does not normalize or weaken the catalog check. With approved bytes replayed, restoring
only the old bridge in a rolled-back local transaction reproduces the exact prior
`b3e3c93d5de2a53b9e7a4afae89d9ada` catalog. This also proves all private functions and ACLs
remain unchanged. New migration 33 bytes are pinned separately.

## Durable local verification

From the app root, with the existing disposable `invitation-phase1-test` Docker database:

```text
node scripts/staging/validate-access-removal.mjs --reset-disposable
node scripts/test-trip-invitations.mjs
node scripts/test-invitation-delivery.mjs
```

The first command accepts no hosted URL, credentials or project override. It replays the
entire 33-migration history from zero, checks the strict catalog and unchanged remainder,
regenerates types, and preserves evidence under ignored `output/access-removal-validation`.
Run DB suites sequentially; they share this disposable database.

Enable `INVITATION_LOCAL_DB_TEST=true` for `removalLocal.test.ts` and
`localLifecycle.test.ts`. The former calls the actual POST route, domain service and
server RPC/error adapter with a stubbed `getUser()` and a local SQL transport running
**SET LOCAL ROLE service_role**. Assertions verify Owner success, Viewer/Editor/other-user
denial, spoof rejection, absent/invalid authentication, owner/self/final-owner protection,
normal Editor rights and Crew/gear/meal preservation. The lifecycle suite now removes
through the product operation before verifying consumed invitations cannot regrant access.
These synthetic tests do **not** claim to prove a real hosted Google session or foreign JWT.

## Real-session harness (not run in this task)

During a separately authorized staging QA window, after migration/deployment verification:

1. Use the controlled Owner A or Invitee B Google account and check the identity in Account.
2. Open DevTools on exactly `https://staging.fieldprotocol.online`.
3. Paste `scripts/staging/access-removal-in-page.js`. Pasting sends no request.
4. Call `fieldProtocolAccessRemovalQA({tripId, membershipId, expected, confirmRemoval:true})`
   with reviewed synthetic fixture target IDs and expected `allowed`, `denied` or `signed_out`.
5. Record only its sanitized verdict/status/result. Independently verify fixture membership,
   Crew and responsibility outcomes using the approved read-only QA checks.

The harness calls the **real same-origin product POST endpoint**. Browser-managed cookies
provide the ephemeral session handoff: no token extraction, clipboard token, environment
secret, storage persistence or credential file is needed. The server's staging `getUser()`
still verifies identity. The harness rejects production/foreign origins and supplies no
actor or Authorization override. Disabled/missing schema is a failed case, not a successful
authorization denial. Transport uncertainty is reported without automatic retry. No hosted
account credentials or actual account email addresses are embedded in this harness.

Owner removal, Viewer denial and Editor denial must each be run with the actual corresponding
staging account/session before `REAL_STAGING_SESSION_QA_PENDING` can be cleared. Do not enable
or send invitations, run the harness, or change cloud state solely from these instructions.

## Validation record

Validation uses an isolated HEAD-plus-candidate source copy because the main tsconfig
includes ignored historical output trees. No unrelated files or environment files are
copied into that candidate.

- Invitation/API/domain/privacy/component tests: 118 passed.
- Opt-in API-to-DB and consumed-invitation lifecycle tests: 19 passed, run sequentially
  against the disposable service-role SQL bridge with a 30-second local test budget.
- SQL contracts: 398 assertions passed; all 7 authorization races passed.
- Distributed delivery/rate concurrency: all 3 scenarios passed.
- Harness, final-schema, hosted-type and PostgREST capability tests: 149 passed.
- Exact-byte full local replay: 33 migrations; prior catalog equivalence passed.
- Regenerated public types: normalized and structural equivalence passed, no source diff.
- Isolated standard TypeScript and scoped ESLint: passed.
- Standard production build (`npm run build`, Turbopack): passed in the isolated candidate
  with invitations disabled and synthetic configuration; all 13 static pages generated.
- Scoped whitespace and secret/private-path scan: passed across all 16 candidate files.
- All 28 unrelated files match their saved SHA-256 hashes; no staged files.

The initial parallel DB/build verification encountered timing failures (timeouts and an
existing owner-race assertion receiving an invariant rejection instead of serialization
failure). Sequential reruns passed without changing authorization assertions. The alternate
Webpack build compiled but its generated route check rejected the pre-existing
NewTripContent export; the standard Turbopack build is the repository build contract.
The first standard build lacked the existing prep-feed route's required service-role
configuration; the final build uses only synthetic public and service placeholders, with
invitations disabled.

No commit, push, hosted migration, deployment or email is part of this change.

## Candidate file manifest

Paths relative to the app root (`camping-dashboard/`):

- `src/app/api/invitations/route.ts`
- `src/app/api/invitations/route.test.ts`
- `src/app/api/invitations/removalLocal.test.ts`
- `src/lib/invitations/contracts.ts`
- `src/lib/invitations/service.ts`
- `src/lib/invitations/server.test.ts`
- `src/lib/invitations/localLifecycle.test.ts`
- `supabase/migrations/20260913131931_trip_access_removal_bridge.sql`
- `supabase/tests/trip_access_removal_bridge_test.sql`
- `scripts/staging/access-removal-in-page.js`
- `scripts/staging/access-removal-in-page.test.mjs`
- `scripts/staging/accessRemovalContract.mjs`
- `scripts/staging/accessRemovalContract.test.mjs`
- `scripts/staging/accessRemovalMigration.json`
- `scripts/staging/validate-access-removal.mjs`
- `docs/trip-access-removal-server.md`
