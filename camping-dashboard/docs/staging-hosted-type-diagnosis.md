# Preserved hosted type diagnosis

Historical diagnosis below records the original 14.5 artifact and the then-rejected comparator. The subsequent exact-version gate was deployed, then safely stopped a later window when fresh metadata became **14.17**. That artifact has SHA-256 `43923592af14b186f82f0c58ecaaa54a617d518dac8d27dbb47e0c118d618c59`; structure, all five constraints, exact 32 history, ACLs and strict catalog still passed. No deployment occurred.

The current candidate in [staging-hosted-type-gate.md](staging-hosted-type-gate.md) supersedes the proposed exact-version rule below. Installed Supabase JS/PostgREST JS 2.98.0 enables the same two type capabilities for both versions; compiler tests prove this against installed declarations. Strictly formatted 14.x metadata maps to `postgrest-14-compatible`, with the observed value retained, audited dependency versions enforced, and other server families/prereleases rejected. This is client capability equivalence, not a promise that every server-runtime upgrade is harmless. Schema/catalog authorization remains independent. Neither original nor new metadata divergence was caused by migration 32.

Verdict: **HOSTED TYPE DIFFERENCE — UNDERSTOOD**. Classification **B**, for the database contract and current application: generator representation/metadata divergence, not demonstrated schema drift. The PostgREST capability metadata has a real SDK typing effect and must be checked separately, not discarded as universally meaningless.

No acceptance rule was changed. The existing gate still rejects this pair. Recommendation: **READY TO FIX TYPE GATE**, through a separately reviewed narrow change; not permission to deploy.

## Preserved inputs and three-way comparison

Approved source: `b298454ac29432e5976ae39ecb5f54a07be32b4f`.

| Input | SHA-256 |
| --- | --- |
| Committed application baseline (LF, byte-identical to working file) | `17f0861f483ef70780be1313cd03e0015bf2cae29064b26af8fee1dc3d3abd0d` |
| Preserved approved baseline used during the hosted gate (CRLF) | `5a0fa3f14e7305abd2caa9e0862a2e3f9048f01c60f08cb7e29e9ca7460e7e61` |
| Preserved fresh local 32, `output/staging-bootstrap/normalization32/local-fresh32.ts` | `83751d02633e4cd9ffcdc1f776a9fe474b6a49635b4d142053923971c9c49879` |
| Hosted `output/repair-b298454-window/Final/staging-generated.ts` | `b00ae076a0ae03aa6fc4415340f5eb3b6ac7cd4953091cee010c29c4efd17b51` |

Both baseline copies are structurally equivalent. Baseline vs fresh local 32 passes the unchanged comparator. Baseline vs hosted fails. Original hosted evidence was not regenerated or overwritten.

AST comparison found exactly six paths:

| Structural path | Baseline/local | Hosted | Category |
| --- | --- | --- | --- |
| `Database.__InternalSupabase.PostgrestVersion` | absent | literal `"14.5"` | generator/client capability metadata |
| `Tables.typeParameters.TableName.constraint` | conditional type | same conditional wrapped in parentheses | representation |
| `TablesInsert.typeParameters.TableName.constraint` | conditional type | same conditional wrapped in parentheses | representation |
| `TablesUpdate.typeParameters.TableName.constraint` | conditional type | same conditional wrapped in parentheses | representation |
| `Enums.typeParameters.EnumName.constraint` | conditional type | same conditional wrapped in parentheses | representation |
| `CompositeTypes.typeParameters.CompositeTypeName.constraint` | conditional type | same conditional wrapped in parentheses | representation |

Unwrapping only the outer parenthesized AST node in an isolated diagnostic proves all five inner expressions identical. This experiment does not change gate normalization. The text diff also removes the generated-file comment header, already tolerated by the comparator.

All 18 `public.Tables` match in full: Row, Insert, Update, and every Relationships tuple, including FK names, columns, referenced relations/columns and one-to-one flags. All 22 `public.Functions` match in full: Args, Returns, overload/table-return representation. Views, Enums and CompositeTypes are empty and identical. No relationship or function difference needs a per-FK/per-RPC exception.

## Catalog coverage

Preserved local and repaired hosted catalogs compare equal in every component: columns, constraints, functions, function grants, indexes, policies, relations, relation grants, triggers, RLS and sequences. Fingerprint: `b3e3c93d5de2a53b9e7a4afae89d9ada`.

The FK/uniqueness evidence includes named `pg_get_constraintdef` constraints and index definitions. Function keys include identity arguments; values contain `pg_get_functiondef`, covering arguments, OUT/table/SETOF return declarations and bodies. None of those generated public shapes differ.

The six actual differences are outside the database catalog's purpose: a PostgREST service version is not PostgreSQL schema DDL, and TypeScript helper parentheses are generator formatting. Catalog equality therefore does not imply byte-identical generated files. It is not being substituted for the independent public-type comparison.

**MIGRATION_32_NOT_CAUSAL**: none of the six paths involves the three repaired functions. Their generated signatures are identical; the local version-input experiment reproduces the metadata addition without any schema or ACL change. No rollback is appropriate.

## Generator command parity

Both use CLI 2.109.1, `--lang typescript --schema public`.

