# Trip invitations: Phase 1 authorization foundation

Review candidate only. No production migration, public invitation RPC, UI,
acceptance route, email provider, email delivery, or offline integration.

## Existing contracts reviewed

`trip_members` uses UUID membership/user IDs, text trip IDs, owner/editor/viewer
roles, and unique `(trip_id,user_id)` and `(trip_id,id)` constraints. RLS reads
remain governed by `app_private.is_trip_member`. Edit/owner helpers reject trips
with a deletion token. `create_trip` inserts the initial owner atomically.

No application code writes memberships directly. Three existing SQL tests did
use authenticated INSERT for fixture provisioning; those inserts now run as the
test administrator, then restore the authenticated role for their assertions.

Crew is unchanged. Acceptance never creates Crew. Removing access retains Crew,
nulls `crew_members.trip_member_id`, and preserves Gear/Meal responsibility links.

## Schema and ownership

Migration: `20260911135747_trip_invitation_authorization_foundation.sql`.

`trip_invitations` stores UUID ID, trip ID, normalized email, viewer/editor role
(viewer default), inviter, SHA-256 hex digest, status, creation/expiry timestamps,
acceptance identity/time, and revocation time. Trip deletion cascades invitations.
Deleted auth users null invitation attribution; deleted inviters cannot authorize
acceptance. No raw-token column or provider-specific delivery fields exist.

Email normalization is SQL `lower(btrim(email))`; no alias rewriting. Validation
rejects missing addresses, whitespace, malformed basic address syntax, and more
than 254 characters. It is deliberately not an email deliverability checker.

Unique token hashes and a partial unique `(trip_id,invited_email_normalized)`
index for pending rows prevent duplicate outstanding invitations. The index has
no clock expression. Creation expires stale pending rows in the same transaction
before replacement. Lifecycle/timestamp CHECKs and an immutable-identity/terminal
transition trigger guard the table.

Deferred constraint triggers require every surviving trip to have an owner at
transaction end. This includes deletion-pending trips. Trip creation can insert
the trip and first owner in one transaction; actual trip deletion is exempt.
The migration stops if pre-existing ownerless trips require review; it never
guesses ownership or repairs data silently.

Membership writes touch/lock their parent trip, including privileged writes and
auth-user cascades. The parent write prevents concurrent owner-removal write
skew under REPEATABLE READ. Membership identity is immutable. TRUNCATE is blocked
separately because it bypasses row triggers. Auth-account deletion that would
orphan a trip fails; transfer or trip deletion must precede account deletion.

Direct authenticated membership INSERT/UPDATE/DELETE grants and owner mutation
policies are removed; existing SELECT and create_trip remain. Trusted database
administration may still manage multiple owners subject to the invariant. The
product removal primitive cannot remove owners or implement Leave trip.

The two existing deletion RPCs preserve signatures, results and grants, but
recheck ownership after acquiring the parent lock rather than inside the locking
query. This closes a stale-authorization window during concurrent demotion.

## Private operation contracts

All seven operations below are in **unexposed `app_private`**, SECURITY DEFINER,
with empty search paths and EXECUTE granted only to `service_role`. They require
`auth.uid()` and perform their own authorization. No client table access to
invitations is granted, including direct service-role access; only projections
are returned. Internal helper/trigger functions are not granted to service clients.

| Function | Result / behavior |
| --- | --- |
| `create_trip_invitation(trip_id,email,token_hash,role='viewer')` | UUID; current owner, valid active trip, no self/existing member/pending duplicate; seven days |
| `rotate_trip_invitation(trip_id,invitation_id,token_hash)` | `rotated` or terminal status; only unexpired pending; new digest required; seven days from rotation; original inviter must still own trip |
| `revoke_trip_invitation(trip_id,invitation_id)` | `revoked` or existing terminal status; repeat safe; expired pending becomes expired |
| `accept_trip_invitation(token_hash)` | One `{outcome,trip_id}` row; no digest in output |
| `remove_trip_access(trip_id,member_id)` | Boolean; owner removes non-owner; missing/cross-trip membership cannot be removed |
| `list_trip_invitations(trip_id)` | Owner-only ID/email/role/status/created/expiry projection; expires stale pending rows; no token/digest |
| `list_trip_access(trip_id)` | Owner-only membership ID/user ID/email/role/current-user projection; no global account search |

