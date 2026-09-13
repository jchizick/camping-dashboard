import {MODE} from './accessManagementContract.mjs';
import {runHostedAccessManagement} from './accessManagementTransport.mjs';
try{
 if(process.argv.length!==4)throw Error('ACCESS_MANAGEMENT_MODE_NOT_EXPLICIT');
 console.log(JSON.stringify(await runHostedAccessManagement(process.argv[2],process.argv[3])));
}catch(e){console.log(JSON.stringify({result:'FAIL',code:/^ACCESS_MANAGEMENT_[A-Z0-9_]+$/.test(e.message)?e.message:'ACCESS_MANAGEMENT_FAILED',mode:MODE,deploymentAuthorized:false}));process.exitCode=1;}
