// Fixed disposable local database only; no hosted credentials or provider network calls.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
const args=['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
const sql=query=>execFileSync('docker',args,{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const parallel=query=>new Promise((resolve,reject)=>{
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';
  child.stdout.on('data',s=>out+=s);child.stderr.on('data',s=>err+=s);child.on('error',reject);
  child.on('close',code=>code ? reject(new Error(err)) : resolve(out.trim()));child.stdin.end(query);
});
const trip='delivery-race-fixture',owner='00000000-0000-0000-0000-000000000884';
const key='9'.repeat(64);
const clean=()=>sql(`begin;delete from public.trips where id='${trip}';delete from auth.users where id='${owner}';delete from app_private.invitation_rate_limits where bucket_key='${key}';commit;`);
try {
  clean();
  const rates=`select public.consume_invitation_rate_limits('[{"key":"${key}","limit":5,"seconds":60}]');`;
  const results=await Promise.all(Array.from({length:12},()=>parallel(`begin;set local role service_role;${rates}commit;`)));
  assert.equal(results.filter(s=>JSON.parse(s).allowed).length,5);
  assert.equal(sql(`select requests from app_private.invitation_rate_limits where bucket_key='${key}'`),'12');
  console.log('Concurrent shared budget: exactly 5 of 12 allowed');
  sql(`begin;insert into auth.users(id,email,email_confirmed_at) values('${owner}','delivery-race@example.test',now());
    insert into public.trips(id,name) values('${trip}','Delivery race');
    insert into public.trip_members(trip_id,user_id,role) values('${trip}','${owner}','owner');commit;`);
  const bridge=(op,input)=>`select public.trip_invitation_bridge('${owner}','${op}','${JSON.stringify(input)}');`;
  const created=JSON.parse(sql(bridge('create',{tripId:trip,email:'fictional@example.test',role:'viewer',tokenHash:'f'.repeat(64)})));
  const input={tripId:trip,invitationId:created.id,attemptId:created.deliveryAttemptId,tokenHash:'f'.repeat(64),provider:'resend'};
  const claims=await Promise.all(Array.from({length:6},()=>parallel(bridge('delivery_start',input))));
  assert.equal(claims.filter(s=>JSON.parse(s).updated).length,1);
  assert.equal(sql(`select delivery_attempt_count from public.trip_invitations where trip_id='${trip}'`),'1');
  console.log('Concurrent delivery claim: exactly 1 of 6 acquired');
  const finishes=await Promise.all(['sent','failed'].map(state=>parallel(bridge('delivery_finish',{...input,state,...(state==='failed'?{failureCode:'provider_rejected'}:{})}))));
  assert.equal(finishes.filter(s=>JSON.parse(s).updated).length,1);
  console.log('Concurrent completion: exactly 1 final result persisted');
} finally {clean();}
