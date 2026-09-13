# Guarded staging access bridge: 32 to 33

**Historical contract:** current final staging verification requires 34. State 33
is now only the pre-state for the explicit management-read transition. See
[staging-access-management-transition.md](staging-access-management-transition.md).

Packaging note: the seven-file task list below is historical. [The authoritative combined package](trip-access-removal-package.md) defines the full product-path, security-regression and transition manifest and final clean-checkout gate.

Local tooling candidate; **no hosted execution authorized by this document**. The product removal/migration review is in `trip-access-removal-security-review.md`. Existing server code, migration bytes and the completed 31-to-32 repair are unchanged.

## Explicit commands

From the app root, during a separately approved hosted window:

```text
node scripts/staging/access-bridge-32-to-33.mjs STAGING_ACCESS_BRIDGE_32_TO_33 --dry-run
node scripts/staging/access-bridge-32-to-33.mjs STAGING_ACCESS_BRIDGE_32_TO_33 --apply
node scripts/staging/access-bridge-32-to-33.mjs STAGING_ACCESS_BRIDGE_32_TO_33 --verify
```

No default mode, plan/apply alias, arbitrary migration selection or generic pending migration execution. The legacy ordinary migration command remains verification-only and its frozen32 inventory rejects this33 package. `--verify` above is the current final-staging handoff: it requires strict33 and cannot pass32. The old final32 verifier is retained solely as the explicit pre-transition contract; it is not relabeled final33.

## State contracts

Target ONLY `mgnkvfohpqixgacszovv` / field-protocol-staging. Production `gdsmyxzqtmhwbcyobzou` and Our Adventures `rmfhueseulevyvetblnn` are protected. Production28 also fails independently through exact starting history.

| Contract | Before | After |
| --- | --- | --- |
| State | POST_MIGRATION_32_PRE_ACCESS_BRIDGE | POST_ACCESS_REMOVAL_STAGING_33 |
| Ordered history | Exact existing32 sequence | Same32 plus20260913131931 |
| Final version | 20260912215252 | 20260913131931 |
| Strict catalog | b3e3c93d5de2a53b9e7a4afae89d9ada | 58c4311b982fe8716cbc19ea5c687093 |

Count/latest alone never authorize. Missing/reordered/unknown history, altered pre-definition, partial sentinels or catalog drift fail. The repaired three-function ACL contract remains mandatory. New final verification compares complete catalog content plus the strict fingerprint, effective function privileges/owners, and all unchanged function metadata.

Migration: `20260913131931_trip_access_removal_bridge.sql`.
Reviewed byte SHA-256: `635291e2b6b560c3f499d4aa828c28f531eb9e0b10b1069459f10508032e6590`.
Only changed object: `public.trip_invitation_bridge(uuid,text,jsonb) RETURNS jsonb`, signature unchanged. Owner postgres, SECURITY DEFINER, empty search_path and postgres/service_role EXECUTE remain unchanged. No table/policy/trigger/private primitive change.

Definition SHA-256 pins:

- Pre bridge: `35cce243c137e92500f48a113350786a12f49fc3241d128841f390c469afe560`.
- Final bridge: `cce6bb5918b36a87d4c9ec4a8567ebb3370f35c95a144366be69df23d2e5201c`.
- Unchanged private removal: `3c1057ec851fa1367eeee25053038877c5085d3511706aa62fe0515f078b1de1`.

Full normalized catalog manifests are additionally pinned, with only ordering normalized, not SQL bodies. Existing historical EOL reconstruction still requires the exact reviewed hash; migration33 itself and its committed Git blob must match the exact byte pin.

## Identity, freshness and source

Hosted transport requires current environment inputs: STAGING_REF, STAGING_APPROVED_SOURCE_SHA, STAGING_DATABASE_URL, STAGING_DATABASE_PASSWORD, STAGING_SSL_ROOT_CERT, STAGING_EVIDENCE_DIR, SUPABASE_ACCESS_TOKEN and SUPABASE_READ_SETUP_TOKEN; optional STAGING_PSQL_PATH. Values are never written to reports. No source-directory override, saved SQL gate, prior catalog artifact or encrypted file is accepted as mutation authorization.

