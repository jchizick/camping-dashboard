# Trip invitations Phase 2 — local review candidate

## Architecture decision

The existing application uses Next route handlers, cookie-backed
`createRequestSupabaseClient`, and `auth.getUser()` verification. It has a
separate server-only admin client and uses Supabase REST RPCs; it has no direct
Postgres driver, server-action architecture, shared rate limiter, or explicit
CSRF helper. The existing `getSafeNextPath` already accepts local invite paths
without any allowlist expansion. The existing callback is reused unchanged in
its routing; its response now also uses no-referrer.

The Phase 1 functions are in unexposed `app_private`, require `auth.uid()`, and
cannot be reached with a bare service-role REST client. Phase 2 adds exactly one
service-only public bridge, `trip_invitation_bridge(uuid,text,jsonb)`. Execution
is revoked from PUBLIC/anon/authenticated. The server passes only its verified
session subject. The function establishes that subject transaction-locally for
the private calls, restores prior claims, and never exposes the private schema.
No arbitrary SQL/function dispatch is supported. A read-only inspect branch
returns a safe projection using the current `auth.users` verified email. It
does not call acceptance or write expiry state. Existing private acceptance
still performs all authoritative checks under its original locks.

## Runtime and delivery

`POST /api/invitations` accepts create/resend/revoke/inspect/accept and only each
operation's domain fields. Identity injection and extra fields are rejected.
Origin must exactly match the request origin; absent and cross-site origins
are denied. JSON is bounded to 2048 bytes. All responses are private/no-store.
The API never returns raw database errors. There is no GET mutation handler.

The runtime is deliberately **local-only**: `TRIP_INVITATIONS_LOCAL=true`,
non-production NODE_ENV, and no VERCEL environment. Otherwise it returns 503
`delivery_unavailable` before any credential construction or database call.
Do not remove that gate as an incidental deployment step.

The delivery interface is provider-neutral. Its explicit local adapter captures
at most 20 messages in process memory; `takeLocalInvitationMessages()` drains
them for trusted in-process tests. There is no inbox HTTP endpoint, filesystem
token store, or console output. It refuses production/Vercel even if opted in.
Create/rotate commits before delivery. Results distinguish `captured_locally`,
`unavailable`, and terminal `not_sent`; none claims email was sent. Delivery
attempt status is returned, not durably stored. Later management UI/provider
work needs a reviewed persistent delivery-attempt model. A retry always rotates
a new token; no raw token is retained for retry.

## Recipient flow and privacy

GET `/invite/<token>` renders a dynamic shell only. Client inspection submits
the token in a no-store POST body to a token-free API URL. Signed-out requests
receive a generic Google sign-in state without a privileged database lookup.
Thus a syntactically valid but nonexistent token is disclosed as unavailable
only after authentication. No recipient email or trip roster leaks while signed
out. Wrong accounts receive a deterministic first-character email mask and no
trip metadata/destination.

Existing Google OAuth preserves `/invite/<token>` through `/auth/callback` via
the existing safe-next validator. Callback failures still use the existing
landing error/retry flow. Switch account invokes existing cache cleanup and
sign-out, with only a strict `/invite/<43-character-token>` return override.
Default sign-out still returns to `/trips`. An invitation switch does not claim
success or redirect if Supabase sign-out fails.

Only the explicit Accept button sends acceptance. It submits no email, role,
trip ID, or user ID. Success replaces browser history with the verified trip
destination. Existing independent membership keeps its role and offers Open
trip. A consumed invitation whose membership was removed offers no destination
and never recreates access. Revoked/expired states have distinct copy; invalid,
deleted-trip, and no-longer-authorized-inviter cases share a safe unavailable
state because Phase 1 intentionally does not disclose a more specific reason.
Acceptance creates no Crew records.

Invitation HTML has no-referrer/noindex/private-no-store protections. Sensitive
OAuth return requests also receive no-referrer. Next development access logging
ignores invite/callback/next URLs. No application analytics are added; no tokens,
hashes, URLs, or upstream errors are logged by these modules. Hosted platform,
proxy, Auth provider and database parameter/error-log retention need separate
verification/redaction before real token links are released; Next dev logging
configuration is not a claim about hosted infrastructure logs.

No `/invite` paths are added to the service worker, OfflineBootstrap, IndexedDB,
PWA manifest or offline-target matcher. Offline inspection fails unavailable;
no invitation HTML or state is stored for durable offline use.

## Local validation

