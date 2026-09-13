# Hosted type and PostgREST capability gate

Status: candidate for review; no hosted execution authorized by this document.

## Acceptance

Final `HOSTED_TYPE_GATE_PASS` requires `TYPE_STRUCTURE_EQUIVALENT` plus `POSTGREST_CAPABILITY_PASS`. Exact 32-migration history, independent A/B project identity and strict catalog `b3e3c93d5de2a53b9e7a4afae89d9ada` remain mandatory prerequisites. Capability evidence never substitutes for catalog authorization.

Structural comparison is unchanged. Only the constraint ASTs at `Tables.typeParameters.TableName.constraint`, `TablesInsert.typeParameters.TableName.constraint`, `TablesUpdate.typeParameters.TableName.constraint`, `Enums.typeParameters.EnumName.constraint`, and `CompositeTypes.typeParameters.CompositeTypeName.constraint` ignore redundant ParenthesizedType wrappers. Operand/node structure and precedence remain; `(A | B)[]` still differs from `A | B[]`. Alias bodies, defaults, other constraints, tables, columns, nullability, Relationships, RPCs, views, enums and composites remain strict.

## Installed dependency contract

The committed lockfile and installed packages agree:

| Dependency | Exact version | Role |
| --- | --- | --- |
| @supabase/supabase-js | 2.98.0 | Database metadata inference and public client |
| @supabase/postgrest-js | 2.98.0 | Query builder, select parser, version feature flags |
| @supabase/ssr | 0.9.0 | Passes Database/schema generics to SupabaseClient; no separate version gate |
| @supabase/auth-js, functions-js, realtime-js, storage-js | 2.98.0 each | No PostgrestVersion-dependent capability gate |
| TypeScript | 5.9.3 | Compiler used for compatibility proof |
| Supabase CLI | 2.109.1 | Previously generated preserved public types; not run by these tests |

There is no separate generated-database-type package. Application types live in `src/types/supabase.ts`. This audit uses installed package source and distributed declarations, not upstream master. Before hosted comparison, `verifyInstalledClient` requires both lockfile and installed versions of the three client/type entry packages to equal this reviewed contract. Any client dependency upgrade requires a fresh audit.

## Complete version-dependent type inventory

Paths below are relative to the installed package. Both ESM/CJS declaration bundles contain the same conditions.

| Capability or plumbing | Actual condition | Effect |
| --- | --- | --- |
| supabase-js `src/SupabaseClient.ts` | Database has `__InternalSupabase.PostgrestVersion`; otherwise default literal `12`; explicit client-options generic can override | Supplies ClientOptions to PostgrestClient; excludes metadata from selectable schema keys. No runtime server-version check. |
| supabase-js `src/index.ts` | Schema-or-client-options generic | Forwards client typing; no numeric threshold. |
| supabase-js `src/lib/rest/types/common/common.ts`; postgrest-js `src/types/common/common.ts` | Optional string PostgrestVersion | Type declaration plumbing only. |
| postgrest-js `src/types/feature-flags.ts` | IsPostgrest13 is literal prefix `13${string}`; IsPostgrest14 is `14${string}`; GreaterThan12 is their OR | Sole version classifier. Despite its name, this is not numeric greater-than: 15 does not pass. |
| postgrest-js `src/PostgrestTransformBuilder.ts` | MaxAffectedEnabled uses that OR; method must also be PATCH, DELETE or RPC | Eligible methods return the builder; otherwise InvalidMethodError. At runtime the method appends `Prefer: handling=strict` and `max-affected=N`, without branching on metadata. |
| postgrest-js `src/select-query-parser/result.ts` | SpreadOnManyEnabled uses that same OR when the related result is an array | Enabled: correlated arrays for to-many spread. Disabled: SelectQueryError. To-one spread and normal nested selects are not gated. No runtime metadata branch. |

Recursive source search across installed Supabase packages and the distributed declarations found no additional PostgrestVersion/semver-dependent client capability. The durable test pins the complete seven-file source inventory for the three relevant entry packages and compiles both the installed flags and public SDK inference.

## Compatibility model: major-compatible, reviewed 14 family only

The exact `14.5` pin was rejected after a fresh artifact reported `14.17` while database structure, history, ACLs and catalog all passed. These are two-component observed PostgREST release strings, not necessarily semver patch components; the acceptance decision does not depend on their release naming.

Both installed feature flags classify every `14...` string identically. Compiler assertions also prove the generic `14.${number}` / `14.${number}.${number}` families enable both flags. Therefore the gate accepts strictly parsed 14.x versions under the locked client contract, not because of an assumed semver guarantee.

