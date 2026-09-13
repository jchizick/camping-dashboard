# Trip access removal: authoritative combined package

Review date: 2026-09-13. Baseline: `98d8f0e19be98566de767abfc7bd0b47d5cac621`.

**DEPENDENCY-COMPLETE PACKAGE — READY FOR REVIEW. SINGLE SELF-CONTAINED COMMIT recommended.**

This is the only authoritative manifest for the combined product path, migration 33, security regression evidence and guarded staging transition. The partial lists and historical validation totals in [the server report](trip-access-removal-server.md), [the security review](trip-access-removal-security-review.md) and [the transition runbook](staging-access-bridge-transition.md) are superseded for packaging by this document. Their technical findings and historical records are retained.

This task ends with nothing staged, no commit and no push. It authorizes no hosted operation. **REAL_STAGING_SESSION_QA_PENDING**.

## Authoritative changed-file manifest: 26 files

All paths are relative to `camping-dashboard/`. Only this table defines the proposed commit delta. Baseline dependencies listed later already exist at the baseline SHA and are not additional changes.

| Path | Category | Reason / direct consumer |
| --- | --- | --- |
| `src/app/api/invitations/route.ts` | Runtime route | Adds the closed remove_access operation to the existing authenticated, same-origin dispatcher. |
| `src/lib/invitations/service.ts` | Runtime service | Strict target-only input and minimal removal result; consumed by the POST route. |
| `src/lib/invitations/contracts.ts` | Runtime domain | AccessRemovalResult contract consumed by the removal service. |
| `src/app/api/invitations/route.test.ts` | API tests | Verified identity, Origin, spoof rejection, disabled/missing infrastructure and non-disclosing responses. |
| `src/app/api/invitations/removalLocal.test.ts` | API/DB lifecycle tests | Actual POST-to-SQL path; role denials, Crew preservation and consumed-invite non-regrant. |
| `src/lib/invitations/server.test.ts` | Server tests | Fixed service-role RPC and safe missing-schema/error mapping. |
| `src/lib/invitations/localLifecycle.test.ts` | DB lifecycle tests | Existing invitation lifecycle now removes through the real service/bridge and checks non-regrant. |
| `supabase/migrations/20260913131931_trip_access_removal_bridge.sql` | Migration 33 | Sole reviewed public bridge replacement; pinned by the transition and source inventory. |
| `supabase/tests/trip_access_removal_bridge_test.sql` | Authorization SQL tests | pgTAP removal/ACL/claims contract; discovered by scripts/test-trip-invitations.mjs. |
| `scripts/staging/test-access-removal-boundary.mjs` | Authorization/concurrency tests | One physical connection across COMMIT/ROLLBACK; demotion race and target preservation. |
| `scripts/staging/access-removal-in-page.js` | Real-session QA harness | Exact staging origin, browser cookies and real POST endpoint; inert until explicitly invoked. |
| `scripts/staging/access-removal-in-page.test.mjs` | Harness tests | Real endpoint contract, protected origins, confirmation and safe failure classification. |
| `scripts/staging/accessRemovalContract.mjs` | Final-33 verification | Exact inventory, strict final history/catalog and local/hosted type comparison; consumed by validators/transition. |
| `scripts/staging/accessRemovalContract.test.mjs` | Verification tests | Exact-33 acceptance, 32 rejection, byte/type drift and verification-only actions. |
| `scripts/staging/accessRemovalMigration.json` | Deterministic manifest resource | Migration 33 identity/hash and approved base-history binding; consumed by accessRemovalContract. |
| `scripts/staging/validate-access-removal.mjs` | Local verification | Fresh zero-to-33 exact-byte replay, prior-catalog comparison and generated types. |
| `scripts/staging/access-bridge-32-to-33.mjs` | Guarded CLI | Explicit mode/action entry point and bounded non-secret failures. |
| `scripts/staging/accessBridgeContract.mjs` | Guarded transition | Fresh identity/schema state machine, pinned definitions and one atomic migration transaction. |
| `scripts/staging/accessBridgeSource.mjs` | Source integrity | Requires approved HEAD and committed dependency closure, including exact migration bytes. |
| `scripts/staging/accessBridgeTransport.mjs` | Staging transport | Fixed target, fresh Management/provenance/A/B evidence, pinned CA/TLS and private apply adapter. |
| `scripts/staging/accessBridgeContract.test.mjs` | Transition tests | Positive/negative state transitions using freshly generated local fixture evidence. |
| `scripts/staging/validate-access-bridge.mjs` | Local transition verification | Fresh 32 replay, zero-write dry-run, one apply, strict 33/types and repeat refusal. |
| `docs/trip-access-removal-server.md` | Architecture/runbook | Product flow, v1 limitations and real-session harness instructions; historical manifest superseded. |
| `docs/trip-access-removal-security-review.md` | Security review | Trust-boundary and SQL regression findings; historical manifest superseded. |
| `docs/staging-access-bridge-transition.md` | Transition runbook | Exact contracts, operator inputs, recovery rules and future separately authorized window. |
| `docs/trip-access-removal-package.md` | Package manifest/release gate | This authoritative combined manifest and clean-checkout results. |

