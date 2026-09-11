# Invitations Phase 3A: delivery and abuse controls

Source-only implementation. No owner UI, deployment, hosted migration, email, or activation is part of this phase.

## Audit and provider

Phase 2 persisted/rotated the SHA-256 token digest, then called `InvitationDelivery.deliver`.
Its bounded local fake sink required explicit local opt-in and rejected production/Vercel.
Success meant only local capture; failure was transient response state, with no database delivery fields.
The service-role-only public bridge verified the server-supplied actor and delegated lifecycle operations to private functions.
There was no transactional provider or distributed rate service in this repository.

Resend is the chosen adapter, using the HTTP API without an SDK/dependency. Domain code only knows
the delivery interface and safe receipt/failure categories. Fake capture remains independently testable.

## Explicit environment contract

Local fake: `NODE_ENV` is not production, `VERCEL` is unset, `TRIP_INVITATIONS_LOCAL=true`,
and `TRIP_INVITATIONS_ORIGIN` is a valid origin (local HTTP restricted to localhost/127.0.0.1).
The distributed database limiter still runs locally; only opt-in synthetic test fixtures reset counters.

Hosted real delivery requires all of:

- `VERCEL=1`, `VERCEL_ENV=preview` or `production`
- `TRIP_INVITATIONS_ENABLED=true`
- `TRIP_INVITATIONS_PROVIDER=resend`
- `TRIP_INVITATIONS_ORIGIN`: HTTPS origin only; no credentials, path, query or fragment
- `TRIP_INVITATIONS_FROM_ADDRESS`: verified sender address
- `TRIP_INVITATIONS_SENDER_NAME`: optional, defaults to Field Protocol; no header controls
- `TRIP_INVITATIONS_REPLY_TO`: optional valid address
- `RESEND_API_KEY`: server-only, domain-scoped sending key recommended
- `TRIP_INVITATIONS_RATE_SECRET`: independent random secret, at least 32 characters
- existing `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`

No hosted fallback to fake. Missing configuration or inaccessible rate storage returns 503 before
delivery. Syntactic validation cannot establish domain verification or credential validity; those
must be verified in staging. No values have been configured by this source change.

## Delivery facts and sequencing

Migration: `supabase/migrations/20260911164431_trip_invitation_delivery_and_limits.sql`.

Invitation lifecycle remains pending/accepted/revoked/expired. Delivery separately records:
not_attempted → sending → sent/failed/unknown. `sent` means provider API acceptance, NOT inbox delivery.
Local `captured_locally` stores sent with provider=local, never claiming provider acceptance.
Attempt UUID, cumulative attempt count, last-attempt/last-success timestamps, provider name/message UUID
and an allowlisted failure category are durable. Last-success remains historical after a failed resend.

Create/rotate and fresh attempt UUID are one transaction. The service claims that attempt atomically
before sending; duplicate claims cannot send. Then it finalizes by matching attempt UUID AND digest.
Old completions cannot overwrite a newer resend. Failure leaves the invitation pending and grants no
membership. Resend always invalidates the old token before sending the new one; no secret is recovered.

Definite rejection/auth/rate failure is failed. A timeout/network/5xx ambiguity is unknown, because an
email may have been accepted. If recording a receipt fails, the API reports unknown rather than Sent.
A crash may leave sending; treat that as unresolved, never as delivery success. There is no durable
raw-payload queue or automatic retry worker. An explicit owner resend rotates again, subject to limits.
The `sending` state is not a resend lock: after the existing 60-second trip/recipient cooldown,
an authorized owner can resend a still-pending, unexpired invitation even if the prior attempt never
finished. Hourly budgets still apply. This replaces the attempt UUID and token atomically, so a late
completion from the interrupted attempt cannot overwrite recovery. There is no automatic stale-state
transition; an abandoned attempt remains unresolved until an explicit resend or lifecycle action.
A concurrent revoke/resend cannot recall an already in-flight email, but its stale link cannot grant access.

Resend idempotency uses `invitation/<attempt UUID>` for a maximum of two HTTP attempts, with the same
payload and five-second timeout each. Every legitimate resend gets a new UUID. Keys contain no token,
email, or trip ID. Resend's provider retention window is 24 hours; no cross-day automatic retries occur.

## Rate policy

PostgreSQL private table + service-role-only `consume_invitation_rate_limits` RPC; no process-local
production counters. Sorted advisory transaction locks serialize absent/existing buckets; all counters
are committed before attempting the domain operation, including denied operations.

| Scope | Budget |
| --- | --- |
| Network, all invitation API requests | 60/minute |
| Verified actor, create + resend combined | 20/hour |
| Trip, create + resend combined | 30/hour |
| Normalized recipient across trips | 10/hour |
| Trip + recipient | 5/hour |
| Trip + recipient, create/resend cooldown | 1/minute |
| Verified actor, inspect | 30/minute |
| Verified actor, accept | 10/minute |
| Verified actor, revoke | 20/minute |

