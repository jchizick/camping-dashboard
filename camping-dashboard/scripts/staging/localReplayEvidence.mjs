import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {compareTypes} from './typeComparison.mjs';
import {IDENTITY_SQL,sqlEvidence} from './sqlIdentity.mjs';
export const normalizeTypes=text=>text.replace(/\r\n/g,'\n').replace(/^\/\/ This file is generated[^]*?\n\n/,'').trim();
export function verifyLocalReplay(root,query,generated) {
 const baseline=readFileSync(join(root,'src/types/supabase.ts'),'utf8');
 const comparison=compareTypes(baseline,generated);
 const normalizedEquivalent=normalizeTypes(baseline)===normalizeTypes(generated);
 const proof=sqlEvidence(query(IDENTITY_SQL));
 const checks=JSON.parse(query('BEGIN READ ONLY; SELECT json_agg(result) FROM ('+readFileSync(new URL('./verify.sql',import.meta.url),'utf8').trim().replace(/;$/,'')+') result; COMMIT;'));
 if(!proof.passed||checks.length!==8||checks.some(c=>c.passed!==true))throw new Error('LOCAL_IDENTITY_OR_GRANTS_FAILED');
 if(!comparison.equivalent||!normalizedEquivalent)throw new Error('TYPE_BASELINE_REVIEW_REQUIRED');
 return {comparison,normalizedEquivalent,proof,checks};
}
