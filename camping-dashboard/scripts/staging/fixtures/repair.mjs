// Synthetic control-plane evidence only. Catalog/session rows come from a fresh
// disposable replay supplied by the caller, never saved hosted evidence.
import {REF,SOURCE,CA_HASH} from '../repairContract.mjs';
export function repairBundle(snapshot,session='synthetic-session',now=Date.now()) {
 const host='aws-0-ca-central-1.pooler.supabase.com';
 return {a:structuredClone(snapshot),b:structuredClone(snapshot),session,source:SOURCE,ref:REF,
  project:{id:REF,name:'field-protocol-staging',status:'ACTIVE_HEALTHY',organization_id:'qvhhhjlpntbtctqinayz',database:{host:`db.${REF}.supabase.co`}},
  receipt:{version:2,ready:true,ref:REF,state:'ACTIVE_HEALTHY',timestampUtc:new Date(now).toISOString(),poolerEndpoint:`/projects/${REF}/config/database/pooler`,poolerStatus:200,host,user:`postgres.${REF}`,database:'postgres',port:5432,apiEndpoint:`/projects/${REF}/api-keys?reveal=true`,apiStatus:200,generation:'modern'},
  host,caHash:CA_HASH,tlsVerified:true,independentSystemId:snapshot.row.system_id,timestampUtc:new Date(now).toISOString()};
}
