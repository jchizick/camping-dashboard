// FUTURE hosted execution only. This preparation phase does not invoke this entry point.
// Credentials are read from the environment, never written to an evidence artifact.
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdirSync,mkdtempSync } from 'node:fs';
import { resolve,join,isAbsolute } from 'node:path';
import {tmpdir} from 'node:os';
import {SOURCE_ROOT} from './paths.mjs';
import { fileURLToPath } from 'node:url';
import { validateTarget, verifyManifest } from './guard.mjs';
import { requireFreshGate, checkCertificate, migrationTls } from './sqlProbe.mjs';
import {authorizeMigrationAction} from './postMigrationContract.mjs';
import {hash} from './typeComparison.mjs';
import {compareHostedTypes} from './hostedTypeGate.mjs';

const action = process.argv[2];
// Target is 32; hosted staging remains at 31. No repair action is enabled here.
// Reject legacy plan/apply before credentials or I/O.
authorizeMigrationAction(action);
const root = resolve(process.env.STAGING_SOURCE_DIR ?? SOURCE_ROOT);
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('./migrations.json', import.meta.url)), 'utf8'));
const versions = verifyManifest(root, manifest);
const baseline=readFileSync(resolve(root,'src/types/supabase.ts'),'utf8');
if(hash(baseline)!=='5a0fa3f14e7305abd2caa9e0862a2e3f9048f01c60f08cb7e29e9ca7460e7e61')
  throw new Error('APPROVED_TYPE_BASELINE_MISMATCH');
const ref = process.env.STAGING_REF;
const db = process.env.STAGING_DATABASE_URL;
const identity = validateTarget(ref, db);
// Fail closed before ANY remote request/list/dry-run unless both psql probes
// passed in this active window. Historical CLI success is not sufficient.
let sqlGate;
try { sqlGate = JSON.parse(readFileSync(process.env.STAGING_SQL_GATE, 'utf8')); }
catch { throw new Error('Both current psql probes are required before migration tooling'); }
requireFreshGate(sqlGate, ref, manifest.sha, identity.host);
const cert = process.env.STAGING_SSL_ROOT_CERT;
checkCertificate(cert);
const migrationConnection = migrationTls(db, cert);
// Positive project identity check via management API before even the dry run.
const access = process.env.SUPABASE_ACCESS_TOKEN;
if (!access) throw new Error('Management access required for project identity verification');
async function verifyProject() {
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
  headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(15000),
});
if (!res.ok) throw new Error('Project identity lookup failed');
const project = await res.json();
if (project.id !== ref || project.name !== 'field-protocol-staging' || project.status !== 'ACTIVE_HEALTHY'
    || project.organization_id !== 'qvhhhjlpntbtctqinayz' || project.database?.host !== `db.${ref}.supabase.co`) {
  throw new Error('Management identity is not the approved staging project');
}
}
await verifyProject();
console.log(JSON.stringify(identity));
const cli = resolve(process.env.STAGING_CLI_PATH ?? 'node_modules/supabase/dist/supabase.js');
function run(args) {
  try { return execFileSync(process.execPath, [cli, ...args], { cwd: root, env:migrationConnection.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 }); }
  catch { throw new Error('CLI failed; raw output suppressed to protect credentials. Stop and restore availability.'); }
}
async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method:'POST', headers:{Authorization:`Bearer ${access}`, 'Content-Type':'application/json'},
    body:JSON.stringify({query:sql, read_only:true}), signal:AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Read-only verification failed');
  return response.json();
}
const history = async () => {
  const exists = await query("select to_regclass('supabase_migrations.schema_migrations') is not null as present");
  if (!Array.isArray(exists) || exists.length !== 1 || typeof exists[0].present !== 'boolean') throw new Error('Invalid history existence response');
  if (!exists[0].present) return [];
  const result = await query("select version from supabase_migrations.schema_migrations order by version");
  if (!Array.isArray(result)) throw new Error('Invalid migration history response');
  return result.map(r => r.version);
};
authorizeMigrationAction(action,versions);
if (JSON.stringify(await history()) !== JSON.stringify(versions)) throw new Error('Final migration history does not exactly match expected 32 migrations');
const rows = await query(readFileSync(fileURLToPath(new URL('./verify.sql', import.meta.url)), 'utf8'));
if (!Array.isArray(rows) || rows.length === 0 || rows.some(r => r.passed !== true)) throw new Error('Schema/grant verification failed');
const cliVersion=run(['--version']).trim();
if(cliVersion!=='2.109.1') throw new Error('CLI_VERSION_MISMATCH');
const generated = run(['gen','types','--project-id',ref,'--lang','typescript','--schema','public']);
// Preserve exact stdout before parsing/comparison. Schema definitions only, never credentials.
if(process.env.STAGING_EVIDENCE_DIR&&!isAbsolute(process.env.STAGING_EVIDENCE_DIR))throw new Error('ABSOLUTE_EVIDENCE_DIR_REQUIRED');
const evidence=process.env.STAGING_EVIDENCE_DIR??mkdtempSync(join(tmpdir(),'fp-hosted-types-'));
mkdirSync(evidence,{recursive:true});
writeFileSync(resolve(evidence,'staging-generated.ts'),generated);
writeFileSync(resolve(evidence,'approved-baseline.ts'),baseline);
const normalize=text=>text.replace(/\r\n/g,'\n').replace(/^\/\/ This file is generated[^]*?\n\n/,'').trim();
const normalizedEquivalent=normalize(baseline)===normalize(generated);
const metadata={source:manifest.sha,ref,cliVersion,schema:'public',
  command:['gen','types','--project-id',ref,'--lang','typescript','--schema','public'],
  expectedSha256:hash(baseline),actualSha256:hash(generated),normalizedEquivalent};
let comparison;
try {comparison=compareHostedTypes(baseline,generated);}
catch {writeFileSync(resolve(evidence,'comparison.json'),JSON.stringify({...metadata,typeVerdict:'TYPE_COMPARISON_ERROR'},null,2));throw new Error('TYPE_COMPARISON_ERROR');}
writeFileSync(resolve(evidence,'comparison.json'),JSON.stringify({...metadata,...comparison},null,2));
if (!comparison.equivalent) throw new Error(comparison.typeVerdict);
console.log('PASS: exact history, schema/grants and generated public types');
