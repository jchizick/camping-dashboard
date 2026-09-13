# Owner-authorized Trip Access management read

Local implementation only. No visible UI, hosted changes, delivery, or authorization redesign.

## Audited schema and existing capabilities

`trip_members`: `id`, `trip_id`, `user_id`, `role`, nullable `created_at`.

`trip_invitations`: `id`, `trip_id`, `invited_email_normalized`, `role`, `invited_by`,
`token_hash`, `status`, `created_at`, `expires_at`, `accepted_at`, `accepted_by`,
`revoked_at`, `delivery_attempt_count`, `delivery_attempt_id`, `delivery_failure_code`,
`delivery_provider`, `delivery_state`, `last_delivery_attempt_at`,
`last_delivery_success_at`, `provider_message_id`.

The existing private `app_private.list_trip_access(text)` already verifies current
ownership with `lock_owned_trip`, joins membership user IDs to `auth.users`, and
returns only membership ID, user ID, email, role and current-user boolean. The new
public bridge projection reuses this resolver and drops user ID. There are no Auth
Admin calls, per-member HTTP lookups, public identity tables or browser Auth grants.
The join is trip-scoped and set-based; this is a complete small-roster snapshot,
not a project-wide user listing or a paginated directory.

The private `list_trip_invitations` is deliberately not reused: it writes expiry
statuses and includes history. The new bridge projection reads active invitations
without lifecycle or delivery writes.

## Contract

`POST /api/invitations` with exactly:

```json
{"operation":"list_access","tripId":"trip-id"}
```

Response is `TripAccessManagement` from `src/lib/invitations/contracts.ts`:

```ts
{
  people: Array<{
    membershipId: string;
    email: string | null;
    role: 'owner' | 'editor' | 'viewer';
    isCurrentUser: boolean;
  }>;
  pendingInvitations: Array<{
    invitationId: string;
    email: string;
    role: 'editor' | 'viewer';
    status: 'pending';
    createdAt: string;
    expiresAt: string;
  }>;
}
```

The route retains same-origin POST validation and private/no-store responses.
Server `auth.getUser()` alone supplies the actor. The service and bridge reject
unexpected fields. Unauthenticated callers receive 401; Viewer, Editor, foreign-trip
Owner and unknown-trip callers receive safe 403; invalid input receives 400;
disabled configuration and missing schema/transport failure return safe 503.

`lock_owned_trip` acquires the same parent lock as membership mutations, then checks
ownership. Both lists are built within that trusted operation. No cached page role
authorizes reads. A concurrent owner demotion that wins the lock causes the read
waiting behind it to fail. Subsequent reads recheck ownership.

The service validates and explicitly projects the bridge result, preventing future
internal fields from being forwarded accidentally. There are no response tokens,
hashes, user IDs, provider metadata, message IDs, attempt IDs, rate keys, idempotency
secrets, session information or Auth metadata.

## Ordering, identity and lifecycle

People: Owner first, Editor second, Viewer third; then lowercased email using C
collation, then membership UUID as a stable tie-breaker. The verified actor controls
`isCurrentUser`, regardless of the service connection's previous claims.

An existing Auth user with no usable email yields `email: null`. The future UI may
label that row “Unknown member”; it retains its membership ID and role. Deleted Auth
users have cascading membership deletion, so stale members are absent rather than
causing a failed roster. No display identity is derived from user-editable metadata.

Pending invitations: `status = 'pending'`, `expires_at > clock_timestamp()`, and the
inviter still has Owner access to this trip, matching usable invitation lifecycle
conditions. Accepted, revoked, expired and former-owner invitations are excluded.
Order is creation time descending, then UUID. No expired status is written by a read.

Delivery state is omitted: the future sheet needs Pending, not a claim of delivery.
Existing `sent` semantics (provider acceptance, not inbox receipt) remain unchanged.
IDs can be passed directly to existing `resend`, `revoke` and `remove_access` operations.
Owner-removal protections stay in the existing mutation primitive.

## Availability and dormancy

`GET /api/invitations` is an authenticated availability read, with no query parameters:

```ts
{ tripAccessAvailable: boolean }
```

