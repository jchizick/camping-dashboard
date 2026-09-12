# Self-contained privilege-normalization package

**SELF-CONTAINED PACKAGE — READY FOR REVIEW**

This 37-file proposed manifest supersedes every earlier 12/39-file list. It is not yet approved for commit. No commit, push or hosted action is authorized by this report.

## Authoritative proposed manifest — 37 files

Paths are relative to camping-dashboard.

| Path | Category | Reason |
|---|---|---|
| .gitattributes | durable staging tooling | Enforces LF for pinned migration, SQL resource and type baseline bytes. |
| docs/privilege-normalization-package.md | documentation | Authoritative reviewed-candidate manifest and clean-checkout results. |
| docs/privilege-normalization-validation.md | documentation | Portable setup/validation guide and separate hosted safety semantics. |
| scripts/staging/catalogComparison.mjs | durable staging tooling | Strict full-catalog comparator; no authorization exceptions. |
| scripts/staging/catalogComparison.test.mjs | test | Comparator and evidence persistence regressions. |
| scripts/staging/catalogDeterminism.test.mjs | test | Compares two fresh 31-migration replays from this run. |
| scripts/staging/catalogEvidence.mjs | durable staging tooling | Capture-before-comparison evidence API used by regression tests and future callers. |
| scripts/staging/catalogReplay.mjs | durable staging tooling | Generates local catalog/history from canonical SQL through a supplied local executor. |
| scripts/staging/credentialDiscovery.psm1 | durable staging tooling | Protected-target and credential-discovery safety logic. |
| scripts/staging/credentialDiscovery.test.ps1 | test | 93 synthetic credential/discovery tests; owns its temporary files. |
| scripts/staging/fixtures/README.md | documentation | Documents synthetic fixture scope and generated inputs. |
| scripts/staging/fixtures/functionGrantDrift.mjs | committed fixture | Minimal synthetic three-function extra-EXECUTE discrepancy fixture. |
| scripts/staging/functionGrantDiagnostic.mjs | durable staging tooling | Distinguishes direct/PUBLIC execution and grant-option changes. |
| scripts/staging/functionGrantDiagnostic.test.mjs | test | Grant semantics and synthetic hosted-drift regression. |
| scripts/staging/functionGrantLocal.test.mjs | test | Rollback-only PostgreSQL default-ACL and replacement proof. |
| scripts/staging/functionGrantMetadata.sql | SQL resource | Optional read-only explicit/effective ACL diagnostic. |
| scripts/staging/guard.mjs | durable staging tooling | Strict byte manifest, history and protected-project validation. |
| scripts/staging/guard.test.mjs | test | Validates actual checkout source and protected targets. |
| scripts/staging/localReplayEvidence.mjs | durable staging tooling | Verifies newly generated types, local identity and eight schema checks. |
| scripts/staging/migrate.mjs | durable staging tooling | Verify-only hosted entry; explicit fresh gate/certificate inputs, no output-path fallback. |
| scripts/staging/migrations.json | durable staging tooling | Pinned exact 32-migration inventory and byte hashes. |
| scripts/staging/packagePortability.test.mjs | test | Temporary source fixture, tamper rejection and portable-input regressions. |
| scripts/staging/paths.mjs | durable staging tooling | Module-relative source root independent of caller directory. |
| scripts/staging/postMigrationContract.mjs | durable staging tooling | Exact POST history, fingerprint and sentinels; verify-only authorization. |
| scripts/staging/postMigrationContract.test.mjs | test | POST/PRE, exact digest/history and apply rejection regressions. |
| scripts/staging/privilegeNormalization.test.mjs | test | Actual migration repairs drift idempotently; all function metadata/ACL snapshots unchanged. |
| scripts/staging/replayContext.mjs | durable staging tooling | Loads only the harness-generated temporary replay handoff and validates its shape/target. |
| scripts/staging/schemaFingerprint.sql | SQL resource | Pinned complete authorization catalog query. |
| scripts/staging/sqlIdentity.mjs | durable staging tooling | SQL identity/provenance and strict evidence validation. |
| scripts/staging/sqlIdentity.test.mjs | test | Protected identities and evidence invariants. |
| scripts/staging/sqlProbe.mjs | durable staging tooling | TLS, Probe A/B and mandatory fresh-gate logic. |
| scripts/staging/sqlProbe.test.mjs | test | Probe/session/freshness/certificate safety regressions. |
| scripts/staging/typeComparison.mjs | durable staging tooling | Structural TypeScript comparison; substantive changes rejected. |
| scripts/staging/typeComparison.test.mjs | test | Inline synthetic formatting, ordering, nullability and type/signature cases. |
| scripts/staging/validate-local.mjs | durable staging tooling | Self-provisioning local replay/test orchestration and checked temp cleanup. |
| scripts/staging/verify.sql | SQL resource | Eight read-only schema/grant verification checks. |
| supabase/migrations/20260912215252_normalize_public_function_execute_privileges.sql | migration | Approved exact-signature privilege-only migration. |

