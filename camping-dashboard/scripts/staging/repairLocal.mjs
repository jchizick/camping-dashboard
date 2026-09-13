// Invoked only inside validate-local's fixed disposable project. No hosted URI.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {MODE,REF,FILE,runRepair} from './repairContract.mjs';
import {REPAIR_SQL,parseSnapshot,parsePending} from './repairTransport.mjs';
import {repairBundle} from './fixtures/repair.mjs';
export async function simulateLocalRepair({query,cli,project,root}) {
 if(!readFileSync(join(project,'supabase/config.toml'),'utf8').includes('project_id = "invitation-phase1-test"'))throw Error('LOCAL_PROJECT_REQUIRED');
 const signatures=['public.claim_trip_alerts_manual(text,text,integer,integer)','public.claim_trip_weather_manual(text,text,integer,integer)','public.create_trip(text,date,date,double precision,double precision,text,text,text,text,text,text)'];
 query('GRANT EXECUTE ON FUNCTION '+signatures.join(',')+' TO service_role;');
 const snapshot=()=>parseSnapshot(query(REPAIR_SQL));
 const before=snapshot();let applyCount=0;
 const local=args=>{const r=spawnSync(process.execPath,[cli,...args,'--local','--workdir',project],{encoding:'utf8',timeout:120000});if(r.status!==0)throw Error('LOCAL_CLI_FAILED');return r.stdout+'\n'+r.stderr;};
 const io={bytes:async()=>readFileSync(join(root,'supabase/migrations',FILE)),
  capture:async session=>repairBundle(snapshot(),session),preserve:async()=>{},
  dryRun:async()=>parsePending(local(['migration','list']),local(['db','push','--dry-run'])),
  apply:async()=>{applyCount++;local(['db','push','--yes']);}};
 const dry=await runRepair({mode:MODE,ref:REF,session:'local-dry',io,dryRunOnly:true});
 if(applyCount!==0)throw Error('DRY_RUN_MUTATED');
 const result=await runRepair({mode:MODE,ref:REF,session:'local-apply',io});
 const after=snapshot();
 let repeated;try{await runRepair({mode:MODE,ref:REF,session:'local-repeat',io});}catch(e){repeated=e.message;}
 if(applyCount!==1||repeated!=='REPAIR_ALREADY_COMPLETE')throw Error('REPAIR_NOT_ONE_SHOT');
 return {before,after,dry,result,applyCount,repeated,controlPlane:'SYNTHETIC_LOCAL_ONLY'};
}
