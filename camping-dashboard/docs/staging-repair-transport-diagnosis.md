# Guarded repair dry-run transport diagnosis

This is local tooling work. It does not authorize a hosted retry. Our Adventures must not be paused and staging must not be resumed for diagnosis.

## Historical evidence

The saved active-window checkpoint and `DryRun/before-catalog.json` establish that fresh identity, exact 31 history, byte integrity, catalog authorization and the expected three-function ACL preconditions passed. The pre-repair fingerprint was `910e5310fd9b21f2c0b7ed49eff4ac39`. No apply was invoked.

The wrapper exited 1 with `REPAIR_DRY_RUN_FAILED`. The original transport discarded the child exit status/output and the contract replaced either a CLI or parser error with that single code. Neither child operation, timeout status, output lengths nor underlying error survived. **The exact historical cause cannot be reconstructed.** A new local reproduction is separate evidence, not retrospective proof of a hosted error.

## Invocation audit

Entry: `repair-31-to-32.mjs STAGING_REPAIR_31_TO_32 --dry-run` → `runRepair` authorization → shared `runRepairDryRun`.

| Operation | Non-secret command |
|---|---|
| Migration list | `node <CLI 2.109.1 entry> migration list --db-url <redacted> --workdir <owned temporary project>` |
| Dry-run | `node <CLI 2.109.1 entry> db push --dry-run --db-url <redacted> --workdir <owned temporary project>` |

Node `spawnSync`, argument array (no shell), ignored stdin, captured stdout/stderr, 120,000 ms timeout, expected exit code 0. Process cwd is inherited; `--workdir` selects a fresh minimal project containing only config and the verified 32 migration files. No linked ref, roles or seed files. Paths containing spaces are single arguments, not shell-quoted strings. Database URL/password and root certificate URL parameters remain memory-only command inputs; they are never diagnostics.

Inherited environment is limited to PATH/SystemRoot/WINDIR/TEMP/TMP/HOME/USERPROFILE/APPDATA/LOCALAPPDATA (case-insensitive). Hosted TLS adds `PGSSLMODE=verify-full`, `PGSSLROOTCERT=<reviewed certificate>` and the existing certificate parameters in the validated URL. Ambient PG variables and unrelated credentials are excluded. No CLI version upgrade or TLS-policy change.

CLI 2.109.1 installed help explicitly supports both `--dry-run` and explicit `--db-url`; no additional dry-run flag is required. Warnings on stderr do not fail an exit-0 operation. Output is still treated as an untrusted format, not a stable API: exact local32/remote31 lists and exactly one pending filename are mandatory. Empty/new remote history is a mismatch for this repair, never an invitation to replay all migrations.

## Safe diagnostics

`cli-diagnostics.json` records operation, last completed stage, child exit code, timeout boolean, stdout/stderr lengths, parser result, recognized SQLSTATE classes and canonical error messages. It contains no raw output, DB URI, password, PAT, API key, connection string, query parameters or arbitrary provider prose. This uses an allowlist rather than assuming regex replacement can catch every unlabeled secret.

Codes distinguish CLI missing/version/start errors; migration-list execution/parse/history mismatch; dry-run execution/parse/pending mismatch; connection/TLS/authentication; timeout/unknown failures. The contract preserves only this fixed code allowlist. Unknown errors still collapse to a safe generic failure. Authorization, catalog and apply rules are unchanged.

Table/JSON parsing is separate from process execution. LF, CRLF, no final newline, spacing and warning prefixes are covered. A malformed response is a parser failure; a well-formed wrong history remains a guard failure. Successful stderr warnings are counted, not mistaken for nonzero exit.

## Difference from the earlier simulation

The earlier simulator used `--local`, full config and the ambient environment. The hosted path used `--db-url`, minimal config, filtered environment and verify-full TLS. They were not the same process transport.

The simulator now calls the same read-only process runner as hosted code, using explicit loopback DB URL, minimal temporary project and filtered environment. It checks a before/after database snapshot and apply counter around dry-run, then performs the already-authorized **disposable** 31→32 apply and rejects repetition. Control-plane evidence remains synthetic. The fixed local database has SSL disabled: local execution uses `sslmode=disable`/`PGSSLMODE=disable`; it does not prove hosted TLS acceptance. Hosted verify-full settings remain mandatory and separately covered by existing TLS contract tests.