## Previous seven failures and replacements

| Prior failed test | Actual contract / replacement |
|---|---|
| catalogDeterminism module load | Two independent fresh 31-migration replays generated by the harness; exact histories, fingerprints and complete catalogs still compared. |
| functionGrantDiagnostic hosted-evidence case | Minimal synthetic ACL fixture with exactly the three additional non-grantable service_role EXECUTE entries. No full historical manifest. |
| guard prepared-source test | Module-relative checkout root; an additional owned temporary source fixture proves real byte tampering is rejected. |
| privilegeNormalization fresh-evidence case | Fresh 31/32 catalogs and generated types, compared to committed source baseline; no saved output. |
| privilegeNormalization already-normalized profile | Fresh baseline catalog supplied by the current run; SQL owner/body/ACL snapshot and exact fingerprint comparison retained. |
| privilegeNormalization hosted-three-grants profile | Actual function ACL drift simulated locally, then real migration applied twice; fresh baseline comparison retained. |
| privilegeNormalization broad-provider-acl profile | PUBLIC/anon/service-role grants and missing authenticated grant simulated; actual normalization and complete metadata comparison retained. |

All substantive rejection cases remain. The original two fresh31 determinism checks were not replaced by weaker static hash checks. The CREATE OR REPLACE ACL test remains on PostgreSQL and actual create_trip, not merely a mock.

## Inputs and portability

Only one new committed fixture is needed: fixtures/functionGrantDrift.mjs, containing exact signatures and ACL tuples. Type-comparison fixtures remain small inline synthetic TypeScript strings. Full types/catalogs are generated from current migrations at validation time. No credentials, private rows, raw invitation tokens, hosted logs or Jordan/Liz data are in fixtures.

paths.mjs resolves source relative to its module. The full validation command creates and owns an OS temporary directory, generates the disposable project from checkout SQL/config, passes fresh captures to its child test suite and removes all temporary source/evidence afterward. STAGING_TEST_REPLAY is generated by the harness, not an input a developer must prepare. The only external prerequisites are installed Node/Docker/PowerShell and the pinned CLI/dependencies.

Scoped LF attributes retain pinned byte hashes on Windows clones; no fingerprint/hash comparison was loosened. Runtime hosted verification uses explicitly supplied fresh identity evidence and a TLS certificate, with no fallback to an old local output path. Those security inputs are necessarily required for separately authorized live verification but are not prerequisites for local tests. Capture tools may write new local evidence; no committed test reads pre-existing output.

## Dependency closure

```text
validate-local -> paths, guard -> migrations.json + checkout migrations
               -> catalogReplay -> postMigrationContract -> migrations.json
                                                        -> schemaFingerprint.sql
                                                        -> typeComparison -> installed TypeScript
               -> localReplayEvidence -> typeComparison, sqlIdentity, verify.sql
               -> temporary fresh replay handoff -> replayContext
                  -> catalogDeterminism.test, privilegeNormalization.test
               -> baseline scripts/test-trip-invitations.mjs -> baseline supabase/tests/*.sql
               -> credentialDiscovery.test.ps1 -> credentialDiscovery.psm1
functionGrantDiagnostic.test -> fixture module, functionGrantDiagnostic, catalogComparison
catalogComparison.test -> catalogComparison, catalogEvidence, sqlProbe
catalogEvidence -> catalogComparison
migrate -> paths, guard, postMigrationContract, typeComparison, sqlProbe, verify.sql
sqlProbe -> guard, sqlIdentity -> postMigrationContract
remaining unit tests -> their included modules and generated synthetic/temp inputs
```

All relative source/resource imports are included or already tracked in the baseline. Other unchanged prerequisites include package.json/package-lock.json, supabase/config.toml, the first 31 migrations, src/types/supabase.ts, SQL contracts and the concurrency runner. The source-only copy independently installed the locked packages. No uncommitted helper, bootstrap wrapper or ignored historical resource was overlaid.

## Clean-checkout proof and exact results