The explicitly approved40-character SHA must equal HEAD. The CLI's transitive local dependency closure, all33 migrations, package lock and public types must match that commit. Thus this uncommitted candidate cannot run hosted. Historical text checkout EOL differences are permitted only for non33 committed text comparison; all migration byte pins remain independently mandatory. Approval of a SHA is an operator/release responsibility, not inferred from deployment state.

Each capture freshly reads Management project identity/ACTIVE_HEALTHY, primary pooler provenance, API credential provenance and independent cluster system ID. Both psql Probe A and Probe B must agree on a read-only repeatable-read catalog snapshot, system ID, backend/session identity and sentinels. Require the pinned staging-specific CA, verify-full TLS, separate password/URI agreement, protected schema rejection and qualified session-pooler identity. Receipt and bundle age must be within ten minutes and bound to a newly generated invocation session and approved source.

The existing identity SELECT and effective-privilege SELECT are reused; post33 is validated explicitly instead of pretending it is final32. No saved probe result can satisfy capture. The separate hosted type/capability gate remains downstream: strict structure and the audited PostgREST14.x profile with Supabase JS2.98.0, PostgREST JS2.98.0 and SSR0.9.0. Local pre/post generated types are both compared during simulation. Hosted type generation is intentionally not performed by this narrowly scoped mutation command; its result explicitly says HOSTED_DOWNSTREAM_GATE_REQUIRED and deploymentAuthorized:false.

## Dry-run and atomic apply

Dry-run checks exact source inventory against freshly captured history. The set difference must be exactly `[20260913131931]`; it does not invoke generic db push. No seed, reset, replay or history repair is reachable from the hosted adapter. Only sanitized result/state/version/hash/session evidence is persisted; no SQL URI, tokens, user content or arbitrary provider text.

Apply repeats dry-run IN THE SAME invocation, then recaptures all provider/A/B/cluster evidence and compares the initial and latest snapshots. It rechecks source/bytes/pending set immediately before mutation. A historical standalone dry-run receipt is informational only.

The private psql adapter retains TLS and separate-password connection controls. Only its apply path clears the read-only probe default. One transaction takes an advisory lock plus migration-history table lock, repeats exact32 history/catalog and bridge/private owner/ACL guards, executes only the pinned migration, inserts precisely its history row and requires the final catalog before COMMIT. Concurrent/already-applied history cannot pass the transaction guard. Post-commit fresh A/B checks require exact33, the new definition and unchanged private/other functions, then stop. There is no deployment/QA continuation.

Exact33 on entry yields ACCESS_BRIDGE_ALREADY_COMPLETE with mutation:false only after strict final schema validation. An apply error is ACCESS_BRIDGE_APPLY_FAILED with no retry: the outcome may be unknown, requiring read-only reconciliation in the same approved recovery window. A post-check failure blocks handoff, even if the transaction committed. Do not repeat apply blindly or run generic migration commands.

Structured failures include mode/target/history/schema/definition/byte/pending mismatch, stale/missing identity, unexpected grants, dry-run/apply errors, final history/definition/catalog failures and source-not-committed. Raw exceptions are reduced to bounded ACCESS_BRIDGE codes by the CLI.

## Reproducible local validation

```text
node scripts/staging/validate-access-bridge.mjs --reset-disposable
node scripts/test-trip-invitations.mjs
node scripts/staging/test-access-removal-boundary.mjs
node scripts/test-invitation-delivery.mjs
```

The first command accepts only the explicit local reset flag and only the already-running `supabase_db_invitation-phase1-test` container. It builds a temporary exact-byte32 migration directory from repository files, resets without seed, captures the real pre-state, generates types, exercises the actual transition state machine and transaction SQL, generates final types, refuses repeat application and runs negative tests. Control-plane evidence is explicitly synthetic ONLY in this local adapter. No hosted credentials or checkpoints are fixtures. Temporary fixture cleanup is limited to its owned directory; generated33/types/result evidence goes under ignored output.

