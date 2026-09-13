# Trip Access management package — authoritative manifest

**PACKAGE — CLEAN-CHECKOUT PASS; SINGLE SELF-CONTAINED COMMIT RECOMMENDED.**

This is the only authoritative manifest for the combined management-read capability,
migration 34, security coverage and guarded 33-to-34 transition. It supersedes the
partial file lists in the implementation, review and transition documents.
No staging or commit was performed. A separate commit instruction is required.

Baseline: `a1bc8bf0aa4ea3d238f58ce00388a76a22329d6e`.
Recommended future subject: `feat: add owner-authorized trip access management`.
These parts form one rollout unit; splitting would separate the server capability
from its reviewed SQL and the only approved staging transition. Deployment must
remain dormant until its separately authorized database rollout.

## Exact 26-file commit manifest

Paths are relative to the application directory `camping-dashboard/` in Git.
Only these paths belong to the proposed commit; unchanged baseline dependencies
listed later are not additional changes to stage.

| Path | Category | Reason / consumer |
|---|---|---|
| `src/app/api/invitations/route.ts` | API/service/contracts/domain | Authenticated boolean GET and strict token-free list_access dispatch |
| `src/lib/invitations/contracts.ts` | API/service/contracts/domain | Minimal shared management DTO |
| `src/lib/invitations/service.ts` | API/service/contracts/domain | Verified actor, tripId-only input, fixed bridge call |
| `src/lib/invitations/management.ts` | API/service/contracts/domain | Validates and projects approved response fields |
| `supabase/migrations/20260913204351_trip_access_management_read.sql` | Migration 34 | Immutable reviewed bridge-body extension |
| `src/app/api/invitations/route.test.ts` | API/server/domain tests | Endpoint authentication, availability, management dispatch and denial |
| `src/app/api/invitations/managementSecurity.test.ts` | API/server/domain tests | Real disabled configuration and identity/privacy regressions |
| `src/lib/invitations/management.test.ts` | API/server/domain tests | DTO validation and defensive field projection |
| `supabase/tests/trip_access_management_test.sql` | SQL/security/concurrency fixtures | Owner/role boundaries, ordering, minimal response, identifier compatibility |
| `supabase/tests/trip_access_management_security_test.sql` | SQL/security/concurrency fixtures | Identity privacy, expiry, original-creator semantics and observational reads |
| `scripts/test-trip-invitations.mjs` | SQL/security/concurrency fixtures | Runs SQL fixtures and retained owner-demotion management race |
| `scripts/test-trip-access-management.mjs` | Deterministic durable local resources | Fresh exact33/34 replay, catalog delta and generated types |
| `scripts/staging/access-management-33-to-34.mjs` | Guarded transition/final verifier | Explicit CLI and sanitized failure output |
| `scripts/staging/accessManagementContract.mjs` | Guarded transition/final verifier | Exact pre/final states, fresh identity, one apply and transaction gates |
| `scripts/staging/accessManagementInventory.mjs` | Deterministic durable local resources | Exact repository inventory and reviewed migration34 physical-byte pin |
| `scripts/staging/accessManagementSource.mjs` | Guarded transition/final verifier | Requires approved committed source and recursive dependency equality |
| `scripts/staging/accessManagementTransport.mjs` | Guarded transition/final verifier | Staging-only provenance, TLS, A/B capture, private SQL apply and hosted type gate |
| `scripts/staging/accessManagementContract.test.mjs` | API/server/domain tests | 71 state-machine, refusal, source and one-shot assertions |
| `scripts/staging/validate-access-management.mjs` | Deterministic durable local resources | Fresh disposable33-to34 simulation and current-run synthetic fixture |
| `scripts/staging/migrate.mjs` | Guarded transition/final verifier | Ordinary verify now requires final34; generic plan/apply refuse |
| `scripts/staging/guard.test.mjs` | API/server/domain tests | Builds a deterministic historical32 fixture without assuming current source ends at32 |
| `docs/trip-access-management-read.md` | Architecture/security/transition/package docs | Implementation architecture and DTO evidence |
| `docs/trip-access-management-security-review.md` | Architecture/security/transition/package docs | Reviewed security boundary, immutable SQL identity and limitations |
| `docs/staging-access-management-transition.md` | Architecture/security/transition/package docs | Current operational contract and abort/refusal behavior |
| `docs/staging-access-bridge-transition.md` | Architecture/security/transition/package docs | Marks old final33 documentation historical/superseded |
| `docs/trip-access-management-package.md` | Architecture/security/transition/package docs | This authoritative combined manifest and clean gate |

