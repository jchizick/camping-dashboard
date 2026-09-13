# Migration 33 security and database review

Packaging note: [the authoritative combined package](trip-access-removal-package.md) supersedes the partial file lists and historical packaging status below. The proposed transition described here has since been implemented and locally validated; current operator guidance is in [the transition runbook](staging-access-bridge-transition.md). Security findings and historical evidence remain unchanged.

Reviewed 2026-09-13 against HEAD `98d8f0e19be98566de767abfc7bd0b47d5cac621` plus the 16-file removal candidate documented in `trip-access-removal-server.md`. **Local security/database review PASS: no confirmed vulnerability found within the reviewed boundary.** This review adds regression evidence and this report, not production behavior. **REAL_STAGING_SESSION_QA_PENDING**.

## Exact migration and existing bridge

Migration `supabase/migrations/20260913131931_trip_access_removal_bridge.sql`, version **20260913131931**, SHA-256 **635291e2b6b560c3f499d4aa828c28f531eb9e0b10b1069459f10508032e6590**.

The sole modified object is `public.trip_invitation_bridge(p_actor uuid, p_operation text, p_input jsonb) RETURNS jsonb`. Signature unchanged. No tables, policies, triggers, private function bodies, or private grants change. REVOKE ALL from PUBLIC/anon/authenticated and GRANT EXECUTE to service_role reiterate the existing effective ACL.

Before/after: owner `postgres`, SECURITY DEFINER, `search_path=''`. Fresh replay reports exact ACL `{postgres=X/postgres,service_role=X/postgres}` for both the public bridge and `app_private.remove_trip_access(text,uuid)`. PUBLIC, anon and authenticated have no effective EXECUTE. The existing service_role private removal grant remains; the public bridge is the product RPC path, not the only SQL capability held by trusted service credentials.

Pre-33 operations: create/resend/revoke/inspect/accept delegate to the existing private invitation bridge; delivery_context/delivery_start/delivery_finish use the outer bridge. Migration 33 adds remove_access with the SAME caller-context mechanism. No dynamic SQL, input-derived function name or generic private dispatcher. Unknown operations fail without mutation (existing lookup can return P0002 before the invalid-operation branch); malformed removal JSON raises 22023.

## Identity and transaction isolation

The same-origin route constructs the configured-project cookie-backed Supabase client and calls `auth.getUser()`. Only user.id returned without an Auth error becomes the actor. Decoded tokens, user metadata, body fields and cached owner roles do not authorize removal.

The separate server-only service-role client invokes the fixed RPC with:

- `p_actor`: trusted verified server identity.
- `p_operation='remove_access'`: closed operation.
- `p_input={tripId,membershipId}`: untrusted target identifiers.

The bridge checks the actor exists, then calls `set_config('request.jwt.claim.sub',p_actor::text,true)` and `set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','service_role')::text,true)`. The final true makes both transaction-local. `auth.uid()` supplies that actor to the unchanged private primitive. The primitive locks the parent trip BEFORE checking current owner membership, then locks the target selected jointly by trip_id and id. Owner/self targets are rejected.

On success both saved prior claim settings are restored. Exceptions roll back statement/subtransaction changes; transaction end discards local overrides on reused backends. The new test uses ONE physical psql backend across COMMIT/ROLLBACK, verifies prior service claims and null uid, then makes Viewer B calls both within and after Owner A's transaction. Both deny, preserving the target. A rolled-back successful removal restores both membership and claims. This proves connection reuse cannot inherit the prior actor.

The database trusts service_role to supply the verified actor; protecting that credential and verifying the configured-project session remain server obligations. Local Auth tests stub getUser and substitute only the RPC network transport with a disposable SQL connection. They do not claim proof of a real Google session or real foreign-project JWT rejection.

## Request, authorization and results

Request: `POST /api/invitations`, exactly `{"operation":"remove_access","tripId":"...","membershipId":"UUID"}`. Strict input rejects extra actorUserId, callerUserId, ownerId, ownerUserId, callerRole, isOwner, user_id, role and claims, including an object. Mandatory Origin, cross-site rejection, getUser authentication, bounded JSON, existing rate limits and private/no-store responses remain.

