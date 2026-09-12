// Input is created and cleaned up by validate-local, never a pre-existing artifact.
import {readFileSync} from 'node:fs';
import {VERSIONS,SCHEMA_FINGERPRINT} from './postMigrationContract.mjs';
export function replayContext() {
 const path=process.env.STAGING_TEST_REPLAY;
 if(!path)throw new Error('RUN_VALIDATE_LOCAL_FOR_DATABASE_TESTS');
 const result=JSON.parse(readFileSync(path,'utf8'));
 if(result.version!==1||JSON.stringify(result.after.history)!==JSON.stringify(VERSIONS)||result.after.catalog.fingerprint!==SCHEMA_FINGERPRINT)throw new Error('INVALID_FRESH_REPLAY');
 return result;
}