The 25 implementation/review/transition files were overlaid byte-for-byte and were
unchanged by packaging. This manifest is the sole newly authored package file.

## Contract audit

Authenticated `GET /api/invitations` returns only `{tripAccessAvailable:boolean}`,
derived from existing configuration, with private/no-store caching. It performs no
invitation-table query or provider/schema diagnostic disclosure. Disabled returns
false; disabled POST returns unavailable before a schema-dependent bridge call.
No visible UI or automatic migration execution is introduced. No separate
28-migration runtime was needed: disabled-path tests prove no database call occurs.

Authenticated POST accepts `{operation:'list_access',tripId}` only. Server
`auth.getUser()` supplies the caller ID; no request role, actor or claims object
can authorize it. The service calls the fixed service-role bridge, which installs
transaction-local caller context and checks current DB ownership under the same
parent lock as the read. There is no application-owner-check followed by a separate
service-role roster query. Viewer, Editor, cross-trip Owner and unauthenticated
callers receive no roster/recipient data. The waiting-owner-demotion race passes.

The existing private resolver joins membership to Auth email in one trip-scoped
query. Null/blank email becomes null; deleted Auth identities cascade membership
removal. No Auth Admin N+1, duplicated email table or browser auth.users grant.

People contain only membershipId, email/null, role and isCurrentUser, ordered by
Owner/Editor/Viewer, lowercased email with deterministic null handling, then ID.
Pending invitations contain only invitationId, email, role, literal pending status,
createdAt and expiresAt, newest first with ID tie-breaker. Returned IDs feed existing
remove_access/resend/revoke directly. No tokens/hashes, Auth user IDs/metadata,
provider/attempt IDs, credentials, idempotency/rate keys or session data are returned.
Actual response assertions and defensive projection/secret tests pass.

`ORIGINAL_CREATOR_MUST_REMAIN_OWNER`: same trip, pending status, expires_at greater
than DB clock_timestamp(), original creator currently Owner. Consumed/revoked/expired
and former-owner rows are excluded. Hiding does not revoke the stored invitation;
the recipient uniqueness reservation can remain. Ownership-management UI must handle
this later. No semantic changes were made while packaging.

Repeated reads leave memberships, invitations, delivery state/attempts and rate
buckets unchanged. Create/resend/revoke/inspect/accept/remove_access regressions pass.
Existing REAL INVITATION PIPELINE — FULL QA PASS is historical hosted evidence,
not a claim that migration34 has been exercised remotely.

## Immutable migration and final contract

Version: `20260913204351`, migration 34.
SHA-256: `e54a591b31157766771fdef6cf7b4de3eff539434ae6156a690d16041a91aaf3`.
Only `public.trip_invitation_bridge(uuid,text,jsonb) RETURNS jsonb` body changes.
Signature, postgres ownership, SECURITY DEFINER, empty search_path and grants remain
unchanged. Tables/RLS/triggers/private functions are unchanged.

Exact33 pre-catalog: `58c4311b982fe8716cbc19ea5c687093`.
Exact34 final-catalog: `3c6049625e9eb174cbe148eb44592da0`.
Fresh strict comparison reports only the public bridge definition delta; normalized
and structural generated public types pass without a type-source edit.

`STAGING_ACCESS_MANAGEMENT_33_TO_34` supports --dry-run/--apply/--verify. It rejects
protected/wrong projects, wrong/partial history, altered migration or pre-definition,
unexpected grants/catalog, multiple pending migrations, stale identity, missing B,
uncommitted dependencies and unknown mutation outcomes. It requires fresh staging
provenance, verify-full TLS, agreeing A/B and independent cluster evidence.
Dry-run writes no DB state; apply repeats fresh gates and executes one pinned SQL
transaction; exact34 returns already-complete without another apply. Ordinary
`migrate.mjs verify` requires final34; 33 only passes the explicit pre-transition gate.
No generic mutation or deployment authorization is enabled.

## Clean-checkout gate

PASS on a fresh Git archive of the exact baseline with only the 25 proposed source
files overlaid. No environment file, hosted evidence, output tree, credential,
certificate, browser state or ignored compiler copy was copied. Installed dependencies
were reused through a node_modules junction; package/lock files came from baseline.
All scoped source files still match the tested copy byte-for-byte.