Baseline: **03ebd55e09159ee4f8cd0678dd3f45fdf8fdbbdb**. A new git archive was extracted under output/privilege-self-contained/clean. Only the proposed source files were overlaid; the final report was added afterward as documentation of the completed run. No source changed after the successful run. Dependency installation used npm ci with lifecycle scripts disabled for the audit; a verified installed CLI 2.109.1 was selected through SUPABASE_CLI_PATH, exercising the documented portable override. PowerShell executable selection likewise used PWSH_PATH.

The harness command ran inside the clean candidate, not the dirty workspace:

```sh
node scripts/staging/validate-local.mjs --reset-disposable
```

- **186 Node tests PASS; 0 failed; 0 skipped**. This is the original 182-test privilege/identity/catalog/type gate plus four portability tests. The unrelated Vercel suite is outside this focused package; its removal accounts for the difference from the broader 225-test audit inventory.
- Two independent fresh **31-migration** baseline replays matched; final fresh **32-migration** replay PASS, last **20260912215252**.
- **374 SQL assertions across 11 files PASS**.
- **Seven local concurrency checks PASS**.
- **93 credential-discovery tests PASS**, synthetic fixtures, no live credential requests.
- **Eight schema/grant checks and local POST identity PASS**.
- Actual drift repair, repeated application and CREATE OR REPLACE regressions PASS; all unrelated function owners, definitions and ACLs unchanged.
- Authorization fingerprint **b3e3c93d5de2a53b9e7a4afae89d9ada**, unchanged.
- Generated public types: **normalized PASS; structural PASS**. Fresh31 and fresh32 output byte-identical; no source types changed.
- **26 JavaScript syntax checks and two PowerShell parse checks PASS**.
- Candidate whitespace/diff and secret/path scan PASS. One scan match was the negative-test regex for forbidden Windows paths, not a literal machine path or credential. No suspected credential values were printed.
- The clean candidate had **no output directory before or after validation**. No original staging-bootstrap directory, encrypted tokens, historical hosted catalogs or previous snapshots were available. The harness's temporary directory was removed.

Local audit logs remain ignored under output/privilege-self-contained. They are not part of this manifest or required for a new run.

## Migration and hosted release semantics

Migration bytes unchanged: SHA256 **89ecf52874ef94e893e8377d9a38508096a00eb9208d08f7b9c20e6c28eb4d26**.

```sql
public.claim_trip_alerts_manual(text,text,integer,integer)
public.claim_trip_weather_manual(text,text,integer,integer)
public.create_trip(text,date,date,double precision,double precision,text,text,text,text,text,text)
```

For each: PUBLIC=false, anon=false, authenticated=true, service_role=false for EXECUTE. No function bodies, owners, arguments, return types, security modes or search_path changes. The 19 intentionally service-role-enabled public functions and all private-function grants remain intact.

Hosted staging remains paused at the previously verified 31 migrations; production remains at 28 and untouched. No repair/apply command is enabled. A future 31-to-32 repair and deployment require separate review, current identity proof and approved commit pinning. Production release must account for the preceding invitation migrations rather than blindly applying the chain.

## Excluded local work

The old chronological staging runbooks/diagnosis reports and privilege-normalization-package-audit.md remain local historical documents, outside this final package. The portable guide replaces their operational dependency chain for this candidate. Excluded source wrappers: discover-credentials.ps1, our-adventures-baseline.sql, run-vercel-prep.ps1, sqlLocalPreflight.mjs, vercelPrep.mjs, vercelPrep.test.mjs and vercelPrepRunner.mjs. They are not imported by this package and were not deleted or refactored.

All output directories, hosted catalog/type captures, CA/binary artifacts, checkpoints, encrypted credentials and Vercel/bootstrap helpers remain ignored/local. No historical evidence was promoted to a fixture.

Unrelated modified/untracked files preserved: src/app/globals.css; src/app/mobileTypographyApplication.test.ts; src/components/home/MobileHomeOverview.test.tsx; src/components/home/ReadinessGauge.tsx; design-qa.md; public/C7BD79FC.jpg; public/SCHABO-Condensed.woff2; public/green_trees_topographic_bg.png; public/sunset-camp-fire.png; scripts/offline-reliability-browser.cjs. All 19 existing preservation hashes match.

## Commit shape and safety

**SINGLE SELF-CONTAINED COMMIT**: migration plus durable verification, safety tests, synthetic fixture and portable documentation form one tested unit. No split is needed merely to reduce file count.

Production and Our Adventures confirmed ACTIVE_HEALTHY; staging INACTIVE/paused. No hosted mutation, deployment, email or hosted invitation. Nothing staged; no commit or push. HEAD and origin/master remain the baseline, ahead/behind 0/0.

**READY TO APPROVE FINAL MANIFEST.** This is a proposal for review, not authorization to commit or deploy.
