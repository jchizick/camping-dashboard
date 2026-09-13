import {MODE} from './accessBridgeContract.mjs';
import {runHostedAccessBridge} from './accessBridgeTransport.mjs';
try{
 if(process.argv.length!==4)throw Error('ACCESS_BRIDGE_MODE_NOT_EXPLICIT');
 console.log(JSON.stringify(await runHostedAccessBridge(process.argv[2],process.argv[3])));
}catch(e){console.log(JSON.stringify({result:'FAIL',code:/^ACCESS_BRIDGE_[A-Z0-9_]+$/.test(e.message)?e.message:'ACCESS_BRIDGE_FAILED',mode:MODE,deploymentAuthorized:false}));process.exitCode=1;}
