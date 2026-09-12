// Preparation only: importing this module never connects to a database.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { createConnection } from 'node:net';
import { validateTarget } from './guard.mjs';
import { IDENTITY_SQL, IDENTITY_VERSION, sqlEvidence, validIdentityEvidence } from './sqlIdentity.mjs';

export const REF = 'mgnkvfohpqixgacszovv';
export const SQL = IDENTITY_SQL;
const fail = code => { throw new Error(code); };
export function classify(error) {
  if (error.code === 'ETIMEDOUT') return 'POOLER_CONNECT_TIMEOUT';
  const detail = String(error.stderr ?? ''); // Never return or persist this text.
  for (const [pattern, code] of [
    [/does not match host|hostname mismatch/i, 'SSL_HOSTNAME_FAILED'],
    [/certificate verify failed|certificate verification failed|self.signed certificate|root certificate/i, 'SSL_VERIFY_FAILED'],
    [/tenant or user not found|tenant not found/i, 'POOLER_TENANT_NOT_FOUND'],
    [/network.*banned|IP.*banned|temporarily banned/i, 'POOLER_NETWORK_BANNED'],
    [/password authentication failed|authentication failed/i, 'POOLER_AUTH_FAILED'],
    [/could not translate host|name or service not known/i, 'POOLER_DNS_FAILED'],
    [/timeout expired|connection timed out/i, 'POOLER_CONNECT_TIMEOUT'],
    [/connection refused|network is unreachable/i, 'POOLER_TCP_FAILED'],
    [/ERROR:|FATAL:.*permission denied/i, 'SQL_SESSION_FAILED'],
  ]) if (pattern.test(detail)) return code;
  return 'POOLER_CONNECTIVITY_UNKNOWN';
}
export function checkCertificate(path, read = readFileSync) {
  if (!path) fail('SSL_ROOT_CERT_MISSING');
  if (!isAbsolute(path) || /[\r\n\0]/.test(path)) fail('SSL_ROOT_CERT_UNREADABLE');
  let pem;
  try { pem = read(path, 'utf8'); } catch (e) {
    fail(e.code === 'ENOENT' ? 'SSL_ROOT_CERT_MISSING' : 'SSL_ROOT_CERT_UNREADABLE');
  }
  try {
    const certificates = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (!certificates?.length) throw new Error();
    for (const certificate of certificates) {
      const parsed = new X509Certificate(certificate);
      if (Date.parse(parsed.validTo) <= Date.now() || Date.parse(parsed.validFrom) > Date.now()) throw new Error();
    }
  } catch { fail('SSL_ROOT_CERT_UNREADABLE'); }
}
export function withRootCertificate(uri, cert) {
  validateTarget(REF, uri);
  if (!cert) fail('SSL_ROOT_CERT_MISSING');
  if (!isAbsolute(cert) || /[\r\n\0]/.test(cert)) fail('SSL_ROOT_CERT_UNREADABLE');
  // libpq URI query decoding does not treat '+' as a space. Keep %20, and
  // preserve the original percent-encoded password without reserialization.
  return uri+'&sslrootcert='+encodeURIComponent(cert);
}
export function migrationTls(uri, cert, baseEnv = process.env) {
  const dbUrl = withRootCertificate(uri, cert);
  const env = Object.fromEntries(Object.entries(baseEnv).filter(([key])=>!/^PG/i.test(key)));
  // CLI 2.109.1 Go ConnectByConfig rebuilds its URL without TLS parameters;
  // pgconn reparses these environment settings at the second connection parse.
  Object.assign(env,{PGSSLMODE:'verify-full',PGSSLROOTCERT:cert});
  return {dbUrl,env};
}
export function checkClient(binary, exec = execFileSync) {
  let version;
  try { version = exec(binary, ['--version'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore','pipe','pipe'] }); }
  catch (e) { fail(e.code === 'ENOENT' ? 'PSQL_NOT_FOUND' : 'PSQL_VERSION_UNSUPPORTED'); }
  // Prepared and reviewed for PostgreSQL 17/18 (including \getenv support).
  if (!/psql \(PostgreSQL\) (17|18)\./.test(version)) fail('PSQL_VERSION_UNSUPPORTED');
}
export async function checkNetwork(host) {
  try { await Promise.race([lookup(host), new Promise((_, reject) => { const t=setTimeout(reject, 8000); t.unref(); })]); }
  catch { fail('POOLER_DNS_FAILED'); }
  await new Promise((resolve, reject) => {
    const socket = createConnection({host, port:5432});
    const finish = code => { socket.destroy(); code ? reject(new Error(code)) : resolve(); };
    socket.setTimeout(8000, () => finish('POOLER_CONNECT_TIMEOUT'));
    socket.once('error', () => finish('POOLER_TCP_FAILED'));
    socket.once('connect', () => finish());
  });
}
export function invocation(uri, password, cert, mode, baseEnv = process.env) {
  const identity = validateTarget(REF, uri);
  if (identity.mode !== 'session-pooler') fail('SQL_TARGET_MISMATCH');
  const parsed = new URL(uri);
  if (decodeURIComponent(parsed.password) !== password) fail('URI_CONSTRUCTION_FAILED');
  if (!['A','B'].includes(mode)) fail('SQL_TARGET_MISMATCH');
  // Whitelist OS runtime variables; inherit no PG service, passfile or logging overrides.
  const env = Object.fromEntries(Object.entries(baseEnv).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA)$/i.test(key)));
  Object.assign(env, {PGPASSWORD:password, PGSSLMODE:'verify-full', PGSSLROOTCERT:cert,
    PGCONNECT_TIMEOUT:'10', PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=10000',
    PGAPPNAME:'staging-read-only-probe', LC_ALL:'C', LANG:'C'});
  const args = ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',identity.host,'-p','5432','-U',`postgres.${REF}`,'-d','postgres'];
  // B starts with the proven parameterized connection, then reconnects using the
  // actual encoded URI via psql's environment variable substitution. No URI in argv,
  // SQL literals, history, or files. Noninteractive -X, no echo, captured output.
  if (mode === 'B') env.STAGING_PROBE_URI = withRootCertificate(uri,cert);
  const input = mode === 'A' ? SQL : '\\getenv probe_uri STAGING_PROBE_URI\n\\connect -reuse-previous=off :probe_uri\n'+SQL;
  return {args, options:{env,input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}};
}
export function parseIdentity(output) {
  const result=sqlEvidence(output);
  if(!result.passed) fail('STAGING_DATABASE_IDENTITY_MISMATCH');
  return result.systemId;
}
export function probe(binary, uri, password, cert, mode, exec = execFileSync, capture = () => {}) {
  const {args,options} = invocation(uri,password,cert,mode);
  let output;
  try { output = exec(binary,args,options); } catch(e) { fail(classify(e)); }
  // Preserve schema diagnostics before sqlEvidence can reject the catalog hash.
  capture(output);
  return sqlEvidence(output,decodeURIComponent(new URL(uri).username));
}
export function requireFreshGate(gate, ref, source, host, now = Date.now()) {
  const age = now-Date.parse(gate?.timestampUtc);
  if (ref !== REF || gate?.identityVersion !== IDENTITY_VERSION || !validIdentityEvidence(gate?.identityA) ||
      !validIdentityEvidence(gate?.identityB) || gate?.probesAgree!==true ||
      gate?.ready !== true || gate.probeA !== true || gate.probeB !== true ||
      gate.clusterIdentityMatch !== true || gate.readOnly !== true || gate.ref !== ref ||
      gate.source !== source || gate.host !== host || gate.port !== 5432 ||
      !Number.isFinite(age) || age < 0 || age > 600000) fail('FRESH_SQL_PROBES_REQUIRED');
}
