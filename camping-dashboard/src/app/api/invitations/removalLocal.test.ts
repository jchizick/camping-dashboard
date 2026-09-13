// Synthetic sessions only. Real hosted Google-session QA remains a separate gate.
import {afterAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {execFileSync} from 'node:child_process';
import {NextRequest} from 'next/server';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/serverSupabase',()=>({createRequestSupabaseClient:async()=>({auth:{getUser:mocks.getUser}})}));
// Keep the real route, domain service and service-role RPC/error adapter. Only replace transport.
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({rpc:mocks.rpc})}));
vi.mock('@/lib/invitations/config',()=>({invitationConfig:()=>({provider:'local',origin:'http://localhost',rateSecret:'local-removal-fixture-rate-secret'})}));
import {POST} from './route';
import {createTripInvitationToken} from '@/lib/tripInvitationToken';
import {callInvitationBridge} from '@/lib/invitations/server';
const enabled=process.env.INVITATION_LOCAL_DB_TEST==='true';
const sql=(query:string)=>execFileSync('docker',['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],{input:query,encoding:'utf8',stdio:'pipe'}).trim();
const quote=(s:string)=>`'${s.replaceAll("'","''")}'`;
const uid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const mid=(n:number)=>`10000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const tripId='removal-server-fixture';
const cleanup=()=>sql(`begin; delete from public.trips where id='${tripId}'; delete from auth.users where id in (${[811,812,813,814,815].map(n=>quote(uid(n))).join(',')}); commit;`);
const snapshot=()=>sql(`select json_agg(m order by id) from public.trip_members m where trip_id='${tripId}'`);
const request=(membershipId=mid(812),extra:Record<string,unknown>={})=>new NextRequest('http://localhost/api/invitations',{
  method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({operation:'remove_access',tripId,membershipId,...extra}),
});
describe.skipIf(!enabled)('product removal against local service-role SQL bridge',()=>{
  beforeEach(()=>{
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','http://localhost:54321');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-local-transport');
    cleanup();
    sql(`begin;
      insert into auth.users(id,email,email_confirmed_at) select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'removal-'||n||'@example.test',now() from generate_series(811,815) n;
      insert into public.trips(id,name) values ('${tripId}','Synthetic removal fixture');
      insert into public.trip_members(id,trip_id,user_id,role) values
      ('${mid(811)}','${tripId}','${uid(811)}','owner'),('${mid(812)}','${tripId}','${uid(812)}','viewer'),
      ('${mid(813)}','${tripId}','${uid(813)}','editor'),('${mid(814)}','${tripId}','${uid(814)}','owner');
      insert into public.crew_members(id,trip_id,name,trip_member_id) values ('removal-crew','${tripId}','Synthetic camper','${mid(812)}');
      insert into public.gear_items(id,trip_id,name,category,responsible_crew_member_id) values ('removal-gear','${tripId}','Tent','Shelter','removal-crew');
      insert into public.meals(id,trip_id,day_number,meal_type,title,prep_crew_member_id) values ('removal-meal','${tripId}',1,'dinner','Soup','removal-crew'); commit;`);
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(811)}},error:null});
    mocks.rpc.mockImplementation(async(name:string,args:Record<string,unknown>)=>{
      if(name==='consume_invitation_rate_limits') return {data:{allowed:true,retryAfter:0},error:null};
      expect(name).toBe('trip_invitation_bridge');
      try {
        const data=JSON.parse(sql(`begin; set local role service_role;
          select public.trip_invitation_bridge(${quote(String(args.p_actor))}::uuid,${quote(String(args.p_operation))},${quote(JSON.stringify(args.p_input))}::jsonb); commit;`));
        return {data,error:null};
      } catch(error) {
        const stderr=(error as {stderr?:Buffer}).stderr?.toString()??'';
        const code=stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'unknown';
        return {data:null,error:{code}}; // never print SQL/session-bearing errors
      }
    });
  });
  afterAll(()=>{cleanup();vi.unstubAllEnvs();});
  it('owner removes non-owner; Crew, gear and meals survive with the optional link cleared',async()=>{
    const before=sql(`select row_to_json(c)::jsonb-'trip_member_id' from public.crew_members c where id='removal-crew'`);
    const gear=sql(`select row_to_json(g) from public.gear_items g where id='removal-gear'`);
    const meal=sql(`select row_to_json(m) from public.meals m where id='removal-meal'`);
    const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({outcome:'access_removed'});
    expect(sql(`select count(*) from public.trip_members where id='${mid(812)}'`)).toBe('0');
    expect(sql(`select role from public.trip_members where id='${mid(811)}'`)).toBe('owner');
    expect(sql(`select trip_member_id is null from public.crew_members where id='removal-crew'`)).toBe('t');
    expect(sql(`select row_to_json(c)::jsonb-'trip_member_id' from public.crew_members c where id='removal-crew'`)).toBe(before);
    expect(sql(`select row_to_json(g) from public.gear_items g where id='removal-gear'`)).toBe(gear);
    expect(sql(`select row_to_json(m) from public.meals m where id='removal-meal'`)).toBe(meal);
    expect(await (await POST(request())).json()).toEqual({outcome:'access_removed'});
  });
  it.each([812,813,815])('denies viewer/editor/unrelated caller %s through the privileged client',async n=>{
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(n)}},error:null});const before=snapshot();
    const response=await POST(request(mid(813)));expect(response.status).toBe(403);
    expect(await response.json()).toEqual({code:'not_authorized'});expect(snapshot()).toBe(before);
  });
  it.each([811,814])('denies owner/self target %s',async n=>{
    const before=snapshot();expect((await POST(request(mid(n)))).status).toBe(403);expect(snapshot()).toBe(before);
  });
  it('protects the final owner and denies non-owner self-removal',async()=>{
    sql(`update public.trip_members set role='editor' where id='${mid(814)}'`);
    const before=snapshot();expect((await POST(request(mid(811)))).status).toBe(403);
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(812)}},error:null});
    expect((await POST(request())).status).toBe(403);expect(snapshot()).toBe(before);
  });
  it.each(['actorUserId','ownerUserId','callerRole','isOwner'])('rejects spoof %s without mutation',async field=>{
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(812)}},error:null});const before=snapshot();
    expect((await POST(request(mid(813),{[field]:uid(811)}))).status).toBe(400);expect(snapshot()).toBe(before);
  });
  it.each([null,{message:'invalid or foreign session'}])('rejects unverified session (%s)',async error=>{
    mocks.getUser.mockResolvedValue({data:{user:error?{id:uid(811)}:null},error});const before=snapshot();
    expect((await POST(request())).status).toBe(401);expect(snapshot()).toBe(before);
  });
  it('does not change normal editor domain rights',()=>{
    expect(sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${uid(813)}';
      update public.gear_items set notes='editor may still edit' where id='removal-gear';
      select notes from public.gear_items where id='removal-gear'; rollback;`)).toBe('editor may still edit');
  });
  it('accepts an invitation, removes through POST, and cannot regrant through POST acceptance',async()=>{
    const token=createTripInvitationToken();
    await callInvitationBridge(uid(811),'create',{tripId,email:'removal-815@example.test',role:'editor',tokenHash:token.tokenHash});
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(815)}},error:null});
    const accept=()=>new NextRequest('http://localhost/api/invitations',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({operation:'accept',token:token.rawToken})});
    expect(await (await POST(accept())).json()).toEqual({outcome:'accepted',trip_id:tripId});
    const membership=sql(`select id from public.trip_members where trip_id='${tripId}' and user_id='${uid(815)}'`);
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(811)}},error:null});
    expect(await (await POST(request(membership))).json()).toEqual({outcome:'access_removed'});
    mocks.getUser.mockResolvedValue({data:{user:{id:uid(815)}},error:null});
    expect(await (await POST(accept())).json()).toEqual({outcome:'already_accepted',trip_id:null});
    expect(sql(`select count(*) from public.trip_members where trip_id='${tripId}' and user_id='${uid(815)}'`)).toBe('0');
  });
});
