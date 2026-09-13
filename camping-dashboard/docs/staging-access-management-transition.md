# Guarded staging access-management 33 to 34

LOCAL TOOLING IMPLEMENTED; no hosted action authorized by this document.
Current final verification contract is **34**, not 33. The historical 32-to-33
transition/verifier is frozen support code; it cannot authorize this final state.

## Exact contracts

Mode: `STAGING_ACCESS_MANAGEMENT_33_TO_34`.
Target: only `mgnkvfohpqixgacszovv` (`field-protocol-staging`). Production
`gdsmyxzqtmhwbcyobzou` and Our Adventures `rmfhueseulevyvetblnn` are rejected.

Pre-state: `POST_MIGRATION_33_PRE_ACCESS_MANAGEMENT`, exact ordered 33 versions
from the existing pinned 32 manifest plus migration `20260913131931`.
Strict catalog: `58c4311b982fe8716cbc19ea5c687093`.
The existing final-33 schema verifier is called unchanged.

Only pending migration: `20260913204351_trip_access_management_read.sql`.
Reviewed physical-byte SHA-256:
`e54a591b31157766771fdef6cf7b4de3eff539434ae6156a690d16041a91aaf3`.
No EOL reconstruction is allowed for migration 34; historical migrations retain
their existing exact-hash EOL reconstruction. No migration bytes were edited.

Final: `POST_ACCESS_MANAGEMENT_STAGING_34`, exact ordered 34 versions, latest
`20260913204351`, catalog `3c6049625e9eb174cbe148eb44592da0`.
Full normalized catalog SHA-256 is separately pinned. The only permitted catalog
delta is `public.trip_invitation_bridge(uuid,text,jsonb)` definition/body.

Bridge definition SHA-256 pins:

- Pre: `cce6bb5918b36a87d4c9ec4a8567ebb3370f35c95a144366be69df23d2e5201c`
- Final: `71379fccb8ab668a8673fa5b8ad923d363c53106990aee518e50f79122956b6e`

Both require postgres ownership, SECURITY DEFINER, empty search_path, and effective
postgres/service_role execution only. PUBLIC/anon/authenticated execution and grant
options remain forbidden. The private removal definition is pinned independently;
the complete catalog and effective-function snapshots preserve every other private
primitive, resolver, owner check, table, trigger, RLS policy and grant.

## Commands for a separately authorized future window

```text
node scripts/staging/access-management-33-to-34.mjs STAGING_ACCESS_MANAGEMENT_33_TO_34 --dry-run
node scripts/staging/access-management-33-to-34.mjs STAGING_ACCESS_MANAGEMENT_33_TO_34 --apply
node scripts/staging/access-management-33-to-34.mjs STAGING_ACCESS_MANAGEMENT_33_TO_34 --verify
```

The ordinary `node scripts/staging/migrate.mjs verify` now delegates to the strict
final-34 verifier. `plan`, `apply`, missing mode and aliases fail before credentials
or hosted I/O. A 33-state DB cannot pass final verification. No generic db-push,
seed, reset, repair, replay or arbitrary migration-selection path is enabled.

Runtime inputs retain the existing secure environment contract: STAGING_REF,
STAGING_APPROVED_SOURCE_SHA, STAGING_DATABASE_URL, STAGING_DATABASE_PASSWORD,
STAGING_SSL_ROOT_CERT, STAGING_PSQL_PATH (optional), STAGING_EVIDENCE_DIR,
SUPABASE_ACCESS_TOKEN and SUPABASE_READ_SETUP_TOKEN. Never commit their values.
The approved SHA must be an explicit future reviewed commit. HEAD and every static
runtime dependency, migration, lockfile and type baseline must match its Git blobs.
The current uncommitted package cannot authorize a hosted invocation.

## Identity, freshness and mutation discipline

Each invocation creates a new session ID. It fetches fresh Management project
identity/status, credential provenance, primary pooler provenance and an independent
cluster identifier. Psql Probe A and Probe B must agree. Require the pinned staging
CA, verify-full TLS, separate password/URI agreement, exact session-pooler routing,
postgres/session identity, read-only probes and protected-schema rejection.
Receipt/session/source freshness is bounded to ten minutes. No historical saved
probe, credential-discovery receipt, cluster ID or catalog can authorize mutation.

Dry-run validates source bytes, identity, exact final33, definition, ACLs, catalog,
fresh generated types/capabilities, and exactly `[20260913204351]` pending. It performs
zero database mutation. Sanitized evidence files are outputs, never authorization inputs.

Apply repeats dry-run in the same invocation, then recaptures identity/A/B/catalog
and rechecks source bytes and the pending set. A changed cluster or snapshot fails.
One transaction takes advisory and history-table locks, rechecks exact33/catalog/ACLs,
executes the pinned migration once, records precisely its history row, requires the
final catalog and commits. Any failed guard rolls back. Unknown apply outcome is
never retried; stop for read-only reconciliation and existing recovery procedure.

