// Fixed disposable local database only; no hosted credentials or target overrides.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
if(process.argv.length!==2)throw Error('NO_TARGET_OVERRIDES');
const args=['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const sql=query=>execFileSync('docker',args,{input:query,encoding:'utf8',stdio:'pipe',timeout:30000}).trim();
const uid=n=>`00000000-0000-0000-0000-000000000${n}`;
const mid=n=>`10000000-0000-0000-0000-000000000${n}`;
const trip='removal-boundary-fixture';
const call=(actor=831,target=832,targetTrip=trip,operation='remove_access')=>`public.trip_invitation_bridge('${uid(actor)}','${operation}','{"tripId":"${targetTrip}","membershipId":"${mid(target)}"}')`;
const check=(condition,label)=>`do $$begin if not (${condition}) then raise exception '${label}'; end if; end$$; select 'PASS:${label}';`;
const denied=(expression,code='42501')=>`do $$begin perform ${expression}; raise exception 'UNEXPECTED_ALLOW'; exception when sqlstate '${code}' then null; end$$;`;
const clean=()=>sql(`begin; delete from public.trips where id in ('${trip}','${trip}-other'); delete from auth.users where id in (${[831,832,833,834,835].map(n=>`'${uid(n)}'`).join(',')}); commit;`);
function setup(){
 clean();sql(`begin;
 insert into auth.users(id,email,email_confirmed_at) select ('00000000-0000-0000-0000-000000000'||n)::uuid,'boundary-'||n||'@example.test',now() from generate_series(831,835)n;
 insert into public.trips(id,name) values ('${trip}','Synthetic boundary'),('${trip}-other','Synthetic other trip');
 insert into public.trip_members(id,trip_id,user_id,role) values
 ('${mid(831)}','${trip}','${uid(831)}','owner'),('${mid(832)}','${trip}','${uid(832)}','viewer'),
 ('${mid(833)}','${trip}','${uid(833)}','editor'),('${mid(834)}','${trip}','${uid(834)}','owner'),
 ('${mid(835)}','${trip}-other','${uid(835)}','owner'),('${mid(836)}','${trip}-other','${uid(832)}','viewer'); commit;`);
}
const asyncSql=query=>new Promise(resolve=>{
 const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',error='';
 child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>error+=c);
 child.on('error',e=>resolve({code:-1,error:e.message,output}));child.on('close',code=>resolve({code,error,output}));child.stdin.end(query);
});
let passed=0;
try{
 setup();
 // ONE psql process/physical backend, multiple transactions and multiple bridge calls.
 const output=sql(`
 create temp table connection_proof as select pg_backend_pid() pid;
 set request.jwt.claims='{"role":"service_role"}'; set request.jwt.claim.sub='';
 begin; set local role service_role;
 select ${call()};
 ${check("auth.uid() is null and current_setting('request.jwt.claims')='{\"role\":\"service_role\"}'",'owner-success-restores-service-claims')}
 ${denied(call(832,833))}
 ${check('auth.uid() is null','same-transaction-viewer-cannot-inherit-owner')}
 commit;
 ${check("auth.uid() is null and current_setting('request.jwt.claim.sub')='' and current_setting('request.jwt.claims')='{\"role\":\"service_role\"}'",'claims-clear-at-commit')}
 begin; set local role service_role;
 ${denied(call(832,833))}
 ${check('auth.uid() is null','next-transaction-viewer-cannot-inherit-owner')}
 commit;
 ${check('(select pid=pg_backend_pid() from connection_proof)','same-physical-connection')}
 ${check(`exists(select 1 from public.trip_members where id='${mid(833)}')`,'denied-target-survives')}
 begin; set local role service_role; select ${call(831,833)}; rollback;
 ${check(`auth.uid() is null and exists(select 1 from public.trip_members where id='${mid(833)}')`,'rollback-restores-claims-and-membership')}
 begin; set local role service_role;
 select ${call(831,836)};
 ${denied(call(831,836,trip+'-other'))}
 ${denied(call(833,834))}
 ${denied(call(831,834))}
 ${denied(call(831,831))}
 ${denied(call(831,833,trip,'unknown_operation'),'P0002')}
 ${denied(`public.trip_invitation_bridge('${uid(831)}','remove_access','[]')`,'22023')}
 ${denied(`public.trip_invitation_bridge('${uid(831)}','remove_access','{"tripId":"${trip}","membershipId":"bad"}')`,'22023')}
 ${denied(`public.trip_invitation_bridge('${uid(831)}','remove_access','{"tripId":"${trip}","membershipId":"${mid(833)}","claims":{"sub":"${uid(831)}"}}')`,'22023')}
 commit;
 ${check(`exists(select 1 from public.trip_members where id='${mid(836)}')`,'cross-trip-target-preserved')}
 ${check(`(select count(*) from public.trip_members where trip_id='${trip}')=3`,'editor-owner-self-unknown-malformed-denials-preserve-memberships')}
 ${check('auth.uid() is null','all-failure-paths-clear-claims')}
 begin; set local role service_role; select ${call(831,833)}; commit;
 ${check(`not exists(select 1 from public.trip_members where id='${mid(833)}')`,'owner-removes-editor')}
 `);
 passed=output.split('\n').filter(l=>l.startsWith('PASS:')).length;assert.equal(passed,11);console.log(output.split('\n').filter(l=>l.startsWith('PASS:')).join('\n'));
 setup();
 // Hold the parent lock after demotion, start removal, positively observe its lock wait,
 // then let the demotion commit. Ownership must be re-read after acquiring the lock.
 const first=asyncSql(`begin; set local application_name='removal-review-demotion'; update public.trip_members set role='viewer' where id='${mid(831)}'; select pg_sleep(8); commit;`);
 let ready=false;
 for(let n=0;n<40;n++){ready=sql("select exists(select 1 from pg_stat_activity where application_name='removal-review-demotion' and wait_event='PgSleep')")==='t';if(ready)break;await delay(50);}
 if(!ready){await first;throw Error('DEMOTION_GATE_NOT_REACHED');}
 const second=asyncSql(`begin; set local application_name='removal-review-request'; set local statement_timeout='15s'; set local role service_role; select ${call()}; commit;`);
 let blocked=false;
 for(let n=0;n<40;n++){blocked=sql("select exists(select 1 from pg_stat_activity where application_name='removal-review-request' and wait_event_type='Lock')")==='t';if(blocked)break;await delay(50);}
 const [a,b]=await Promise.all([first,second]);assert.equal(a.code,0,a.error);assert.ok(blocked,'removal must wait for concurrent parent lock');assert.notEqual(b.code,0);assert.match(b.error,/42501/);
 assert.equal(sql(`select role from public.trip_members where id='${mid(831)}'`),'viewer');
 assert.equal(sql(`select count(*) from public.trip_members where id='${mid(832)}'`),'1');
 assert.equal(sql(`select count(*) from public.trip_members where trip_id='${trip}' and role='owner'`),'1');
 console.log(`Boundary scenarios: ${passed} passed; bridge demotion race: 1 passed (observed lock wait, 42501, target/final owner preserved)`);
}finally{clean();}
