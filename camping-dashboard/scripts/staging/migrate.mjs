// Current FINAL staging verifier: 34. No generic mutation path.
import {runHostedAccessManagement} from './accessManagementTransport.mjs';
import {MODE} from './accessManagementContract.mjs';
try {
 if(process.argv.length!==3||process.argv[2]!=='verify')throw Error('STAGING_VERIFY_ONLY');
 console.log(JSON.stringify(await runHostedAccessManagement(MODE,'--verify')));
}catch(e){console.log(JSON.stringify({result:'FAIL',code:/^(ACCESS_MANAGEMENT_[A-Z0-9_]+|STAGING_VERIFY_ONLY)$/.test(e.message)?e.message:'ACCESS_MANAGEMENT_FAILED',deploymentAuthorized:false}));process.exitCode=1;}