One coherent unit is preferable: the product operation needs the reviewed bridge body, the transition authorizes only those pinned bytes, and the tests/harness document and verify that same trust boundary. Splitting would distribute its evidence without creating a useful independent architectural boundary. The route can remain dormant ahead of hosted schema; packaging together does not authorize enabling it.

## Trust boundary and dormant deployment

`POST /api/invitations` accepts `{operation:"remove_access",tripId,membershipId}`. It enforces exact Origin and rejects cross-site requests, then requires the existing feature/config gate. A cookie-backed, configured-project `auth.getUser()` result is the only actor identity. Extra actorUserId, callerUserId, ownerId, role, isOwner, claims and related authority fields are rejected by the strict schema. The server-only lazy client invokes the fixed service-role bridge; no application membership DELETE or Crew cleanup is added.

Database authorization remains final. The bridge validates the actor, establishes transaction-local sub/claims with `set_config(..., true)`, and calls the unchanged private primitive. The primitive locks the trip before checking current owner membership, checks the trip-qualified target and preserves owner/final-owner restrictions. Successful calls restore prior claims; exception/transaction rollback and transaction end clear overrides. Tests cover both COMMIT and ROLLBACK on the same physical backend, including a subsequent Viewer call.

Owner removal succeeds. Viewer, Editor, unrelated caller, cross-trip management, owner/self targets and non-owner self-removal are denied. A foreign-trip target UUID supplied with an owned trip produces a non-disclosing no-op, preserving that membership. Authorized absent/already-removed targets return the same minimal `{outcome:"access_removed"}`. Crew survives, its optional membership link clears, gear/meals remain unchanged, and consumed invitations cannot recreate removed access through POST acceptance.

Disabled configuration returns 503 before session/bridge use. Missing rate/bridge schema and malformed upstream results fail with bounded generic errors. This is covered locally without production schema or credentials. No visible Trip Access UI is added. Access removal still shares invitation infrastructure configuration; independent enablement is deferred.

The in-page harness calls only the real same-origin POST endpoint with browser-managed cookies. It neither invokes SQL/RPC nor extracts or persists tokens; it cannot supply authoritative caller fields. Real Owner/Viewer/Editor staging sessions still require separate hosted QA. Local Auth/network fixture substitution is not real-session proof.

## Migration and transition contracts

- Migration: `20260913131931_trip_access_removal_bridge.sql`.
- SHA-256: `635291e2b6b560c3f499d4aa828c28f531eb9e0b10b1069459f10508032e6590`.
- Only changed object: `public.trip_invitation_bridge(uuid,text,jsonb) RETURNS jsonb` definition/body.
- Owner postgres, SECURITY DEFINER, empty search_path and postgres/service_role execution contract unchanged; no broader grants.
- No table, policy, trigger or private-function change. `app_private.remove_trip_access(text,uuid)` body and authorization remain pinned.
- Existing `.gitattributes` forces this migration to LF, preserving its reviewed committed byte hash. Historical migration EOL reconstruction must reproduce preapproved hashes exactly.

| State | Ordered history | Final version | Strict catalog |
| --- | --- | --- | --- |
| Explicit pre-transition input | Exact 32 | 20260912215252 | b3e3c93d5de2a53b9e7a4afae89d9ada |
| Final staging verification | Exact 33 | 20260913131931 | 58c4311b982fe8716cbc19ea5c687093 |

