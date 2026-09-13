# Narrow hosted type gate

Status: READY FOR REVIEW. Local tooling only; no active staging operation.

## Acceptance

`migrate.mjs verify` preserves the raw hosted artifact before invoking `compareHostedTypes`. Final `HOSTED_TYPE_GATE_PASS` requires both `TYPE_STRUCTURE_EQUIVALENT` and `POSTGREST_CAPABILITY_PASS`. The pre-existing exact history, identity and catalog checks remain prerequisites and are unchanged.

The five reviewed aliases/parameters are Tables.TableName, TablesInsert.TableName, TablesUpdate.TableName, Enums.EnumName and CompositeTypes.CompositeTypeName. Only their constraint expressions are represented as semantic AST trees. ParenthesizedType wrapper nodes are omitted within those expressions; node kinds, operands, identifiers, operators, literal values and child ordering remain. This preserves precedence: `(A | B)[]` differs from `A | B[]`. Changed branches, unions, keyof targets, identifiers, defaults, alias bodies and other generic constraints remain unequal. There is no whole-file parenthesis stripping.

Capability metadata is captured before removing its container from structural comparison. Hosted requires exactly one required, unmodified `__InternalSupabase` property containing exactly one required `PostgrestVersion` string-literal property. Value is pinned to **14.5**, not a version range. Unknown fields, duplicate/optional properties, non-literal types and malformed values fail. Valid but different versions fail separately. The baseline may omit metadata or carry the same validated pin; invalid baseline metadata also blocks acceptance.

Local `compareTypes` remains conservative and reports `LOCAL_CAPABILITY_METADATA_NOT_APPLICABLE`. Local absence does not satisfy `compareHostedTypes`. No metadata is silently discarded: baseline and hosted capability verdicts are retained, alongside exact-path differences and all five constraint results.

Failure taxonomy includes TYPE_STRUCTURE_DIFFERENCE, TYPE_CONSTRAINT_DIFFERENCE, POSTGREST_METADATA_MISSING, POSTGREST_VERSION_INVALID and POSTGREST_VERSION_MISMATCH. Syntax/duplicate-path errors fail closed. Structural diagnostics retain expected/actual values, category, and database-contract versus capability-metadata scope.

## Real evidence and validation

Preserved hosted SHA-256 remains `b00ae076a0ae03aa6fc4415340f5eb3b6ac7cd4953091cee010c29c4efd17b51`. No hosted regeneration or original evidence overwrite occurred.

- Preserved real artifact: TYPE_STRUCTURE_EQUIVALENT; five constraint checks PASS; POSTGREST_CAPABILITY_PASS (14.5); HOSTED_TYPE_GATE_PASS.
- Approved baseline vs preserved fresh local 32: PASS; local capability NOT_APPLICABLE.
- 137 focused tests PASS: 50 hosted gate regressions plus existing type/catalog/POST/identity tests.
- 93 credential tests PASS, no live credential requests.
- Clean approved-source TypeScript compilation with baseline and hosted in-memory substitution: zero diagnostics each. No application type file changed; no emission.
- Syntax, scoped secret/path review and whitespace checks PASS.

New local results are under ignored `output/hosted-type-forensics/`: corrected-gate.json, gate-tests.log, gate-credentials.log and compilation.json. Historical diagnosis remains in staging-hosted-type-diagnosis.md; its statement that acceptance is unchanged describes that earlier diagnosis pass, not this correction.

## Future window

After review and commit/push, staging must resume in exact final POST_MIGRATION state: **32 migrations**, final 20260912215252. Do not rerun the 31-to-32 repair. Require fresh A/B identity, strict catalog `b3e3c93d5de2a53b9e7a4afae89d9ada`, and fresh preserved hosted types passing both contracts before any hold release/deployment.

Raw `normalizedEquivalent` remains an informational formatting comparison and may be false on a successful hosted gate. Old ignored active-window wrappers that require it to be true must be prepared/reviewed for the new explicit structure/capability/final verdicts before another window; this task does not modify or execute those operational wrappers. No on-disk historical PASS is fresh deployment authorization.

Then deploy the separately approved source, prove runtime isolation, perform the limited smoke, reinstate hold, pause staging, and restore Our Adventures with backend and manual 8/8 image checks. No database mutation is required. Real invitation QA remains separately authorized.

## Scope

This pass adds scripts/staging/hostedTypeGate.mjs and hostedTypeGate.test.mjs, updates typeComparison.mjs and migrate.mjs, and adds this document. Previous uncommitted diagnosis tooling/docs/tests are retained. No catalog, migration, application, auth or hosted configuration changes. No commit/push/deployment/email/invitation.
