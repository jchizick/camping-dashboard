# Explicit staging repair transition

Local tooling preparation only. No hosted execution is authorized by this document.
The ordinary `migrate.mjs verify` entry and final POST contract are unchanged;
ordinary `plan` and `apply` remain rejected. This repair is not a production executor.

## Invocation for a separately authorized window

```sh
node scripts/staging/repair-31-to-32.mjs STAGING_REPAIR_31_TO_32 --dry-run
node scripts/staging/repair-31-to-32.mjs STAGING_REPAIR_31_TO_32 --apply
```

Both commands collect new A/B and independent identity evidence themselves. The
apply command repeats its own dry-run and re-collects evidence before mutation;
a prior dry-run artifact is never sufficient authorization. No default action.

Provide runtime secrets through a secure process environment, never command-line
shell interpolation, reports or committed fixtures:

- `STAGING_REF`: exactly `mgnkvfohpqixgacszovv`.
- `STAGING_DATABASE_URL`, `STAGING_DATABASE_PASSWORD`: provider-proven staging
  session-pooler credentials with `sslmode=verify-full`.
- `SUPABASE_ACCESS_TOKEN`: existing authorized staging management credential.
- `SUPABASE_READ_SETUP_TOKEN`: existing staging-scoped setup-read credential.
- `STAGING_SSL_ROOT_CERT`: absolute path to the reviewed staging CA. Its pinned
  SHA256 is `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
  A replacement CA requires review, not a bypass.
- `STAGING_EVIDENCE_DIR`: new absolute, ignored evidence directory for this run.
- Optional `STAGING_PSQL_PATH`, `STAGING_CLI_PATH`, `STAGING_SOURCE_DIR` locate
  PostgreSQL 17/18, pinned Supabase CLI 2.109.1 and the approved source checkout.

Use a clean checkout honoring `.gitattributes`. Migration inventory and raw byte
hashes are mandatory. The existing pins require CRLF for migrations 1–31 and the
type baseline, and LF for migration32 and the catalog SQL. The previous all-LF
attributes contradicted those pins; the scoped attributes now preserve them on
every platform. SQL/type declarations and pinned hashes are not changed.
The migration is pinned to its reviewed bytes in source commit
`0c967d5150b8823932725918fcc94d8a6519936a`; repair tooling itself must pass review
before a hosted run. The adapter copies the verified inventory into an owned
temporary project with no linked ref, roles or seed files. It removes that copy
afterward and accepts no arbitrary migration name.

## Contracts

`POST_MIGRATION_31_PRE_REPAIR` requires the exact first 31 versions, all current
POST sentinels, correct database/backend/session role, read-only state, rejection
of protected schemas, active Management identity, current credential/pooler
provenance, pinned valid CA, verify-full TLS, A/B agreement and independently
addressed cluster identity. Evidence is bound to a random invocation session,
source and ref, with a ten-minute maximum age; it is not loaded from a saved gate.

The three target functions must have no PUBLIC/anon/unknown-role grant and no
unexpected grant option. Authenticated EXECUTE must exist. Service-role EXECUTE
may be present or already absent. Effective privileges are checked as well as
direct ACLs. Removing only those three optional service-role entries must produce
the pinned complete intended catalog SHA256. Every other catalog entry remains
mandatory; the historical aggregate `910e5310fd9b21f2c0b7ed49eff4ac39` is recorded
when observed, not used as the sole authorization test.

List output must show the exact local32/remote31 inventories. The CLI dry-run
must name only `20260912215252_normalize_public_function_execute_privileges.sql`.
Only then can `db push` run against the explicit validated staging URL and frozen
inventory, without include-all, seed, roles, reset or history repair. It is never
retried automatically. A changed second snapshot aborts before application.

After application, exact32 history, effective ACLs, definitions, owners and all
other catalog grants must match. The unchanged strict `sqlEvidence(..., POST)`
verifier must pass, including `b3e3c93d5de2a53b9e7a4afae89d9ada`. Complete32 on
entry returns `REPAIR_ALREADY_COMPLETE` without mutation. A failed post-check
means application may have happened: preserve evidence and recover availability;
do not rerun the repair or deploy.

Before/after schema-only manifests, component hashes, functions and ACL evidence
are saved before comparison. Errors contain bounded codes, not raw DB/CLI output.
Success explicitly says `deploymentAuthorized: false`; hosted type generation
and its existing raw-artifact/normalized/structural gates remain downstream.

## Future active sequence (do not execute during preparation)

1. Verify production and authenticated Our Adventures/data/8 images baselines.
2. Pause only Our Adventures, verify the slot, resume staging to ACTIVE_HEALTHY.
3. Refresh credentials, provider pooler evidence and staging TLS trust.
4. Explicit repair dry-run: new 31-state A/B, independent cluster proof, safe ACLs
   and complete catalog preconditions; confirm migration32 is the sole pending file.
5. Explicit repair apply: repeat all checks, apply once, verify exact32, final ACLs
   and unchanged strict final catalog contract.
6. Generate and preserve raw hosted public types; run unchanged type comparisons.
7. Only with every gate passed and separate window authorization: release staging
   Vercel hold, deploy the approved SHA and prove runtime isolation to staging.
8. Reinstate staging hold, pause staging, restore Our Adventures and verify all
   application/data/storage baselines. Recheck production unchanged.

At any significant blocker, stop staging work and follow that recovery sequence.
Delivery stays disabled. No real invitation QA is part of this repair.

## Local verification

```sh
node scripts/staging/validate-local.mjs --reset-disposable
```

This uses only the fixed disposable `invitation-phase1-test` project. It replays
31, injects the three hosted-style grants locally, runs the same repair state
machine with synthetic control-plane evidence, uses actual CLI list/dry-run/push
locally, refuses a second application, invokes the original final verifier and
generates/types-compares the result. Hosted TLS/API identity are unit-tested
contracts, not claimed as a live hosted rehearsal. No hosted fixtures or credentials
are needed. The existing SQL, concurrency and credential suites still run.

### Validation record (2026-09-12)

Candidate validation used an isolated approved-source copy plus these changes,
with dependencies installed there. A separate real Git checkout verified the
33 pinned migration/type files against the candidate's checkout attributes.
No historical output or hosted capture was used to generate test fixtures.

- Real disposable 31-to-32 CLI repair: PASS; dry-run only 32; exactly one apply;
  repeat refused with REPAIR_ALREADY_COMPLETE.
- Final strict catalog: b3e3c93d5de2a53b9e7a4afae89d9ada; all eight schema checks,
  normalized generated types and structural type comparison passed.
- Node staging contracts: 250 passed, zero failed (including repair negatives).
- Credential discovery: 93 passed, no live requests.
- Existing SQL suite: 324 assertions passed in ten completed files, then the
  weather suite stopped after assertion 26 with Daily weather payload is invalid.
  The untouched fixture uses UTC current_date but declares America/Toronto.
  At execution UTC date was September 13 and Toronto date was September 12.
  Re-running that unchanged weather file with a session-only Toronto timezone
  passed all 50 assertions. No source or persistent database timezone was changed.
- The unmodified aggregate command therefore exited unsuccessfully; its seven
  concurrency checks were not reached. Do not describe the full gate as PASS.
- Changed JavaScript syntax and diff whitespace checks passed. All 23 tracked
  preservation-baseline files retained their original hashes; staged count zero.

The repair-specific checks pass, but the aggregate gate needs its existing
weather-fixture date assumption resolved before an unconditional commit-ready
recommendation. No hosted rehearsal, mutation, deployment, email or invitation
was performed; hosted state was not re-read during this local-only task.

## Deterministic weather fixture and candidate manifest

The earlier aggregate failure was a TEST FIXTURE ASSUMPTION. The product helper
uses the provider timezone, falling back to UTC only when absent. This fixture
explicitly supplies America/Toronto while its forecast/trip dates used the
incoming session calendar. At reproduction, process UTC / session UTC produced
September 13 while the provider calendar was September 12: assertion 27 raised
before emitting a TAP result. Both Toronto-session reproductions passed 50.

The fixture now sets transaction-local America/Toronto and rolls it back with
all test data. Four fixed-instant assertions cover differing UTC/Toronto dates,
fixture-calendar agreement, and winter offset. No product timezone or clock
behavior changes. UTC/UTC, UTC/Toronto and Toronto/Toronto each pass 54 assertions.
The session-calendar boundary assertion fails if the local setting is removed
under UTC, independently of the actual current date.

### Checkout attributes audit

The LF default for supabase/migrations/*.sql is retained. Exactly the first 31
filenames in scripts/staging/migrations.json have explicit text eol=crlf
overrides, because their existing byte hashes require CRLF. Migration 32 and
future migration names retain LF. scripts/staging/*.sql remains text eol=lf
unchanged. src/types/supabase.ts uses text eol=crlf to reproduce the baseline
hash 5a0fa3f14e7305abd2caa9e0862a2e3f9048f01c60f08cb7e29e9ca7460e7e61
already required by migrate.mjs. No other paths change line-ending behavior.
A fresh Git checkout using these attributes matches all 32 migration hashes
and that type hash; no manual newline conversion is required.

### Incremental package: 11 files

This extends the existing committed 37-file package at
0c967d5150b8823932725918fcc94d8a6519936a; it does not replace that baseline.
Apply all 11 paths together to that baseline. Existing dependencies remain
committed there; there are no historical-output or encrypted-fixture dependencies.

| Path | Purpose |
| --- | --- |
| .gitattributes | Exact pinned checkout bytes, with narrowly named overrides |
| scripts/staging/repairContract.mjs | Pure explicit repair guards and final handoff |
| scripts/staging/repairTransport.mjs | Private hosted adapter behind guarded entry |
| scripts/staging/repairFunctions.sql | Read-only function definition/ACL evidence |
| scripts/staging/repair-31-to-32.mjs | Explicit repair CLI only |
| scripts/staging/repairLocal.mjs | Disposable real-CLI simulation |
| scripts/staging/repairContract.test.mjs | Positive/negative repair regression contracts |
| scripts/staging/fixtures/repair.mjs | Synthetic control-plane fixture builder |
| scripts/staging/validate-local.mjs | Aggregate replay/repair/type/SQL/credential gate |
| supabase/tests/weather_refresh_scheduler_test.sql | Provider-calendar test setup and boundaries |
| docs/staging-repair-31-to-32.md | Future runbook, package manifest and validation record |

Relative imports and URL resources were recursively checked in the isolated
candidate: 39 dependency files, zero missing. Runtime migration inventory,
config, SQL suites, generated types and credential tests are additionally
exercised by the aggregate command. Installed npm dependencies come from the
committed lockfile. PostgreSQL, Docker, PowerShell and pinned Supabase CLI remain
external tools; their runtime paths are not committed machine-specific values.

### Final aggregate gate (supersedes the earlier partial validation record)

PASS from a fresh detached checkout of the approved baseline with the 11-file
candidate overlay and a fresh lockfile install (528 packages). Git itself
materialized the pinned bytes from the narrowed attributes.

- 250 staging/repair tests passed, zero failed.
- 378 aggregate SQL assertions passed, including all 54 weather assertions.
- All seven concurrency checks passed.
- 93 credential tests passed with no live credential requests.
- Disposable real CLI exact 31-to-32 repair passed; exactly one apply;
  already-complete invocation refused without a second mutation.
- Final catalog b3e3c93d5de2a53b9e7a4afae89d9ada, ACLs, eight schema checks,
  normalized and structural generated-type comparisons all passed.
- Changed JavaScript syntax, whitespace and diff checks passed.
- Weather matrix: 54/54 in UTC/UTC, UTC/Toronto and Toronto/Toronto.
- A rollback-only negative probe without the fixture timezone correctly failed
  the fixed boundary comparison (UTC September 13 versus Toronto September 12).
- Eight repair tooling files remain byte-identical to the prior candidate.
- All 23 unrelated preservation-baseline files remain byte-identical.

Read-only project metadata confirmed production and Our Adventures
ACTIVE_HEALTHY, staging INACTIVE/paused. Hosted staging history remains last
verified at 31; no hosted SQL or migration was executed to re-read or change it.
No pause/resume, deployment, email, hosted invitation, staging, commit or push.
Recommendation: READY TO APPROVE REPAIR PACKAGE.