| Gate | Actual result |
|---|---|
| Focused management/API/server/security Vitest | 144 passed; initial 20 opt-in skips resolved in separate run |
| All local opt-in API/lifecycle tests | 20 passed, zero skipped; 164 unique Vitest tests total |
| SQL/security assertions | 456 passed, including 31 management and 27 review assertions |
| Concurrency | 8 passed, including management demotion race |
| Transition tests | 71 passed, zero skipped |
| Identity/credential/TLS/catalog/type/CLI guards | 272 passed |
| Fresh replay from zero | Exact34, final20260913204351 |
| Guarded local33-to34 | One apply; repeated call and duplicate transaction refused |
| Catalog | Both fingerprints match; bridge definition only |
| Public types | Normalized + structural PASS |
| Standard TypeScript | PASS, unchanged config |
| Scoped ESLint | 18 TS/MJS files PASS |
| JavaScript syntax | PASS |
| Production build | PASS, invitations disabled, loopback/non-secret placeholders |
| Scoped secrets/private paths and whitespace | PASS |

The normal build fetched existing Google fonts and emitted the nested-copy root/
lockfile warning; no config change or deployment occurred. The broader checkout's
TypeScript include globs reach ignored output files (9,615 observed during this gate).
The clean candidate passes normally: **local ignored-artifact pollution**, not a
clean-repository build failure. Gitignore does not control TypeScript includes.
No tsconfig/build workaround was introduced.

Historical EOL handling is deterministic and hash checked. Fresh archive EOL output
can differ from Git blob line endings; the existing helper reconstructs only pinned
historical bytes into owned temporary replay directories. All 33 historical source
files remain byte-identical to their fresh archive after tests. No local historical
file mutation enters the package, and neither expected fingerprint was relaxed.
Migration34 physical bytes remain exact without reconstruction.

## Dependency closure and exclusions

Recursive static TS/JS imports, source guard closure, SQL manifests/tests, generated
fixture consumers and validation commands resolved in the clean copy. The technical
audit enumerated 128 paths: 25 candidate files and 103 unchanged baseline resources.
The linked historical package document also exists in baseline; this manifest adds
one package document, making 130 paths in the combined enumerated closure below.
External modules are the existing locked npm dependencies or Node/Next built-ins.
All operational documentation links resolve; no extra untracked dependency is needed.

Runtime requires secure operator credentials and a staging CA only during a separately
authorized hosted window. These are excluded operational inputs, not committed fixtures.
Tests use synthetic control-plane evidence generated from the current local replay.
Output/checkpoint paths in evidence documents describe generated results, not inputs.
No test requires pre-existing output, a hosted checkpoint or browser session.

Excluded operational artifacts: all output trees, archived/temporary QA copies, raw
hosted evidence, PATs/keys/passwords, environment files, CA files and browser state.
Excluded unrelated work: the 28 preserved local modified/untracked files, including
mobile/CSS work, older staging preparation helpers/docs and visual assets. Their
hashes remain unchanged. They are not dependencies of this package.

`ACCOUNT_SWITCH_SIGNOUT_SCOPE_REVIEW` remains deferred. No auth or Crew change.
No hosted system was contacted. Production remains untouched; staging is last-verified
PAUSED at33 with its exit-0 hold; Our Adventures is last-verified ACTIVE_HEALTHY.
No hosted migration, deployment, email, UI, staging, commit or push.

## Unchanged baseline dependency inventory

The following 104 paths already belong to baseline and must not be added as unrelated
working-tree changes. Together with the 26-file manifest they complete the audited
local dependency/resource inventory.