| Case | Result |
| --- | --- |
| Current owner removes own trip's Viewer/Editor | 200, `{"outcome":"access_removed"}` |
| Authorized owner, absent/already removed target | Same minimal 200 |
| Own Trip A with Trip B membership UUID | Same no-op 200; B membership survives |
| Owner of A attempts to manage Trip B | 403 `not_authorized` |
| Viewer, Editor, unrelated caller, owner/self target | 403; no membership mutation |
| No verified session | 401 `not_authenticated` |
| Extra fields or malformed IDs | 400 `invalid_request` |
| Disabled feature | 503 before session/bridge use |
| Missing rate/bridge schema or malformed upstream result | Generic 503; no SQL/schema details |

Idempotency follows owner authorization; tests require 403 for denial, never count a no-op success as denial. The response does not expose the private boolean or membership existence.

Database locking remains authoritative. The added two-connection race demotes A while holding the parent lock, positively observes the bridge request waiting on that lock, then commits demotion. Removal fails with 42501 and preserves the target and remaining owner. Existing final-owner/deletion races also pass.

Production source can remain dormant ahead of schema: disabled configuration returns 503; missing infrastructure fails safely even if mistakenly enabled. Removal sends no email, but shares the invitation configuration gate, including delivery settings. Independent access-management enablement remains deferred.

## Crew and consumed invitations

`crew_members_same_trip_member_fkey`: `(trip_id,trip_member_id)` references `trip_members(trip_id,id)` with **ON DELETE SET NULL (trip_member_id)**. Crew and trip_id survive. Gear/meal assignments reference the Crew record and therefore survive unchanged. Integration tests compare complete gear/meal rows and Crew except the cleared link.

The added local test creates/accepts a synthetic invitation, removes through the actual POST route -> real service -> real RPC/error adapter -> SQL bridge, then calls acceptance POST again. Result: already_accepted with null trip_id; membership is not recreated. No direct membership deletion substitutes for the removal path. No email is delivered.

## Fresh replay, catalog and types

Reset the fixed disposable database from zero with all **33 exact approved migration byte streams**, no seed. Final version **20260913131931**. Evidence: ignored `output/access-removal-validation/generated33.ts`, `catalog33.json`, `result.json`.

- Old final32: `b3e3c93d5de2a53b9e7a4afae89d9ada`.
- New final33: `58c4311b982fe8716cbc19ea5c687093`.
- Exact changed component: function-definition row for `public.trip_invitation_bridge(p_actor uuid, p_operation text, p_input jsonb)`.
- Restoring ONLY the pinned old bridge definition inside a rolled-back transaction reproduces the entire old catalog fingerprint. All remaining objects, private functions and ACLs are unchanged.
- Public signature unchanged; normalized and structural generated-type comparisons PASS. No application type changes.

Historical CRLF pins can differ from LF checkout. EOL reconstruction is accepted only if it reproduces an existing pinned hash exactly. No semantic normalization or fingerprint relaxation.

## Future transition: implement NEXT task

`accessRemovalContract.mjs` specifies exact33 history, pinned source bytes, strict new fingerprint and local/hosted type comparisons. It rejects32 as final33 and exposes verify only. It is not a complete hosted identity gate or migration runner.

Implement a separately reviewed **STAGING_ACCESS_BRIDGE_32_TO_33** next:

1. Require exact staging ref `mgnkvfohpqixgacszovv`; reject production/OA and all wrong targets. Retain TLS verify-full, qualified session-pooler routing, independent fresh Probe A/B and read-only cluster/system identity evidence.
2. Require explicit PRE_ACCESS_BRIDGE_32, exact ordered32 history ending20260912215252, old strict catalog and sentinels. Never infer apply eligibility automatically.
3. Bind to approved source revision/manifest and all historical byte pins, with only migration33 pending and its exact hash above. Extra/missing/reordered/changed migrations abort.
4. Dry-run emits a sanitized bound single-migration plan, with source hash, initial history/catalog, identity and expiry. No credentials, email, writes or generic CLI push.
5. Separately authorized apply rechecks fresh evidence/preconditions, runs only pinned33 and its history record in one transaction, then verifies strict final33. Already-complete invocation refuses mutation. Unknown outcome requires read-only reconciliation, never automatic retry.
6. Require final33 ACL/history/catalog, preserved hosted types, normalized AND structural equivalence, existing PostgREST14.x semantic capability and installed-client contract. Add explicit post33 Probe A/B state support rather than relaxing the frozen32 identity predicate. Both probes must agree on staging cluster/state.
7. Hold release, deployment and real-session QA remain separate authorized gates. Preserve all recovery/OA rules. A verifier PASS alone authorizes none of them.