Fresh post-apply A/B evidence must pass final34, exact definitions, effective grants,
unchanged private functions and the sole bridge-body catalog delta. Fresh public
types must pass the existing audited hosted AST normalization/structural and
PostgREST capability gate. Raw types are preserved before comparison. Hosted
normalization retains only the previously approved metadata/generic-constraint
equivalences; it is not raw textual equality. Local generated types require the
existing normalized text and structural equality. No type shape is changed.

Every result has `deploymentAuthorized:false`. Types failing after commit block
final authorization; they do not trigger rollback/reapply. An already exact34 state
returns `ACCESS_MANAGEMENT_ALREADY_COMPLETE`, mutation false, without reapplying;
use `--verify` for full current type verification.

Structured ACCESS_MANAGEMENT failures cover explicit mode, protected/wrong target,
source/dependency mismatch, history/partial schema, definition/ACL/catalog drift,
altered bytes, pending set, stale/missing identity or Probe B, changed cluster,
dry-run/apply failure, final history/definition/catalog and type failure. CLI output
never forwards raw exceptions, database URIs, JWTs or provider text.

## Local validation and reproducibility

```text
node scripts/staging/validate-access-management.mjs --reset-disposable
node scripts/test-trip-invitations.mjs
```

The simulator accepts only the fixed, already-running disposable Docker database
`supabase_db_invitation-phase1-test`. It builds an exact33 temporary migration
directory from repository bytes, replays without seed, captures live local schema,
and drives the real state machine and guarded transaction. Its injected control
plane is explicitly synthetic. It verifies one apply, exact34, equivalent types,
repeated-call refusal and direct duplicate-transaction refusal, then runs the
negative contract tests against that invocation's fresh snapshots.

No saved output, hosted checkpoint, credential, certificate or browser session is
a test prerequisite. Runtime dependency closure is Git-verifiable. Generated
evidence resides under ignored output; temporary cleanup is bounded to owned paths.
The historical guard test reconstructs a pinned32 fixture rather than assuming the
current repository still ends at migration32. Its production guard is unchanged.

## Preserved data semantics and deferred work

Owner-only `list_access` returns people (membershipId, email/null, role,
isCurrentUser) and pending invitations (invitationId, email, role, pending status,
createdAt, expiresAt). Viewer, Editor, cross-trip Owner and unauthenticated callers
remain denied without identities. Repeated reads do not mutate membership,
invitation/delivery/attempt state or quota buckets. Existing mutation paths remain.

`ORIGINAL_CREATOR_MUST_REMAIN_OWNER`: only same-trip, pending, DB-time-unexpired
invitations whose original creator is still an Owner are shown. Hiding is not
revocation; a hidden pending row may retain the recipient uniqueness reservation.
Future ownership-management UI must handle this. No semantic change is made here.

GET availability remains authenticated and boolean-only; disabled configuration
returns false and fails POST closed before any schema-dependent RPC. No UI built.
`ACCOUNT_SWITCH_SIGNOUT_SCOPE_REVIEW` remains deferred without auth changes.

Hosted states are last-verified only: staging PAUSED at 33 with exit-0 Vercel hold;
Our Adventures ACTIVE_HEALTHY; protected production at 28. No hosted contact,
mutation, invitation/email QA, deployment, commit or push occurs in this task.

## Validation results for this candidate

- Local exact33-to34 simulation PASS: apply count 1, duplicate state-machine and
  direct transaction attempts refused, strict catalogs/definitions and types PASS.
- Transition contract tests: 71 passed, no skips.
- Identity/credential/TLS/catalog/hosted-type/CLI guard regression: 272 passed.
- Focused management/API/server tests: 144 passed. The initial 20 opt-in skips
  were then run explicitly against local Docker: all 20 passed (164 total).
- SQL contracts: 456 assertions passed; 8 concurrency races passed, including
  owner demotion blocking a waiting management read. DTO secret scans, expiry,
  creator-ownership edge case and repeated-read no-mutation proofs retained.
- Existing create/resend/revoke/inspect/accept/remove_access regression PASS.
- Standard TypeScript and production build PASS in a fresh committed-source archive
  with only the scoped candidate overlaid. Build uses loopback/non-secret settings,
  invitations disabled; existing fonts fetched. A nested-copy lockfile/root warning
  was emitted; no configuration was changed to suppress it.
- Scoped ESLint, syntax, whitespace and secret/private-path scans PASS.

Files added: access-management-33-to-34.mjs, accessManagementContract.mjs,
accessManagementInventory.mjs, accessManagementSource.mjs, accessManagementTransport.mjs,
accessManagementContract.test.mjs, validate-access-management.mjs (all scripts/staging/),
and this document. Files updated: scripts/staging/migrate.mjs,
scripts/staging/guard.test.mjs, docs/staging-access-bridge-transition.md.
The previously reviewed management-read application package is unchanged.