`src/lib/invitations/localLifecycle.test.ts` is opt-in through
`INVITATION_LOCAL_DB_TEST=true`. Its database target is hardcoded to the
disposable `supabase_db_invitation-phase1-test` Docker container. It exercises
the actual public bridge and private primitives through a service-role SQL
connection, using the real application service/token code and fake delivery.
It uses only synthetic users/trip and cleans their exact IDs in `afterAll`.
It does not constitute a real Google OAuth browser test. An additional disposable
localhost PostgREST smoke verified actual HTTP RPC execution: anon/authenticated
denied, service create/inspect/accept passed. Its synthetic fixtures and temporary
REST container were removed afterward.

Other focused tests exercise the HTTP handler with mocked verified sessions,
the server REST client, rendered recipient flows, OAuth safe-next, cache cleanup,
origin checks, server-only boundaries, response/log privacy, and offline exclusion.
The local Phase 1 SQL/concurrency harness is unchanged.

## Release prerequisites

- Review and apply both database migrations in an explicitly authorized release.
- Configure and validate real transactional delivery, templates, trusted delivery
  origin, and durable attempt status; replace the local-only gate deliberately.
- Add production creation/resend/token-inspection rate limiting. None is claimed
  by this phase; the centralized handler is the insertion point.
- Verify hosted request/referrer/database log redaction and token retention.
- Exercise the full local/staging Auth session + two-account OAuth browser flow
  before enabling runtime in a deployed environment.
- Owner-facing Trip Access UI remains a later phase; no Invite button exists.

No production database operation, invitation, real email, commit, push, or
deployment is part of this implementation task.

## Final validation results

- Focused invitation/auth/proxy suite: 65 passed across 9 files, including all four opt-in real database tests.
- Isolated full Vitest: 895 passed across 112 files; four opt-in DB tests skipped in that invocation and passed separately.
- Existing SQL contracts: 339 passed; concurrency scenarios: 7 passed.
- Additional local PostgREST smoke: PASS; ordinary roles denied, service create/inspect/explicit accept verified.
- Standard isolated TypeScript: PASS. Scoped ESLint: PASS. Isolated production build: PASS.
- Git diff check and per-file whitespace checks (including untracked candidate files): PASS.
- Local Chrome browser: built invitation page renders production-unavailable state; HTTP 200, private/no-store, no-referrer. No browser Google OAuth or live two-account browser acceptance was performed. Recipient state/action coverage used rendered component tests.
- Candidate: exactly 23 files; code byte-matches the isolated build/test candidate. Unrelated working-tree files retain baseline hashes. HEAD and origin/master remain dce1ffb610e4e1dfcab1d0a62f648a9ce2f67dc3; staged count zero.

## Exact file manifest

- [docs/trip-invitations-phase2.md](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/docs/trip-invitations-phase2.md>)
- [next.config.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/next.config.ts>)
- [src/app/api/invitations/route.test.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/app/api/invitations/route.test.ts>)
- [src/app/api/invitations/route.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/app/api/invitations/route.ts>)
- [src/app/auth/callback/route.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/app/auth/callback/route.ts>)
- [src/app/invite/[token]/page.tsx](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/app/invite/[token]/page.tsx>)
- [src/components/invitations/InvitationLanding.test.tsx](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/components/invitations/InvitationLanding.test.tsx>)
- [src/components/invitations/InvitationLanding.tsx](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/components/invitations/InvitationLanding.tsx>)
- [src/components/invitations/invitationLanding.css](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/components/invitations/invitationLanding.css>)
- [src/lib/authContext.test.tsx](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/authContext.test.tsx>)
- [src/lib/authContext.tsx](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/authContext.tsx>)
- [src/lib/authNavigation.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/authNavigation.ts>)
- [src/lib/invitations/contracts.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/contracts.ts>)
- [src/lib/invitations/delivery.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/delivery.ts>)
- [src/lib/invitations/localLifecycle.test.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/localLifecycle.test.ts>)
- [src/lib/invitations/privacy.test.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/privacy.test.ts>)
- [src/lib/invitations/server.test.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/server.test.ts>)
- [src/lib/invitations/server.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/server.ts>)
- [src/lib/invitations/service.test.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/service.test.ts>)
- [src/lib/invitations/service.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/invitations/service.ts>)
- [src/lib/supabaseProxy.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/lib/supabaseProxy.ts>)
- [src/types/supabase.ts](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/src/types/supabase.ts>)
- [supabase/migrations/20260911145134_trip_invitation_server_bridge.sql](<C:/Users/jorda/Desktop/Camping Dashboard/camping-dashboard/supabase/migrations/20260911145134_trip_invitation_server_bridge.sql>)