Run the retained opt-in removal API and lifecycle suites sequentially with INVITATION_LOCAL_DB_TEST=true. They test actual POST/service/SQL behavior with synthetic Auth/network transport: Owner success; Viewer/Editor/cross-trip and owner/self/final-owner denial; spoof resistance; Crew optional-link clearing with gear/meals preserved; consumed invitation cannot regrant. The same-backend COMMIT/ROLLBACK claim-isolation suite and observed-lock demotion race remain required. **REAL_STAGING_SESSION_QA_PENDING**.

## Future hosted window, NOT executed

1. Our Adventures read-only baselines and authenticated8/8 image probe.
2. Authorized pause of Our Adventures and resume of staging.
3. Fresh exact32 provenance/identity/schema/ACL proof; explicit access-bridge dry-run and one apply.
4. Strict final33 verification, preserved hosted types and capability gate.
5. Separately authorized staging deployment of exact approved SHA and runtime-isolation proof.
6. Separately authorized real invitation QA and access-removal through the real endpoint; actual Viewer/Editor denial.
7. Restore dormant staging settings/hold, pause staging, restore Our Adventures and repeat app/data/storage/8-of-8 checks.

All previous abort/recovery rules apply. This tooling does not pause/resume projects, toggle holds, deploy, enable delivery or invoke the browser harness.

## Files introduced by this task

- scripts/staging/access-bridge-32-to-33.mjs
- scripts/staging/accessBridgeContract.mjs
- scripts/staging/accessBridgeSource.mjs
- scripts/staging/accessBridgeTransport.mjs
- scripts/staging/accessBridgeContract.test.mjs
- scripts/staging/validate-access-bridge.mjs
- docs/staging-access-bridge-transition.md

No original product or migration file was edited.

## Local validation results — 2026-09-13

| Gate | Result |
| --- | --- |
| Fresh disposable 32-to-33 replay | PASS: zero-write dry-run, exactly one apply, strict final catalog, repeat refused |
| New transition regression tests | 65 passed |
| Focused API/domain/privacy/token/component tests | 122 passed; 5 opt-in database tests skipped here and exercised separately |
| Opt-in real local removal API / lifecycle | 20 distinct tests passed; one lifecycle test initially exceeded its fixed 30-second timeout and passed on isolated rerun |
| SQL contracts | 398 assertions passed |
| Authorization races | 7 existing races plus 1 access-removal demotion race passed |
| Same-connection access-removal boundary | 11 scenarios passed, including COMMIT/ROLLBACK caller-claim isolation |
| Delivery/rate concurrency | 3 scenarios passed; no email sent |
| Retained harness, removal, hosted types and SQL identity/probe contracts | 196 tests passed |
| PostgREST capability profile | 45 tests passed |
| Credential discovery | 93 tests passed; no live requests |
| Generated public types before and after transition | Normalized and structural equivalence PASS |
| TypeScript | Standard tsc --noEmit --incremental false PASS in isolated candidate |
| Production build | Standard Next.js/Turbopack build PASS; 13 static pages generated |
| Scoped ESLint / Node syntax | PASS for all six new JavaScript modules |
| Scoped secret/path scan / whitespace / git diff --check | PASS |

The isolated candidate consists of committed source plus the reviewed server package and this transition, using the existing installed dependencies. Synthetic configuration is used for build validation; no production credentials or environment files are copied. The build emitted the existing multiple-lockfile/root inference warning from the nested validation copy; no configuration was changed. Real staging-session invitation/access-removal QA remains pending and is not implied by local fixture success.

Read-only safety checks during this task confirmed production and Our Adventures ACTIVE_HEALTHY, staging INACTIVE/PAUSED, and the staging Vercel hold at `exit 0`. Production remains at 28 migrations, latest `20260824151000`, with invitation infrastructure absent and its deployment unchanged. Hosted staging remains at its last-verified 32-migration state; this task did not resume it or query its paused database. Migration 33 was applied only to the disposable local database.

All 28 preexisting unrelated files and all 16 reviewed server-package files match their preserved hashes. No hosted mutation, deployment, email, invitation, UI change, commit or push occurred.