```text
docs/trip-access-removal-package.md
eslint.config.mjs
next.config.ts
package-lock.json
package.json
scripts/staging/accessBridgeContract.mjs
scripts/staging/accessRemovalContract.mjs
scripts/staging/accessRemovalMigration.json
scripts/staging/catalogComparison.mjs
scripts/staging/catalogComparison.test.mjs
scripts/staging/catalogEvidence.mjs
scripts/staging/catalogReplay.mjs
scripts/staging/fixtures/repair.mjs
scripts/staging/guard.mjs
scripts/staging/hostedTypeGate.mjs
scripts/staging/hostedTypeGate.test.mjs
scripts/staging/localReplayEvidence.mjs
scripts/staging/migrations.json
scripts/staging/paths.mjs
scripts/staging/postMigrationContract.mjs
scripts/staging/postgrestCapabilities.mjs
scripts/staging/postgrestCapabilities.test.mjs
scripts/staging/repairCli.mjs
scripts/staging/repairCli.test.mjs
scripts/staging/repairContract.mjs
scripts/staging/repairFunctions.sql
scripts/staging/repairTransport.mjs
scripts/staging/schemaFingerprint.sql
scripts/staging/sqlIdentity.mjs
scripts/staging/sqlIdentity.test.mjs
scripts/staging/sqlProbe.mjs
scripts/staging/sqlProbe.test.mjs
scripts/staging/typeComparison.mjs
scripts/staging/verify.sql
src/app/api/invitations/removalLocal.test.ts
src/lib/authRedirect.ts
src/lib/env.ts
src/lib/invitations/config.ts
src/lib/invitations/delivery.ts
src/lib/invitations/deliveryInfrastructure.test.ts
src/lib/invitations/localLifecycle.test.ts
src/lib/invitations/privacy.test.ts
src/lib/invitations/rateLimit.ts
src/lib/invitations/resend.ts
src/lib/invitations/server.test.ts
src/lib/invitations/server.ts
src/lib/invitations/service.test.ts
src/lib/invitations/session.test.ts
src/lib/invitations/session.ts
src/lib/invitations/template.ts
src/lib/offlineTarget.ts
src/lib/serverSupabase.ts
src/lib/tripInvitationToken.test.ts
src/lib/tripInvitationToken.ts
src/types/database.ts
src/types/supabase.ts
supabase/config.toml
supabase/migrations/20260307012657_create_all_tables.sql
supabase/migrations/20260307151438_phase3_rls_crud_policies.sql
supabase/migrations/20260311025508_add_uuid_defaults_to_user_authored_tables.sql
supabase/migrations/20260321023149_replace_moonrise_with_visibility.sql
supabase/migrations/20260322143229_add_offline_status_update_policy.sql
supabase/migrations/20260324033317_add_phase_to_timeline_events.sql
supabase/migrations/20260326211824_enforce_rls_and_admin_policies.sql
supabase/migrations/20260513000741_add_daily_vehicle_permit_saved.sql
supabase/migrations/20260606144130_add_prep_feed_items.sql
supabase/migrations/20260709165709_create_trip_members.sql
supabase/migrations/20260709165726_seed_alpha_trip_members.sql
supabase/migrations/20260709165856_replace_rls_policies.sql
supabase/migrations/20260709165924_add_storage_policies.sql
supabase/migrations/20260709165932_add_theme_variant_to_settings.sql
supabase/migrations/20260710135251_006_fix_trip_members_rls_recursion.sql
supabase/migrations/20260726010611_expand_trip_creation_and_campsites.sql
supabase/migrations/20260726013323_refactor_create_trip_remove_legacy_singleton_id.sql
supabase/migrations/20260726013846_contract_singleton_trip_ids.sql
supabase/migrations/20260726143539_safe_trip_and_prep_feed_deletion.sql
supabase/migrations/20260726143737_index_prep_feed_cleanup_jobs_trip_id.sql
supabase/migrations/20260726174306_harden_rls_helpers_and_cleanup_queue.sql
supabase/migrations/20260726174312_index_remaining_foreign_keys.sql
supabase/migrations/20260726181155_narrow_cleanup_queue_service_role_privileges.sql
supabase/migrations/20260726204948_process_prep_feed_storage_cleanup_jobs.sql
supabase/migrations/20260726221207_migrate_weather_refresh_to_supabase_cron.sql
supabase/migrations/20260727030556_migrate_trip_alerts_to_supabase_cron.sql
supabase/migrations/20260808210000_make_expedition_primary_theme.sql
supabase/migrations/20260824151000_add_crew_identity_responsibilities.sql
supabase/migrations/20260911135747_trip_invitation_authorization_foundation.sql
supabase/migrations/20260911145134_trip_invitation_server_bridge.sql
supabase/migrations/20260911164431_trip_invitation_delivery_and_limits.sql
supabase/migrations/20260912215252_normalize_public_function_execute_privileges.sql
supabase/migrations/20260913131931_trip_access_removal_bridge.sql
supabase/tests/alert_refresh_scheduler_test.sql
supabase/tests/crew_responsibility_backfill_test.sql
supabase/tests/crew_responsibility_contract_test.sql
supabase/tests/prep_feed_cleanup_worker_test.sql
supabase/tests/schema_baseline_contract_test.sql
supabase/tests/security_advisory_remediation_test.sql
supabase/tests/trip_access_removal_bridge_test.sql
supabase/tests/trip_creation_contract_test.sql
supabase/tests/trip_invitation_contract_test.sql
supabase/tests/trip_invitation_delivery_test.sql
supabase/tests/trip_prep_feed_deletion_test.sql
supabase/tests/weather_refresh_scheduler_test.sql
tsconfig.json
vitest.config.ts
```
