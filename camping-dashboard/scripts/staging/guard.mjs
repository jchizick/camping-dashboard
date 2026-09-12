import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const SHA = '03ebd55e09159ee4f8cd0678dd3f45fdf8fdbbdb';
export const PROTECTED = ['gdsmyxzqtmhwbcyobzou', 'rmfhueseulevyvetblnn'];
export function validateTarget(ref, connection) {
  if (!/^[a-z]{20}$/.test(ref ?? '') || PROTECTED.includes(ref)) throw new Error('Rejected project identity');
  let url;
  try { url = new URL(connection); } catch { throw new Error('Invalid database connection'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres'
      || url.hash || !url.password) throw new Error('Invalid database connection');
  if ([...url.searchParams.keys()].some(key => key !== 'sslmode')
      || url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'verify-full') throw new Error('Require TLS verify-full and no connection overrides');
  const user = decodeURIComponent(url.username);
  const direct = url.hostname === `db.${ref}.supabase.co` && user === 'postgres' && (!url.port || url.port === '5432');
  const pooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
    && user === `postgres.${ref}` && url.port === '5432';
  if (!direct && !pooler) throw new Error('Database host/user does not identify expected staging project');
  return { ref, host: url.hostname, mode: direct ? 'direct' : 'session-pooler' };
}
export function validateHistory(actual, expected) {
  if (!Array.isArray(actual) || actual.length > expected.length || actual.some((v, i) => v !== expected[i])) {
    throw new Error('Remote history is not an exact prefix of approved migrations');
  }
}
export function verifyManifest(root, manifest) {
  if (manifest.sha !== SHA || manifest.migrations.length !== 32) throw new Error('Wrong approved manifest');
  const dir = join(root, 'supabase', 'migrations');
  const names = readdirSync(dir).filter(n => n.endsWith('.sql')).sort();
  if (names.length !== 32 || !names.at(-1).startsWith('20260912215252_')) throw new Error('Unexpected migration inventory');
  for (let i = 0; i < names.length; i++) {
    const actual = createHash('sha256').update(readFileSync(join(dir, names[i]))).digest('hex');
    if (manifest.migrations[i].name !== names[i] || manifest.migrations[i].sha256 !== actual) throw new Error('Migration manifest mismatch');
  }
  return names.map(n => n.slice(0, 14));
}
