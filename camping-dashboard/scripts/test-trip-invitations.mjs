// Run only against the explicitly named disposable local Docker database.
// No environment credentials, hosted URLs, or production project are accepted.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const container = 'supabase_db_invitation-phase1-test';
const args = ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
const sql = (query) => execFileSync('docker', args, { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const actor = (n) => `select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000${n}","role":"authenticated"}',true);`;
const digest = (n) => `'${n.repeat(64)}'`;

sql('create extension if not exists pgtap with schema extensions;');
let assertions = 0;
for (const file of readdirSync('supabase/tests').filter((name) => name.endsWith('.sql')).sort()) {
  const output = sql(readFileSync(resolve('supabase/tests', file), 'utf8'));
  const failures = output.split('\n').filter((line) => /^(not ok|#)/.test(line));
  assert.equal(failures.length, 0, `${file}\n${failures.join('\n')}`);
  const count = output.split('\n').filter((line) => /^ok \d+/.test(line)).length;
  assert.ok(count > 0 && /(?:^|\n)1\.\.\d+/.test(output), `${file}: missing TAP result`);
  assertions += count;
  console.log(`${file}: ${count} passed`);
}
console.log(`SQL contracts: ${assertions} passed`);

// These fixtures must be committed so independent connections can see them.
// Delete only this script's exact synthetic trip/users in finally.
const trip = 'invitation-concurrency-fixture';
function clean() {
  sql(`begin; delete from public.trips where id='${trip}';
    delete from auth.users where id in ('00000000-0000-0000-0000-000000000981','00000000-0000-0000-0000-000000000982','00000000-0000-0000-0000-000000000983'); commit;`);
}
function setup() {
  clean();
  sql(`begin;
    insert into auth.users(id,email,email_confirmed_at) values
      ('00000000-0000-0000-0000-000000000981','race-owner@example.test',now()),
      ('00000000-0000-0000-0000-000000000982','race-invitee@example.test',now()),
      ('00000000-0000-0000-0000-000000000983','race-owner2@example.test',now());
    insert into public.trips(id,name) values ('${trip}','Synthetic concurrency fixture');
    insert into public.trip_members(trip_id,user_id,role) values
      ('${trip}','00000000-0000-0000-0000-000000000981','owner'),
      ('${trip}','00000000-0000-0000-0000-000000000983','owner');
    ${actor(981)}
    select app_private.create_trip_invitation('${trip}','race-invitee@example.test',${digest('a')}); commit;`);
}
function asyncSql(query) {
  return new Promise((resolveResult) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { error += chunk; });
    child.on('error', (failure) => resolveResult({ code: -1, output, error: failure.message }));
    child.on('close', (code) => resolveResult({ code, output, error }));
    child.stdin.end(query);
  });
}
async function race(first, second, isolation = '') {
  // Gate the first connection after it has made its uncommitted mutation.
  const a = asyncSql(`begin ${isolation}; set local application_name='invitation-test-first'; ${first} select pg_sleep(3); commit;`);
  let sleeping = false;
  for (let i = 0; i < 30; i++) {
    sleeping = sql("select exists(select 1 from pg_stat_activity where application_name='invitation-test-first' and wait_event='PgSleep');") === 't';
    if (sleeping) break;
    await delay(50);
  }
  if (!sleeping) {
    const result = await a;
    assert.fail(`First connection failed before gate: ${result.error}`);
  }
  const b = asyncSql(`begin ${isolation}; set local statement_timeout='10s'; ${second} commit;`);
  return Promise.all([a, b]);
}

try {
  const accept = `${actor(982)} select outcome from app_private.accept_trip_invitation(${digest('a')});`;
  const invitationId = `(select id from public.trip_invitations where trip_id='${trip}')`;
  const cases = [
    ['simultaneous acceptance', accept, 'already_accepted'],
    ['revoke versus accept', `${actor(981)} select app_private.revoke_trip_invitation('${trip}',${invitationId});`, 'revoked'],
    ['rotate versus accept', `${actor(981)} select app_private.rotate_trip_invitation('${trip}',${invitationId},${digest('b')});`, 'unavailable'],
    ['delete versus accept', `${actor(981)} select public.complete_trip_deletion('${trip}',public.begin_trip_deletion('${trip}'));`, 'unavailable'],
    ['inviter demotion versus accept', `update public.trip_members set role='viewer' where trip_id='${trip}' and user_id='00000000-0000-0000-0000-000000000981';`, 'unavailable'],
  ];
  for (const [label, mutation, expected] of cases) {
    setup();
    const [first, second] = await race(mutation, accept);
    assert.equal(first.code, 0, first.error);
    assert.equal(second.code, 0, second.error);
    assert.ok(second.output.split('\n').includes(expected), `${label}: ${second.output}`);
    const membershipCount = Number(sql(`select count(*) from public.trip_members where trip_id='${trip}' and user_id='00000000-0000-0000-0000-000000000982';`));
    assert.equal(membershipCount, label === 'simultaneous acceptance' ? 1 : 0);
    console.log(`Race PASS: ${label}`);
  }
  setup();
  const [first, second] = await race(
    `delete from public.trip_members where trip_id='${trip}' and user_id='00000000-0000-0000-0000-000000000981';`,
    `delete from public.trip_members where trip_id='${trip}' and user_id='00000000-0000-0000-0000-000000000983';`,
    'isolation level repeatable read',
  );
  assert.equal(first.code, 0, first.error);
  assert.notEqual(second.code, 0, 'Concurrent last owner deletion must fail');
  assert.match(second.error, /could not serialize access/);
  assert.equal(sql(`select count(*) from public.trip_members where trip_id='${trip}' and role='owner';`), '1');
  console.log('Race PASS: concurrent owner removals under repeatable read');
  setup();
  const [demotion, deletion] = await race(
    `update public.trip_members set role='viewer' where trip_id='${trip}' and user_id='00000000-0000-0000-0000-000000000981';`,
    `${actor(981)} select public.begin_trip_deletion('${trip}');`,
  );
  assert.equal(demotion.code, 0, demotion.error);
  assert.notEqual(deletion.code, 0, 'A demoted owner must not begin deletion after waiting');
  assert.match(deletion.error, /Only the trip owner/);
  assert.equal(sql(`select deletion_token is null from public.trips where id='${trip}';`), 't');
  console.log('Race PASS: deletion authorization rechecked after membership lock wait');
} finally {
  clean();
}