The boolean is derived exclusively from `invitationConfig() !== null`. It exposes no
configuration detail. This same-route response fits the existing client-rendered
workspace without changing its providers or cached/offline data model. Future UI
should remain hidden until both availability and its current Owner role permit the
entry point, and stay hidden on failed/offline availability checks. This boolean is
feature availability, not database authorization; every snapshot still verifies
ownership in the database.

Disabled configuration returns false from the authenticated GET and 503 from POST
before any invitation RPC. Production's existing disabled configuration remains safe
against its 28-migration database. No UI is mounted by this task. Availability checks
never inspect invitation tables; enabled-but-missing-schema snapshots fail closed.
Management and availability reads intentionally do not consume persistent network or
actor rate buckets. Existing mutation operations retain their rate policies.

## Migration and local verification

Migration 34: `20260913204351_trip_access_management_read.sql`.
Only `public.trip_invitation_bridge(uuid,text,jsonb)` changes. Signature, security
definer/empty search path, private functions, tables, RLS and effective grants remain
unchanged. Bridge EXECUTE remains postgres/service_role, never PUBLIC/anon/authenticated.

Fresh local history: 34 migrations. Strict fingerprints:

- Previous 33: `58c4311b982fe8716cbc19ea5c687093`.
- Candidate 34: `3c6049625e9eb174cbe148eb44592da0`.
- Exactly one catalog component differs: the public bridge function definition.
- Normalized and structural generated public types remain equivalent; no type file edit.

`node scripts/test-trip-access-management.mjs --reset-disposable` accepts only the
explicitly named disposable Docker database. It rebuilds historical migration bytes
using the existing hash-checked EOL reconstruction helper. Initial raw-checkout replay
showed the known CRLF/LF discrepancy in 41 historical functions; no fingerprint waiver
or source normalization was used. With approved bytes, the exact baseline matches.
The runner preserves catalog, diff and generated-type evidence under ignored
`output/trip-access-management/` and does not alter hosted transition manifests.

Focused Vitest: 138 passed, 5 existing opt-in tests skipped. SQL suite: 429 assertions,
including 31 new management assertions, plus 8 concurrency cases passed. The new
concurrency case proves owner demotion denies a waiting management read. Existing
create/resend/revoke/inspect/accept/removal suites remain passing. TypeScript and
scoped ESLint passed on the candidate. The standard production build passed in an
isolated committed-source copy with only this candidate overlaid, invitations disabled,
a loopback Supabase URL and non-secret key placeholders. The existing prep-feed module
requires a service-key environment value at build time; no real credential was needed.
The initial sandbox build could not download existing Google Fonts; the network-enabled
retry completed. The main checkout's standard TypeScript attempt was stopped because
its broad include traverses old ignored QA source copies; standard `tsc --noEmit` passed
in the isolated candidate without compiler configuration changes. Whitespace and scoped
secret/private-path scans passed. All 28 pre-existing unrelated paths retain their hashes.

Changed source/package files (relative to the application root):

- `src/app/api/invitations/route.ts`
- `src/app/api/invitations/route.test.ts`
- `src/lib/invitations/contracts.ts`
- `src/lib/invitations/service.ts`
- `src/lib/invitations/management.ts`
- `src/lib/invitations/management.test.ts`
- `supabase/migrations/20260913204351_trip_access_management_read.sql`
- `supabase/tests/trip_access_management_test.sql`
- `scripts/test-trip-invitations.mjs`
- `scripts/test-trip-access-management.mjs`
- `docs/trip-access-management-read.md`

## Boundaries and deferred review

Crew and its responsibilities remain independent; no Crew mutation or linking occurs.
No Invite button, sheet, phone entry, navigation, auth, routing or offline change.

`ACCOUNT_SWITCH_SIGNOUT_SCOPE_REVIEW`: the existing default/global Supabase sign-out
remains unchanged. Review invitation-specific local-session sign-out separately;
successful staging recovery does not establish global invalidation as the desired UX.

No staging/production migration or deployment is authorized by this package. Existing
32/33 hosted contracts remain frozen and fail closed on a new source inventory; a
separately reviewed migration-34 rollout would need its own guarded transition.
