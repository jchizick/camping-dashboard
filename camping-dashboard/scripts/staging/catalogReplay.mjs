// Caller provides a disposable-only SQL executor. No historical artifacts.
import {SCHEMA_SQL} from './postMigrationContract.mjs';
export function captureLocalCatalog(query) {
 return JSON.parse(query(`BEGIN READ ONLY; SET LOCAL search_path=public,extensions;
 SELECT json_build_object('history',(SELECT json_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),
 'catalog',(SELECT row_to_json(f) FROM (${SCHEMA_SQL}) f)); COMMIT;`));
}