Test every refusal/recovery case locally before a hosted window. Keep completed31-to32 tooling frozen; do not restore generic plan/apply. No transition implemented or executed in this task.

## Real-session harness

The exact-staging-origin in-page harness uses browser-managed cookies to POST to `/api/invitations`. It does not extract tokens, invoke SQL/RPC directly, or pass actor authority. Pasting is inert; execution requires confirmation and reviewed synthetic target IDs. Account identity and synthetic-target provenance remain operator checks. Missing schema is FAIL, not authorization-denial PASS; uncertain transport is UNVERIFIED with no automatic retry.

**REAL_STAGING_SESSION_QA_PENDING**. No hosted session execution here.

## Actual validation

| Check | Final result |
| --- | --- |
| API/domain/privacy/token/component Vitest | 122 passed; five DB cases skipped in this unit run, exercised separately |
| Opt-in API-to-DB and lifecycle | 20 passed (15 API + 5 lifecycle) |
| SQL pgTAP contracts | 398 assertions passed |
| Same-connection/cross-trip/dispatch scenarios | 11 passed |
| Authorization races | 8 passed (7 existing + 1 new observed-lock bridge demotion) |
| Delivery/rate concurrency | 3 scenarios passed, local only |
| Harness/catalog/type/14.x capability and identity guards | 259 distinct tests passed across appropriate33/32 fixtures |
| Fresh exact-byte replay | 33 migrations PASS; unchanged remainder catalog PASS |
| Generated public types | Normalized + structural PASS |
| Standard TypeScript / scoped ESLint | PASS in isolated HEAD-plus-candidate source |
| Standard production build | PASS; Turbopack, all13 static pages; synthetic config, invitations disabled |

The frozen32 manifest test initially rejected the33 inventory, as intended; its unchanged18-test suite then passed on a separate exact-byte32 fixture. One lifecycle test initially exceeded30 seconds during concurrent compiler checks; all5 passed rerunning alone with no changed assertions/timeouts. No broad full-app Vitest or hosted browser QA claimed. The build emitted the expected multiple-lockfile warning for the nested isolated source; no source workaround applied.

## Files changed by this review

- `src/app/api/invitations/route.test.ts`: requested spoof fields/object claims and cross-site case.
- `src/app/api/invitations/removalLocal.test.ts`: actual POST removal/consumed-invite non-regrant.
- `scripts/staging/test-access-removal-boundary.mjs`: fixed-local connection/cross-trip/dispatch/race tests.
- `docs/trip-access-removal-security-review.md`: this review and future transition plan.

Original16-file package manifest remains in `trip-access-removal-server.md`; adding this script/report makes18. Application implementation and migration bytes remain identical to the pre-review candidate. Ignored local validation/scan artifacts are not product changes.

## Cloud and repository safety

Read-only confirmations: production and Our Adventures ACTIVE_HEALTHY; production28 migrations, latest20260824151000, invitation table/bridge absent. Staging INACTIVE/PAUSED; last-verified32 ending20260912215252 (paused DB was not queried/resumed). Staging Vercel hold `exit 0`; read-only helper confirms production Ready at98d8f0e19be98566de767abfc7bd0b47d5cac621, unchanged build settings and environment metadata.

No hosted migration, deployment, pause/resume, email, invitation, UI exposure, commit or push. All 28 unrelated local files match their saved hashes. All 18 candidate files pass the scoped credential/private-path pattern scan and trailing-whitespace check; `git diff --check` passes. This pattern scan is supplementary evidence, not a guarantee that every possible secret format is recognized.

Final Git: HEAD and origin/master both `98d8f0e19be98566de767abfc7bd0b47d5cac621`; ahead/behind 0/0; staged files 0. The earlier validation counts in `trip-access-removal-server.md` describe the implementation task; this review's counts supersede them for the current candidate.

## Security export limitation

Native scan `66ed3306-6aa5-48f9-b6ca-7663feb54e9f` completed with zero findings for the original immutable snapshot. Its final export retained the initial pending-validation checkpoint when merging the final draft, so native coverage is marked partial even though the local checks above completed. That stale receipt is not a new vulnerability or an unrun test. The sealed export is preserved without alteration. It also warns about the authorized test/document additions after snapshot capture; original implementation/migration bytes were separately verified unchanged. Usage telemetry is partial and flagged `token_record_invalid`, so it is not a reliable task token total. The completed local evidence in this report and remaining real-session limitation should be used when assessing readiness; do not describe the native export itself as complete coverage.