Other new private functions: `lock_owned_trip`, `lock_membership_trip`,
`assert_trip_owner`, `reject_membership_truncate`, `normalize_invitation_email`,
and `guard_invitation_transition`.

Existing public functions replaced: `begin_trip_deletion`,
`complete_trip_deletion`. No new public functions are exposed.

### Trusted-server boundary for Phase 2

These are intentionally private database contracts, not browser-callable RPCs.
They are not directly reachable through the configured PostgREST schemas.
The later server/API phase must verify the Supabase session and establish the
authenticated subject in the **same transaction** as the private function call,
or add a narrowly reviewed service-only bridge. A bare service API key has no
user subject and is not sufficient. Never accept an actor ID, email or role from
the request as proof of identity. Never expose `app_private` in API configuration.

`src/lib/tripInvitationToken.ts` is server-only and uses Node crypto:
32 random bytes, canonical base64url encoding, SHA-256 of the exact URL token.
Only its digest crosses the database boundary. The transient `{rawToken,tokenHash}`
payload is for later trusted delivery code; it must not be logged or persisted.
Acceptance hashes the supplied token with the same helper before calling SQL.

This phase deliberately adds no delivery state or interface pretending email was
sent. A later delivery phase needs provider-neutral attempt status, rate limits,
origin checks, verified-session transport, and log/referrer redaction.

## Acceptance and locking

Lookup by hash confers no authority. Lock trip first, re-read/lock invitation,
then read current `auth.users.email` and `email_confirmed_at` under a share lock.
Reject missing/unverified/mismatched email, including stale JWT/user metadata
claims. Check expiry using `clock_timestamp()` after lock acquisition, trip
deletion state, current inviter ownership, and the fixed viewer/editor role.
Insert membership and mark accepted atomically. Never update an existing role.

Outcomes: `accepted`, `already_accepted`, `already_member`, `identity_mismatch`,
`expired`, `revoked`, `unavailable`. Wrong identity gets no trip ID. A consumed
invitation for its original accepting account returns already_accepted, but
returns no destination if membership was removed and never recreates membership.
Email changes must still match the invited address; do not treat the token alone
as authorization. Terminal invitations cannot be resurrected; reissue separately.

Owner management shares the trip-first lock order. Privileged direct writes may
still encounter deadlock/serialization errors in conflicting multi-row or
auth-deletion transactions; they must retry the whole transaction. Such aborts
do not grant partial access or defeat the owner invariant.

## Local verification

Disposable project: `output/invitations-phase1`, project ID
`invitation-phase1-test`, container `supabase_db_invitation-phase1-test`.
Only copied migrations and the repository's empty seed are used. No linked
project credentials or production data are used by the test runner.

`node scripts/test-trip-invitations.mjs` runs all repository pgTAP contracts,
then real two-connection races. Its container name is fixed deliberately.
Transactional SQL fixtures roll back. Concurrent fixtures must commit for the
other connection and are removed in `finally` using their exact synthetic IDs.

Validated: 339 SQL assertions (97 invitation-specific), seven race scenarios,
863 Vitest tests across 107 files (including nine token tests), scoped ESLint,
and isolated-source standard TypeScript. SQL lint checks public/app_private.

The root `tsc --noEmit` includes pre-existing ignored `output/` fixture trees and
fails on stale fixture types/Deno imports. The isolated check uses the unchanged
tsconfig, current src/config files, required Supabase shared sources, generated
Next route declarations and installed dependencies, without those artifacts.
No unrelated files were changed to suppress those errors.

No production build or browser QA: the helper is unreferenced by application
routes, and this phase changes no rendered or bundled application integration.
