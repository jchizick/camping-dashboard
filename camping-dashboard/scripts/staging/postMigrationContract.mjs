import {readFileSync} from 'node:fs';
import {hash} from './typeComparison.mjs';
export const PRE='PRE_MIGRATION_STAGING';
export const POST='POST_MIGRATION_STAGING';
export const CURRENT_STATE=POST;
const manifest=JSON.parse(readFileSync(new URL('./migrations.json',import.meta.url),'utf8'));
export const VERSIONS=manifest.migrations.map(m=>m.name.slice(0,14));
export const HISTORY_SHA256='3e2288e2034b1492cccfe54509b26bfb897e601ebe1a70a508c8cfdcb41da412';
export const SCHEMA_FINGERPRINT='b3e3c93d5de2a53b9e7a4afae89d9ada';
export const SCHEMA_SQL=readFileSync(new URL('./schemaFingerprint.sql',import.meta.url),'utf8');
export const SCHEMA_QUERY_SHA256='f8793c2db46829c68f5ce673f9fe43981173fe1837f44f4625dc4b826ab9e8d5';
// Target: 32 migrations. Hosted remains at 31 until a separately approved repair.
// Core, authorization (135747), bridge (145134), delivery/limiter (164431).
export const POST_SENTINELS={
 'public.trips':'class', 'public.trip_members':'class', 'public.trip_invitations':'class',
 'public.trip_invitation_bridge(uuid,text,jsonb)':'procedure',
 'app_private.invitation_rate_limits':'class',
 'public.consume_invitation_rate_limits(jsonb)':'procedure',
};
export function assertContract() {
 if(VERSIONS.length!==32||VERSIONS.at(-1)!=='20260912215252'||hash(JSON.stringify(VERSIONS))!==HISTORY_SHA256||hash(SCHEMA_SQL)!==SCHEMA_QUERY_SHA256)
   throw new Error('NEW_MIGRATION_CONTRACT_REVIEW_REQUIRED');
}
export function schemaState(row,state) {
 if(![PRE,POST].includes(state)) throw new Error('EXPLICIT_STAGING_STATE_REQUIRED');
 assertContract();
 const history=Array.isArray(row.migration_history)?row.migration_history:null;
 const migration_history_match=history!==null && JSON.stringify(history)===JSON.stringify(state===POST?VERSIONS:[]);
 const post_migration_sentinels_match=Object.keys(POST_SENTINELS).every(k=>row.post_sentinels?.[k]===true);
 const schema_fingerprint_match=row.post_schema_hash===SCHEMA_FINGERPRINT;
 return {staging_state:state,migration_history_match,
   migration_history_sha256:history!==null&&history.length<=32&&history.every(v=>typeof v==='string'&&/^\d{14}$/.test(v))?hash(JSON.stringify(history)):null,
   post_schema_fingerprint:typeof row.post_schema_hash==='string'&&/^[a-f0-9]{32}$/.test(row.post_schema_hash)?row.post_schema_hash:null,
   schema_query_sha256:SCHEMA_QUERY_SHA256,
   ...(state===POST?{post_migration_sentinels_match,schema_fingerprint_match}:{}),
   schema_state_code:!migration_history_match||(state===POST&&!post_migration_sentinels_match)?'STAGING_SCHEMA_PARTIAL':
     state===POST&&!schema_fingerprint_match?'STAGING_SCHEMA_FINGERPRINT_MISMATCH':'OK'};
}
export function authorizeMigrationAction(action,versions=VERSIONS) {
 assertContract();
 if(JSON.stringify(versions)!==JSON.stringify(VERSIONS)) throw new Error('NEW_MIGRATION_CONTRACT_REVIEW_REQUIRED');
 if(action!=='verify') throw new Error('POST_MIGRATION_VERIFY_ONLY');
 return {staging_state:POST,apply:false,dryRun:false};
}