```text
node scripts/staging/access-bridge-32-to-33.mjs STAGING_ACCESS_BRIDGE_32_TO_33 --dry-run
node scripts/staging/access-bridge-32-to-33.mjs STAGING_ACCESS_BRIDGE_32_TO_33 --apply
node scripts/staging/access-bridge-32-to-33.mjs STAGING_ACCESS_BRIDGE_32_TO_33 --verify
```

These are operational commands for a later approved window, not commands executed against hosting in this gate. Generic plan/apply remain disabled. The strict final verifier rejects 32; frozen 32 tooling remains only the explicit starting contract and rejects the new inventory as its own final package.

Dry-run requires the staging ref, approved committed source, exact history/catalog/pre-definition, fresh current-session Management/credential/pooler provenance, pinned staging CA, verify-full TLS, independent password, Probe A/B agreement and independent cluster identity. Only migration 33 may be pending. Apply repeats those checks in-process, runs one locked atomic transaction, verifies exact final history/definition/catalog/private invariants and stops. Already-complete state performs zero mutation. Uncertain apply outcomes are never retried automatically. Local generated types are normalized and structurally equivalent; hosted generation/capability remains a downstream gate, with deploymentAuthorized:false.

The audited PostgREST 14.x capability profile and installed Supabase JS 2.98.0, PostgREST JS 2.98.0 and SSR 0.9.0 contract are unchanged.

## Clean-checkout method and results

A detached local clone of the baseline received only the 25 implementation/review files in the table, followed by this final documentation file and supersession notices. No output, environment file, certificate, credential, browser session or unrelated working file was copied. The candidate modules and migration matched the main working copy byte-for-byte. Dependency tracing covered static JS/TS imports, aliases, URL resources, SQL and manifest resources, full migration/test directories, config, types, harness code and documentation references. The 26-file delta plus 119 retained baseline dependencies forms the 145-path audited closure below; the complete committed app was available for normal build resolution.

The initial dependency junction was sufficient for tests, but Turbopack correctly refused its out-of-root destination in this non-nested clone. It was replaced with a normal `npm ci` installation from the unchanged lockfile. The final standard build, standard TypeScript, focused application tests and installed-client capability tests passed using that independent installation. No application configuration workaround was made.

| Gate | Actual result |
| --- | --- |
| Fresh zero-to-33 replay, no seed | PASS; exact history/final catalog; restoring only the old bridge in a rolled-back transaction reproduces final-32 catalog |
| Fresh guarded 32-to-33 simulation | PASS; zero-write dry-run, exactly migration 33 pending, one apply, strict final state and repeat refusal |
| Transition regressions | 65 passed |
| Product/API/domain/privacy/token/component tests | 122 passed; 5 opt-in DB tests skipped here and run separately |
| Aggregate real local API/DB lifecycle suite | 20 passed, 0 skipped; 43.41 seconds total |
| Product checks after guarded transition | All 15 API/DB removal tests passed again, including Crew/non-regrant |
| SQL contracts | 398 assertions passed |
| Authorization races | 8 distinct scenarios passed: 7 existing plus observed-lock bridge demotion |
| Caller-context boundary | 11 scenarios passed; also rerun after guarded transition |
| Delivery/rate concurrency | 3 scenarios passed; synthetic delivery only, no email |
| Harness/catalog/type/PostgREST/SQL identity suites | 285 passed, including 45 capability tests |
| Frozen 32-source guard fixture | 18 passed on fresh exact-byte 32 resource fixture |
| Credential discovery | 93 passed; synthetic credentials, no live requests |
| Fresh installed-client capability recheck | All 45 passed again after npm ci; not additional distinct tests |
| Generated public types | Normalized and structural equivalence PASS for fresh 33 and the guarded transition |
| Standard TypeScript | tsc --noEmit --incremental false PASS |
| Scoped ESLint | PASS for 19 package JS/TS files |
| Syntax | 12 package JS modules and 2 retained PowerShell resources PASS |
| Standard production build | PASS; 13 static pages; invitations disabled, synthetic configuration |
| Source/resource closure, secret/private-path patterns, whitespace/diff | PASS; no missing durable dependency |

**Timeout classification: NOT REPRODUCED IN CLEAN AGGREGATE.** The previously affected `rotates, rejects unauthorized owners and old URLs, revokes and handles expiry/deletion` case passed in 13,086 ms under its unchanged 30,000 ms timeout while both DB suites ran in one normal sequential-worker invocation. No assertion, timeout or test implementation was modified. Historical contention is plausible, not proven; this gate does not claim the test can never be slow.

