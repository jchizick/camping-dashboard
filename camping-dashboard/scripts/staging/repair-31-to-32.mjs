// No implicit action, no plan/apply aliases, no defaults that can mutate.
import {MODE} from './repairContract.mjs';
import {runHostedRepair} from './repairTransport.mjs';
try {
 if(process.argv.length!==4||process.argv[2]!==MODE||!['--dry-run','--apply'].includes(process.argv[3]))throw new Error('REPAIR_MODE_NOT_EXPLICIT');
 const result=await runHostedRepair(MODE,process.argv[3]);
 console.log(JSON.stringify(result));
}catch(e){console.log(JSON.stringify({result:'FAIL',code:/^REPAIR_[A-Z0-9_]+$/.test(e.message)?e.message:'REPAIR_FAILED',deploymentAuthorized:false}));process.exitCode=1;}