Historical checkout pins remain unchanged: exact first31 CRLF migration bytes, migration32 LF, and the ordered manifest. Validation uses a clean Git checkout with the candidate tooling overlay because the original workspace contains legacy materialized bytes. No `.gitattributes` or migration file is changed. The application checks raw hashes before CLI invocation. CLI history comparison uses versions; the real disposable replay tests whether those pinned files list correctly. Do not infer hosted line-ending causality without evidence.

## Next active gate (do not execute here)

Fresh Our Adventures baselines + manual `IMAGE_8_OF_8_PASS` → approved swap → fresh A/B/exact31 authorization → shared dry-run. On any failure save sanitized diagnostics and restore immediately; no blind retry. Only a PASS permits the existing guarded one-shot apply, strict final32 catalog/probes/types, then separately authorized staging deployment. Screenshots remain optional. Paused staging cannot provide a meaningful DB transport reproduction; do not attempt a connection while it is paused.

## Reproduced defect and fix

The first shared-transport replay reproduced a successful migration-list process rejected by the parser: exit 0, stdout length 2181, stderr length 32, `REPAIR_MIGRATION_LIST_PARSE_FAILED`. The CLI text table encloses versions in backticks, and represents the empty remote cell as a backtick-quoted space. The old bare-digit regular expression matched no rows.

Read-only local comparison, all four exit codes 0:

| Environment | `--local` | explicit `--db-url` |
|---|---|---|
| Ambient | JSON | JSON |
| Hosted-style filtered | Backtick table | Backtick table |

Thus environment filtering changes the installed CLI's output format in this context. The prior JSON simulation bypassed the defective text-table parser. This is a demonstrated defect in the same path and a strong explanation for the hosted symptom; the missing historical child output prevents claiming retrospective certainty.

The parser now accepts balanced backtick cells as well as bare cells, strictly validates each version, and still requires exact local32/remote31 and only migration32 pending. An unbalanced quote, changed version, extra migration or malformed response fails closed. No environment variables were reintroduced to force a preferred output format.

After correction, the standalone shared dry-run had exit 0 for list and dry-run, exactly `20260912215252` pending and no apply. Dry-run emitted 27 characters on stdout and 511 on stderr while succeeding, confirming stderr alone cannot be treated as failure.

## Validation (2026-09-13 UTC)

- Focused transport suite: 25 passed, including real text-table syntax, redaction, process failures, parser failures, warnings, LF/CRLF and environment filtering.
- Aggregate `validate-local.mjs --reset-disposable`: exit 0 from a clean pinned checkout with candidate tooling overlaid and the existing lockfile dependencies available.
- 276 staging/repair tests passed (includes the 25 transport tests); 378 SQL assertions; seven concurrency checks; 93 credential tests with no live requests.
- Shared real CLI dry-run: list PASS, dry-run PASS, only `20260912215252` pending, apply count zero and identical before/after snapshot.
- Disposable repair simulation: exactly one migration applied locally; repeat refused. Final32, repaired ACLs, all eight schema checks, fingerprint `b3e3c93d5de2a53b9e7a4afae89d9ada`, normalized and structural types PASS.
- All 32 migration byte pins and ordering PASS; first31 CRLF, migration32 LF. No attributes or migration edits.
- Six changed/new JavaScript modules pass syntax checks; staging PowerShell scripts/modules parse without errors; diff/new-file whitespace PASS.
- All 23 unrelated preservation-baseline files retain their hashes.

Only read-only hosted project metadata was inspected: production and Our Adventures ACTIVE_HEALTHY; staging INACTIVE. Staging's 31-migration state and unapplied32 remain last verified by the aborted window. No hosted DB connection, pause/resume, migration, Vercel change, deployment, email, invitation, commit or push in this task.

Recommendation: **READY FOR ONE-SHOT REPAIR RETEST**, after separate approval of these uncommitted tooling changes. This is readiness for a gated retest, not proof that hosted TLS/connectivity or the complete future deployment will pass. Historical underlying output remains unrecoverable.