**Lockfile warning classification: VALIDATION LAYOUT ONLY.** The final non-nested checkout with its own installed dependencies emitted no multiple-lockfile/root warning and built successfully with the unchanged next.config.ts. The earlier junction panic was validation-environment setup, resolved by standard dependency installation. No warning was suppressed.

`npm ci` reported 20 advisories in the unchanged dependency graph (1 low, 6 moderate, 9 high, 4 critical). No dependency/security upgrade was attempted. These are not a new package delta, and this focused authorization/package review is not a repository-wide dependency-security clearance.

## Reproduction

In a clean baseline checkout, overlay only the authoritative file table and run `npm ci`. Use the documented fixed disposable local database; do not substitute a hosted URL. Run DB-mutating test tools sequentially.

```text
node scripts/staging/validate-access-removal.mjs --reset-disposable
node node_modules/vitest/vitest.mjs run src/app/api/invitations/route.test.ts src/lib/invitations src/lib/tripInvitationToken.test.ts src/components/invitations/InvitationLanding.test.tsx --maxWorkers=2
# Set INVITATION_LOCAL_DB_TEST=true only for this local DB suite:
node node_modules/vitest/vitest.mjs run src/app/api/invitations/removalLocal.test.ts src/lib/invitations/localLifecycle.test.ts --maxWorkers=1 --reporter=verbose
node scripts/test-trip-invitations.mjs
node scripts/staging/test-access-removal-boundary.mjs
node scripts/test-invitation-delivery.mjs
node scripts/staging/validate-access-bridge.mjs --reset-disposable
# Recheck the removal API suite and caller boundary after this reset/transition.
node --test scripts/staging/access-removal-in-page.test.mjs scripts/staging/accessRemovalContract.test.mjs scripts/staging/hostedTypeGate.test.mjs scripts/staging/postgrestCapabilities.test.mjs scripts/staging/postMigrationContract.test.mjs scripts/staging/sqlIdentity.test.mjs scripts/staging/sqlProbe.test.mjs scripts/staging/typeComparison.test.mjs scripts/staging/catalogComparison.test.mjs
pwsh -NoProfile -File scripts/staging/credentialDiscovery.test.ps1
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

Unset the opt-in DB flag for unit-only invocations. The frozen guard.test.mjs inventory case deliberately expects 32: construct a fresh temporary root with scripts/staging/{guard.mjs,guard.test.mjs,migrations.json} and the first 32 exact-byte entries returned by accessRemovalInventory(), then run node --test on that copied guard.test.mjs. No saved fixture is needed. The transition's 65 tests generate their fixture in validate-access-bridge.mjs rather than reading earlier output.

Build configuration used TRIP_INVITATIONS_ENABLED=false, NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 and synthetic public/service placeholders. No real key was provided. The existing prep-feed build contract requires the service placeholder; invitation clients remain lazy/dormant. Syntax checks use node --check and the PowerShell parser; scoped ESLint targets only JS/TS paths in the manifest.

## Hosted safety and release boundary

Read-only checks confirmed production and Our Adventures ACTIVE_HEALTHY, staging INACTIVE/PAUSED, and staging Vercel project prj_cT84I91FOGoGKAhFJjUu56BPPmFk held at `exit 0`. Production still has 28 migrations, latest 20260824151000, with invitation table/bridge absent; its Ready deployment/build/environment settings remain unchanged. No production membership mutation was performed. Hosted staging remains at its last-verified 32 state; its paused database was not resumed or queried. Migration 33 was applied only to the disposable local database.

No hosted migration, project pause/resume, deployment, email, live invitation, UI exposure, staging, commit or push occurred. HEAD and origin/master remain the baseline, ahead/behind 0/0 and staged 0. All 28 unrelated files listed below retain their pre-task hashes. The 22 non-document candidate files retain their approved bytes; this packaging task adds only this manifest and supersession notices to the three included documents.

**Recommendation: PACKAGE THE REAL PRODUCT PATH AND GUARDED 32→33 TRANSITION TOGETHER.** A later reviewed commit must contain exactly this manifest's delta. A later hosted window must still perform fresh identity, Our Adventures recovery/preflight, type/capability, deployment-isolation and real-session QA gates. This document does not authorize any such window.

## Baseline dependency closure — retained, not additional commit files

The following paths already exist in the approved baseline. They were resolved recursively or selected as build/test/resource roots; tests and the normal build establish executable resolution. External imports are Node built-ins or dependencies resolved from package.json/package-lock.json. The installed-client capability gate checks the pinned Supabase client graph explicitly.

Historical descriptions in the retained review reports and fixture README are not additional commands in this gate. Their references (including the baseline functionGrantDrift.mjs fixture and frozen validate-local.mjs runner) exist in the baseline checkout. The old runner is not a final-33 entry point. Historical output paths describe previous evidence, not files required by the current tests or build.

| Retained baseline path | Category | Direct consumer / reason |
| --- | --- | --- |
| `.gitattributes` | Build/test configuration | Build, replay or regression command |
| `.gitignore` | Build/test configuration | Build, replay or regression command |
| `eslint.config.mjs` | Build/test configuration | Build, replay or regression command |
| `next.config.ts` | Build/test configuration | `src/lib/invitations/privacy.test.ts` |
| `package-lock.json` | Build/test configuration | `scripts/staging/postgrestCapabilities.mjs` |
| `package.json` | Build/test configuration | Build, replay or regression command |
| `postcss.config.mjs` | Build/test configuration | Build, replay or regression command |
| `scripts/staging/catalogComparison.mjs` | Verification/test support | `scripts/staging/accessBridgeContract.mjs` |
| `scripts/staging/catalogComparison.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/catalogEvidence.mjs` | Verification/test support | `scripts/staging/catalogComparison.test.mjs` |
| `scripts/staging/catalogReplay.mjs` | Verification/test support | `scripts/staging/validate-access-removal.mjs` |
| `scripts/staging/credentialDiscovery.psm1` | Verification/test support | Build, replay or regression command |
| `scripts/staging/credentialDiscovery.test.ps1` | Verification/test support | Build, replay or regression command |
| `scripts/staging/fixtures/README.md` | Verification/test support | Build, replay or regression command |
| `scripts/staging/fixtures/repair.mjs` | Verification/test support | `scripts/staging/accessBridgeContract.test.mjs` |
| `scripts/staging/guard.mjs` | Verification/test support | `scripts/staging/accessBridgeTransport.mjs` |
| `scripts/staging/guard.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/hostedTypeGate.mjs` | Verification/test support | `scripts/staging/accessRemovalContract.mjs` |
| `scripts/staging/hostedTypeGate.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/migrate.mjs` | Verification/test support | `scripts/staging/postMigrationContract.test.mjs` |
| `scripts/staging/migrations.json` | Verification/test support | `scripts/staging/postMigrationContract.mjs` |
| `scripts/staging/paths.mjs` | Verification/test support | `scripts/staging/postgrestCapabilities.mjs` |
| `scripts/staging/postMigrationContract.mjs` | Verification/test support | `scripts/staging/accessRemovalContract.mjs` |
| `scripts/staging/postMigrationContract.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/postgrestCapabilities.mjs` | Verification/test support | `scripts/staging/hostedTypeGate.mjs` |
| `scripts/staging/postgrestCapabilities.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/repairCli.mjs` | Verification/test support | `scripts/staging/repairContract.mjs` |
| `scripts/staging/repairContract.mjs` | Verification/test support | `scripts/staging/accessBridgeContract.mjs` |
| `scripts/staging/repairFunctions.sql` | Verification/test support | `scripts/staging/repairTransport.mjs` |
| `scripts/staging/repairTransport.mjs` | Verification/test support | `scripts/staging/accessBridgeTransport.mjs` |
| `scripts/staging/schemaFingerprint.sql` | Verification/test support | `scripts/staging/postMigrationContract.mjs` |
| `scripts/staging/sqlIdentity.mjs` | Verification/test support | `scripts/staging/accessBridgeContract.mjs` |
| `scripts/staging/sqlIdentity.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/sqlProbe.mjs` | Verification/test support | `scripts/staging/accessBridgeTransport.mjs` |
| `scripts/staging/sqlProbe.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/typeComparison.mjs` | Verification/test support | `scripts/staging/accessRemovalContract.mjs` |
| `scripts/staging/typeComparison.test.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/staging/verify.sql` | Verification/test support | `scripts/staging/migrate.mjs` |
| `scripts/test-invitation-delivery.mjs` | Verification/test support | Build, replay or regression command |
| `scripts/test-trip-invitations.mjs` | Verification/test support | Build, replay or regression command |
| `src/components/invitations/InvitationLanding.test.tsx` | Runtime/test dependency | Build, replay or regression command |
| `src/components/invitations/InvitationLanding.tsx` | Runtime/test dependency | `src/components/invitations/InvitationLanding.test.tsx` |
| `src/components/invitations/invitationLanding.css` | Runtime/test dependency | `src/components/invitations/InvitationLanding.tsx` |
| `src/lib/activeTripCache.ts` | Runtime/test dependency | `src/lib/tripRepository.ts` |
| `src/lib/activeTripSnapshot.ts` | Runtime/test dependency | `src/lib/tripRepository.ts` |
| `src/lib/authContext.tsx` | Runtime/test dependency | `src/components/invitations/InvitationLanding.tsx` |
| `src/lib/authNavigation.ts` | Runtime/test dependency | `src/lib/authContext.tsx` |
| `src/lib/authRedirect.ts` | Runtime/test dependency | `src/lib/invitations/service.test.ts` |
| `src/lib/dashboardMapper.ts` | Runtime/test dependency | `src/lib/activeTripSnapshot.ts` |
| `src/lib/env.ts` | Runtime/test dependency | `src/lib/serverSupabase.ts` |
| `src/lib/fetchDashboard.ts` | Runtime/test dependency | `src/lib/tripRepository.ts` |
| `src/lib/invitations/config.ts` | Runtime/test dependency | `src/app/api/invitations/route.ts` |
| `src/lib/invitations/delivery.ts` | Runtime/test dependency | `src/app/api/invitations/route.ts` |
| `src/lib/invitations/deliveryInfrastructure.test.ts` | Runtime/test dependency | Build, replay or regression command |
| `src/lib/invitations/privacy.test.ts` | Runtime/test dependency | Build, replay or regression command |
| `src/lib/invitations/rateLimit.ts` | Runtime/test dependency | `src/app/api/invitations/route.ts` |
| `src/lib/invitations/resend.ts` | Runtime/test dependency | `src/app/api/invitations/route.ts` |
| `src/lib/invitations/server.ts` | Runtime/test dependency | `src/app/api/invitations/route.ts` |
| `src/lib/invitations/service.test.ts` | Runtime/test dependency | Build, replay or regression command |
| `src/lib/invitations/session.test.ts` | Runtime/test dependency | Build, replay or regression command |
| `src/lib/invitations/session.ts` | Runtime/test dependency | `src/lib/invitations/session.test.ts` |
| `src/lib/invitations/template.ts` | Runtime/test dependency | `src/lib/invitations/resend.ts` |
| `src/lib/offlineTarget.ts` | Runtime/test dependency | `src/lib/invitations/service.test.ts` |
| `src/lib/remoteWorkspaceError.ts` | Runtime/test dependency | `src/lib/fetchDashboard.ts` |
| `src/lib/serverSupabase.ts` | Runtime/test dependency | `src/app/api/invitations/route.ts` |
| `src/lib/supabase.ts` | Runtime/test dependency | `src/lib/authContext.tsx` |
| `src/lib/tripInvitationToken.test.ts` | Runtime/test dependency | Build, replay or regression command |
| `src/lib/tripInvitationToken.ts` | Runtime/test dependency | `src/lib/invitations/service.ts` |
| `src/lib/tripRepository.ts` | Runtime/test dependency | `src/lib/authContext.tsx` |
| `src/lib/workspaceSources.ts` | Runtime/test dependency | `src/lib/activeTripSnapshot.ts` |
| `src/types/database.ts` | Runtime/test dependency | `src/lib/serverSupabase.ts` |
| `src/types/index.ts` | Runtime/test dependency | `src/lib/tripRepository.ts` |
| `src/types/supabase.ts` | Runtime/test dependency | `src/types/database.ts` |
| `supabase/config.toml` | Build/test configuration | Build, replay or regression command |
| `supabase/migrations/20260307012657_create_all_tables.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260307151438_phase3_rls_crud_policies.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260311025508_add_uuid_defaults_to_user_authored_tables.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260321023149_replace_moonrise_with_visibility.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260322143229_add_offline_status_update_policy.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260324033317_add_phase_to_timeline_events.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260326211824_enforce_rls_and_admin_policies.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260513000741_add_daily_vehicle_permit_saved.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260606144130_add_prep_feed_items.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260709165709_create_trip_members.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260709165726_seed_alpha_trip_members.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260709165856_replace_rls_policies.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260709165924_add_storage_policies.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260709165932_add_theme_variant_to_settings.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260710135251_006_fix_trip_members_rls_recursion.sql` | Migration baseline | `scripts/staging/sqlIdentity.test.mjs` |
| `supabase/migrations/20260726010611_expand_trip_creation_and_campsites.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726013323_refactor_create_trip_remove_legacy_singleton_id.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726013846_contract_singleton_trip_ids.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726143539_safe_trip_and_prep_feed_deletion.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726143737_index_prep_feed_cleanup_jobs_trip_id.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726174306_harden_rls_helpers_and_cleanup_queue.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726174312_index_remaining_foreign_keys.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726181155_narrow_cleanup_queue_service_role_privileges.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726204948_process_prep_feed_storage_cleanup_jobs.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260726221207_migrate_weather_refresh_to_supabase_cron.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260727030556_migrate_trip_alerts_to_supabase_cron.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260808210000_make_expedition_primary_theme.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260824151000_add_crew_identity_responsibilities.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260911135747_trip_invitation_authorization_foundation.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260911145134_trip_invitation_server_bridge.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260911164431_trip_invitation_delivery_and_limits.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/migrations/20260912215252_normalize_public_function_execute_privileges.sql` | Migration baseline | `scripts/staging/migrations.json` |
| `supabase/tests/alert_refresh_scheduler_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/crew_responsibility_backfill_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/crew_responsibility_contract_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/prep_feed_cleanup_worker_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/schema_baseline_contract_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/security_advisory_remediation_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/trip_creation_contract_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/trip_invitation_contract_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/trip_invitation_delivery_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/trip_prep_feed_deletion_test.sql` | SQL test resource | Build, replay or regression command |
| `supabase/tests/weather_refresh_scheduler_test.sql` | SQL test resource | Build, replay or regression command |
| `tsconfig.json` | Build/test configuration | Build, replay or regression command |
| `vitest.config.ts` | Build/test configuration | Build, replay or regression command |

## Exclusions — preserve exactly

Output/checkpoint trees, generated hosted evidence, local wrappers, .env files, certificates, DPAPI/PAT files, browser-session material and the temporary validation checkout are not package inputs or commit files. Test-generated output is disposable evidence, never an input prerequisite. The separate GET-only hosted safety observation is not part of the reproducible test gate.

These 28 existing working-tree paths are unrelated to the combined package and remain unchanged:

- `src/app/globals.css`
- `src/app/mobileTypographyApplication.test.ts`
- `src/components/home/MobileHomeOverview.test.tsx`
- `src/components/home/ReadinessGauge.tsx`
- `design-qa.md`
- `docs/our-adventures-image-preflight.md`
- `docs/privilege-normalization-package-audit.md`
- `docs/staging-catalog-diagnosis.md`
- `docs/staging-function-grant-diagnosis.md`
- `docs/staging-preparation.md`
- `docs/staging-privilege-normalization.md`
- `docs/staging-type-diagnosis.md`
- `public/C7BD79FC.jpg`
- `public/SCHABO-Condensed.woff2`
- `public/green_trees_topographic_bg.png`
- `public/sunset-camp-fire.png`
- `scripts/offline-reliability-browser.cjs`
- `scripts/staging/discover-credentials.ps1`
- `scripts/staging/memories-in-page-probe.js`
- `scripts/staging/memories-in-page-probe.test.mjs`
- `scripts/staging/memoriesImagePreflight.mjs`
- `scripts/staging/memoriesImagePreflight.test.mjs`
- `scripts/staging/our-adventures-baseline.sql`
- `scripts/staging/run-vercel-prep.ps1`
- `scripts/staging/sqlLocalPreflight.mjs`
- `scripts/staging/vercelPrep.mjs`
- `scripts/staging/vercelPrep.test.mjs`
- `scripts/staging/vercelPrepRunner.mjs`