Required hosted shape remains exactly one required, unmodified `__InternalSupabase` property with exactly one required, unmodified `PostgrestVersion` string-literal property. Extra, duplicate, optional or malformed metadata fails.

Version syntax is canonical unsigned `major.minor` (the observed generator form), or `major.minor.patch`; a two-part version corresponds to patch zero for syntax purposes. Components must be safe integers without leading zeroes. No whitespace, coercion, bare major, prefix, prerelease or build suffix is accepted. Major must be exactly 14.

Evidence records `actual` (the complete observed string), `profile: postgrest-14-compatible`, `{maxAffected:true, spreadOnMany:true}`, expected profile and audited client versions. Local metadata absence remains `LOCAL_CAPABILITY_METADATA_NOT_APPLICABLE` and cannot satisfy the hosted gate. Present baseline metadata must independently pass the same contract.

13.x enables both installed flags, but remains an unreviewed server downgrade and is rejected. 12.x disables them. 15.x currently disables them and is rejected, as are all future/other majors (including misleading prefixes such as 140.x). Prereleases are not assumed compatible. Failures include POSTGREST_METADATA_MISSING, POSTGREST_VERSION_INVALID, POSTGREST_VERSION_UNSUPPORTED and POSTGREST_CLIENT_REVIEW_REQUIRED, alongside unchanged structural failures.

This proves client TypeScript capability equivalence, not universal server-runtime correctness for every future 14.x release. Each live window still requires fresh identity/catalog/history/type evidence and the authorized runtime smoke. Future client upgrades require re-auditing all version branches and public declaration inference; new server families require explicit review even if flags happen to coincide.

## Evidence and reproducible validation

No type regeneration, database connection or application source edit is needed for this suite:

`node --test scripts/staging/hostedTypeGate.test.mjs scripts/staging/postgrestCapabilities.test.mjs scripts/staging/typeComparison.test.mjs scripts/staging/catalogComparison.test.mjs scripts/staging/postMigrationContract.test.mjs scripts/staging/sqlIdentity.test.mjs`

The installed-client tests are compiler-only in-memory fixtures. They cover omitted metadata/default 12, 12.99, 13.0, 13.99, 14.0, 14.5, 14.17, 14.17.0, 14.999 and 15.0. They assert PATCH/DELETE/RPC maxAffected success/error types, GET method rejection, to-many spread success/error shape, unchanged nested/to-one selects and inserts, and strict invalid-column/RPC-argument rejection. No fixture is executed and no network request is made.

Field Protocol currently uses neither maxAffected nor spread selects, and has no version-dependent application type assertion/snapshot. Its actual queries are additionally checked by full application TypeScript using two in-memory Database fixtures identical except for 14.5 versus 14.17. The approved application checkout and existing compiler configuration are used; no emission or application types overwrite.

Preserved review artifacts, not test dependencies:

| Version | SHA-256 | Result |
| --- | --- | --- |
| 14.5 | b00ae076a0ae03aa6fc4415340f5eb3b6ac7cd4953091cee010c29c4efd17b51 | Structure, five constraints, capability profile and final hosted gate PASS |
| 14.17 | 43923592af14b186f82f0c58ecaaa54a617d518dac8d27dbb47e0c118d618c59 | Same PASS results; observed version retained |

The prior six-path diagnosis and why migration 32 was not causal remain documented in [staging-hosted-type-diagnosis.md](staging-hosted-type-diagnosis.md). New local review evidence is ignored under `output/postgrest-capability-review/`; no such evidence is required by the committed tests.

This candidate's validation: 201 focused tests PASS (69 hosted-gate, 45 installed-client/format/boundary, 87 existing structural/catalog/identity tests); 93 credential tests PASS without live requests; full approved application TypeScript 0 errors for each metadata fixture (292 files each). Both preserved artifacts pass without regeneration. The ignored deployment decision helper passes 15 local tests. Syntax, scoped secret/path and whitespace checks pass.

## Deployment boundary

`normalizedEquivalent` remains informational only. Operational wrappers must require independent fresh catalog PASS, structure PASS and the reviewed capability profile/final verdict; they must not compare the observed version to one fixed release string. The existing ignored final-window helper is updated and locally tested after durable validation. It is not committed or executed against hosted services by this task. Historical evidence never authorizes a new deployment.

No migration, catalog, application, auth, configuration or deployment behavior is changed. No commit, push, hosted mutation, email or invitation QA is authorized by this candidate.