- Local replay: `gen types --local --lang typescript --schema public --workdir <disposable project>`. Preserved replay used `output/staging-prep/normalization32/camping-dashboard`; the later clean aggregate used an owned temporary project deleted on completion. Config derives from committed `supabase/config.toml`, changing only the disposable project ID. Local DB container is `supabase_db_invitation-phase1-test`.
- Hosted: `gen types --project-id mgnkvfohpqixgacszovv --lang typescript --schema public`. No generation `--workdir`; wrapper inherited the outer repository working directory. `STAGING_SOURCE_DIR` identified the approved checkout for validation, but was not a type-generator flag. Management authentication comes from encrypted handoff in process memory; no credential values are retained here.
- Installed npm launcher delegates to the platform CLI binary. Pinned source shows local generation running a Docker postgres-meta generator against the database. Remote TypeScript uses Management API `generateTypescriptTypes` with the project ref and `included_schemas=public`, then prints `response.types`; it does not run the local Docker generator or forward a PostgREST version override.
- Cached local generator: `public.ecr.aws/supabase/postgres-meta:v0.96.6`. CLI sets DB URL, query/connection timeout, generation language/schema and one-to-one detection (enabled unless v9 compatibility is requested). It does **not** set `PG_META_POSTGREST_VERSION`. The image reads that variable and conditionally emits `__InternalSupabase`.
- Explicit `public` overrides default schema selection. Local config exposes `public, graphql_public` and extra search path `public, extensions`; neither explains the observed difference. No preserved active hosted API-config snapshot proves all remote settings; active-only config inspection is `ACTIVE_RECHECK_REQUIRED` if desired, but is unnecessary to establish these six artifact differences. The exact deployed Management service implementation/formatter version is not inferred from CLI version alone.

Official implementation references:

- [CLI 2.109.1 TypeScript handler](https://github.com/supabase/cli/blob/v2.109.1/apps/cli/src/legacy/commands/gen/types/types.handler.ts)
- [CLI 2.109.1 Go implementation](https://github.com/supabase/cli/blob/v2.109.1/apps/cli-go/internal/gen/types/types.go)
- [postgres-meta 0.96.6 introspection](https://github.com/supabase/postgres-meta/blob/v0.96.6/src/server/server.ts)
- [postgres-meta 0.96.6 TypeScript template](https://github.com/supabase/postgres-meta/blob/v0.96.6/src/server/templates/typescript.ts)

The public postgres-meta implementation performs database metadata introspection (tables, columns, relationships, functions, types), not a PostgREST OpenAPI scrape. The remote CLI boundary proves a Management API call; it does not by itself prove the service's exact internal deployment.

## Local reproduction and application impact

Two read-only generations ran against the existing disposable exact-32 database, same cached image and network, `public`, one-to-one detection enabled, with a read-only DB session option. Only `PG_META_POSTGREST_VERSION` varied:

1. Unset: output hash `83751d...` exactly reproduces preserved local fresh-32 output and passes baseline comparison.
2. `14.5`: output hash `3ec43fb7289dffa2e4878dd87c21937f285967aec0024b9830bb719f2d6293d2`; adds only the exact hosted metadata field. Compared to hosted, only the five proven parentheses remain.

Before/after catalog and history snapshots were identical. No reset, replay, migration change or hosted request was used for this experiment.

The installed `@supabase/supabase-js` excludes `__InternalSupabase` from schema selection but uses its version for client options; without it, typing defaults to PostgREST 12. Installed postgrest-js uses 13/14 detection for `maxAffected` and spread-on-many type capabilities. Thus globally ignoring this metadata would be wrong. Current app usage has neither of those features; its nested relationship selection and RPC calls remain supported by identical public schema types.

Full TypeScript checks against the clean approved-source checkout pass with both baseline and hosted types (0 diagnostics each). The hosted substitution existed only in the compiler's in-memory file reader: no application source or baseline was changed and no JS was emitted. Existing inserts/updates, relationship inference and RPC typing compile in both modes. Type-only differences do not change current runtime requests.

## Proposed correction, not implemented

Keep exact comparison of all public database shapes, Relationships and Functions. Normalize only redundant AST parentheses in the five reviewed helper constraints. Treat the exact `Database.__InternalSupabase.PostgrestVersion` shape/value as a separately validated generator capability contract, with an explicit allowed expected hosted version and rejection of unknown fields, invalid values or version changes. Preserve it in evidence; do not quietly replace the application baseline or call all metadata differences harmless.

The current change adds path-level diagnostics only. It does not accept this hosted artifact or authorize deployment. Review the proposed rule separately before another staging window.

## Validation and files

- 87 tests PASS: type comparator (including seven added diagnostics regressions), catalog comparator, POST contract and SQL identity.
- 93 credential tests PASS; no live credential requests.
- Two local generator experiments PASS; catalog unchanged.
- Clean-source TypeScript: baseline 0 errors, hosted substitution 0 errors.
- Node syntax and scoped whitespace checks PASS.

Source changes: this document, `scripts/staging/typeComparison.mjs`, `scripts/staging/typeComparison.test.mjs`. Diagnostic scripts/results live only under ignored `output/hosted-type-forensics/` (three-way report, reproduction, compilation, catalog comparison and logs).

Read-only final safety checks: production and Our Adventures ACTIVE_HEALTHY; staging INACTIVE/PAUSED, last verified exact 32 preserved; staging Vercel hold `exit 0`; protected production Vercel settings unchanged. No hosted mutation, deployment, OAuth change, email, invitation, commit or push. No application source changes or unrelated-file edits.