Fixed windows begin on first use; denied calls do not extend expiry. Responses use generic 429 and
Retry-After seconds. Owner authorization precedes recipient lookup and recipient-budget consumption.
No arbitrary-email membership lookup is exposed. Actor budgets are applied even to invalid operation
inputs. Network budget runs before body/auth lookup, including signed-out inspect/accept attempts.

Keys are HMAC-SHA256 of typed identity tuples. Normalization comes from the existing database email
normalizer. Vercel's edge-overwritten forwarded IP is trusted only on Vercel; IPv6 addresses share /64.
Missing/unusable IPs share a restrictive fallback bucket. Account/network sharing can cause conservative
throttling; adjust limits from staging evidence, not by removing the guard. A deployment behind an extra
proxy must validate its trusted-forwarding configuration before launch.

Expired buckets are reset atomically; each request removes at most 100 buckets expired over a day ago,
after acquiring/updating its budget rows, skipping locked rows. No scheduler/dependency is needed.
Very high distributed abuse still needs the platform firewall: application rate limits are not DDoS protection.

## Templates and privacy

HTML and plain text contain Field Protocol identity, bounded trip name, Viewer/Editor, UTC expiry,
one `/invite#TOKEN` acceptance URL, invited Google-email guidance and ignore guidance. Generic inviter
context is used because no trusted display-name contract exists. HTML metacharacters are escaped;
plain text retains literal text but strips control characters. Trip names are capped at 200 characters.

The email body necessarily contains the bearer link and the provider processes it. Application code
does not log bodies, tokens, URLs, provider keys or raw errors. The adapter discards provider error bodies.
Stored failure codes are constrained in SQL; only a validated non-secret provider message UUID is retained.
Disable click/open tracking for the invitation sender before staging/launch so a tracking redirect does
not introduce another bearer-link transport. Restrict provider dashboard access and review retention/log
drains; this source review cannot prove a provider's internal logging policy. Fragment transport, 32-byte
random entropy, SHA-256 storage and seven-day lifetime are unchanged.

## Validation / activation boundary

Tests use mocked Resend HTTP, the independent local fake, and only the fixed disposable Docker DB
`supabase_db_invitation-phase1-test`. No real provider sandbox account or credential was configured,
and no email was sent. Provider sandbox/domain QA therefore remains outstanding.

Before activation: separately approve hosted migrations, configure an isolated staging DB/provider/sender
and rate secret, verify sender domain and tracking settings, configure application origin and Google/Supabase
callback allowlists, then run two-account Google OAuth acceptance QA. Configure production only after that
review. There is no Invite UI in this phase.

Webhooks for delivered/bounced/complained are later enhancements, not required for this API-accepted
v1 contract. Do not label API acceptance as inbox delivery. Before adding such labels or automated
retries/suppression, add authenticated webhook signature/timestamp validation and event-ID replay protection.

References: [Resend API](https://resend.com/docs/api-reference/emails/send-email),
[idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Vercel request headers](https://vercel.com/docs/headers/request-headers).

## Recorded local gate (2026-09-11)

- Focused invitation/provider/template/rate/auth suite: 81 passed, 4 opt-in DB tests skipped.
- Full Vitest in isolated committed-source-plus-candidate copy: 950 passed across 114 files,
  with the 4 opt-in DB tests skipped in one additional file.
- Those 4 DB lifecycle tests: passed separately (18.95 seconds), using the actual bridge and limiter.
- Fresh replay: all 31 repository migrations applied from zero to the disposable DB.
- SQL contracts: 370 passed, including 31 new delivery/rate assertions.
- Concurrency: 7 existing races plus 3 new checks passed (5/12 rate requests allowed,
  1/6 delivery claims acquired, exactly one concurrent completion persisted).
- Generated public schema types: 25 added lines, limited to delivery columns and limiter RPC.
- Local security advisors: no issues found.
- Standard `tsc --noEmit`, scoped ESLint, isolated production build and diff/whitespace checks: passed.
- Root TypeScript sees unrelated historical QA source under ignored `output/`; the unmodified standard
  configuration passes in the isolated candidate. No configuration cleanup was performed.
- An initial disposable fixture lacked the committed bridge migration; syncing the complete repository
  migration set resolved replay. DB tests initially exceeded their old five-second timeout; opt-in tests
  now allow 30 seconds. A run concurrent with full validation still timed out; the standalone run passed.
- Nineteen baseline file hashes, including all ten unrelated dirty/untracked files, remained identical.
- No real provider request/email, production DB mutation, commit, push or deployment.
