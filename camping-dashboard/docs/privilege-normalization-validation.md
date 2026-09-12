# Portable privilege-normalization validation

This package validates migration 20260912215252 and the strict staging authorization
contract. It does not authorize hosted migration, deployment, email or invitations.
The old staging-preparation runbook and all machine-specific bootstrap/Vercel
wrappers are outside this package and are not prerequisites.

## Prerequisites and command

Install Node.js, Docker and PowerShell 7 (`pwsh`), then run `npm ci` from the app
checkout. Use Supabase CLI **2.109.1**; no upgrade is implied. The default CLI is
the repository's node_modules/supabase/dist/supabase.js. An explicit SUPABASE_CLI_PATH
may select an installed CLI script; its version is checked. PWSH_PATH optionally
selects the PowerShell executable. No machine-specific paths are stored in source.

```sh
node scripts/staging/validate-local.mjs --reset-disposable
```

This command resets ONLY the dedicated local project **invitation-phase1-test**.
Never store meaningful data there. Docker must have the required images/ports
available. The harness can start the dedicated local stack if absent; it never
accepts a hosted database URL or alternate project identifier. It leaves the
disposable stack available after testing; temporary fixture/source/evidence files
are removed in finally. Do not run other tests against that stack concurrently.

The harness locates source from its module URL, verifies all migration bytes,
creates a fresh OS temporary directory and copies repository migrations/config
there. Only that temporary config's project ID is changed. It performs two fresh
31-migration replays and a fresh 32-migration replay; captures catalog/history and
public types; checks the committed type baseline, exact fingerprint and eight
schema/grant checks; then runs the Node suite serially, SQL/concurrency suite and
credential tests. STAGING_TEST_REPLAY is a private handoff to those tests, generated
and cleaned up by the harness. No prior output directory or saved evidence is needed.
Invoke integration tests through this command rather than supplying old artifacts.

All ignored output, credentials and checkpoints may be absent. Node dependencies,
Docker images and tool executables are installation prerequisites, not test evidence.
Scoped .gitattributes rules preserve exact LF bytes for pinned migration/type inputs
in Windows clones; hash checks are not relaxed to accept modified source.

## Preserved contracts

The migration revokes EXECUTE from PUBLIC, anon and service_role on exactly the two
manual claim RPC signatures and the 11-argument create_trip signature; authenticated
EXECUTE stays granted. SQL assertions compare all function definitions, owners and
ACLs before/after normalization, including CREATE OR REPLACE and repeated migration
application. The 19 intentionally service-role-enabled public functions and private
grants remain unchanged. Synthetic fixtures test parser/grant semantics; generated
fresh database captures prove actual current schema and type equivalence.

The POST target is 32 exact ordered migrations ending 20260912215252, fingerprint
b3e3c93d5de2a53b9e7a4afae89d9ada. All sentinels, protected project checks, strict
catalog comparison and Probe A/B requirements remain intact. No service-role grant
exceptions or semantic-core-only authorization are added.

functionGrantMetadata.sql is the optional read-only diagnostic query for explicit
ACLs, effective execution, owners and default grants. It reads no application rows
and does not run automatically against any hosted environment.

## Hosted verification is separate

migrate.mjs remains verify-only and rejects apply/plan before network access.
If separately authorized later, it requires explicit STAGING_SQL_GATE (fresh Probe
A/B evidence), STAGING_SSL_ROOT_CERT (TLS CA), staging identity/connection and
Management authentication inputs. These are newly provisioned operational inputs,
never committed fixtures or prerequisites for local validation. There is no fallback
to a developer output path. Captured hosted types go to an explicit absolute
STAGING_EVIDENCE_DIR or a newly created temporary directory and must remain local.

Staging still has 31 applied migrations. A future reviewed repair must prove that
exact pre-repair state and known drift, apply only the new migration, and then pass
the ordinary POST-32/catalog/Probe/type gates. This package does not enable that
repair command. Production has only 28 migrations: applying the normal chain would
also involve the preceding invitation migrations and requires separate approval.
The manifest SHA denotes the existing base plus an uncommitted candidate, not a
new approved deployment SHA. Pin the reviewed commit before any hosted release.
