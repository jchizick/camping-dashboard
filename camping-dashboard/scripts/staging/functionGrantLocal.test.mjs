// Explicit disposable-local integration test. All fixture DDL rolls back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('PostgreSQL default ACL, PUBLIC, grant-option and CREATE OR REPLACE semantics',()=>{
  const sql=`BEGIN;
    CREATE SCHEMA grant_diagnostic_fixture;
    CREATE FUNCTION grant_diagnostic_fixture.original() RETURNS int LANGUAGE sql AS 'SELECT 1';
    DO $$ BEGIN
      IF NOT has_function_privilege('service_role','grant_diagnostic_fixture.original()','EXECUTE') THEN RAISE EXCEPTION 'PUBLIC missing'; END IF;
    END $$;
    REVOKE ALL ON FUNCTION grant_diagnostic_fixture.original() FROM PUBLIC;
    DO $$ BEGIN
      IF has_function_privilege('service_role','grant_diagnostic_fixture.original()','EXECUTE') THEN RAISE EXCEPTION 'PUBLIC revoke failed'; END IF;
    END $$;
    ALTER DEFAULT PRIVILEGES IN SCHEMA grant_diagnostic_fixture GRANT EXECUTE ON FUNCTIONS TO service_role;
    CREATE FUNCTION grant_diagnostic_fixture.hosted() RETURNS int LANGUAGE sql AS 'SELECT 1';
    REVOKE ALL ON FUNCTION grant_diagnostic_fixture.hosted() FROM PUBLIC, anon, authenticated;
    CREATE TEMP TABLE grant_acl_snapshot AS SELECT proacl,proowner FROM pg_proc WHERE oid='grant_diagnostic_fixture.hosted()'::regprocedure;
    CREATE OR REPLACE FUNCTION grant_diagnostic_fixture.hosted() RETURNS int LANGUAGE sql AS 'SELECT 2';
    DO $$ BEGIN
      IF NOT has_function_privilege('service_role','grant_diagnostic_fixture.hosted()','EXECUTE') THEN RAISE EXCEPTION 'default grant lost'; END IF;
      IF has_function_privilege('service_role','grant_diagnostic_fixture.hosted()','EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'unexpected grant option'; END IF;
      IF has_function_privilege('anon','grant_diagnostic_fixture.hosted()','EXECUTE') OR has_function_privilege('authenticated','grant_diagnostic_fixture.hosted()','EXECUTE') THEN RAISE EXCEPTION 'revokes lost'; END IF;
      IF EXISTS(SELECT 1 FROM grant_acl_snapshot s JOIN pg_proc p ON p.oid='grant_diagnostic_fixture.hosted()'::regprocedure WHERE p.proacl IS DISTINCT FROM s.proacl OR p.proowner<>s.proowner) THEN RAISE EXCEPTION 'replace changed ACL/owner'; END IF;
      IF has_function_privilege('service_role','grant_diagnostic_fixture.original()','EXECUTE') THEN RAISE EXCEPTION 'default retroactive'; END IF;
    END $$;
    GRANT EXECUTE ON FUNCTION grant_diagnostic_fixture.hosted() TO service_role WITH GRANT OPTION;
    DO $$ BEGIN IF NOT has_function_privilege('service_role','grant_diagnostic_fixture.hosted()','EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'grant option absent'; END IF; END $$;
    ROLLBACK;
    SELECT to_regnamespace('grant_diagnostic_fixture') IS NULL;
  `;
  const result=execFileSync('docker',['exec','-i','supabase_db_invitation-phase1-test','psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:sql,encoding:'utf8',timeout:30000});
  assert.equal(result.trim(),'t');
});
