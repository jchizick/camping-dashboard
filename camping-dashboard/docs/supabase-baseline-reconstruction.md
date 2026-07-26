# Supabase baseline reconstruction

## Boundary and strategy

This repository uses Strategy A: historical reconstruction.

`20260710135251_006_fix_trip_members_rls_recursion.sql` is a schema-only
baseline representing the hosted application schema immediately before the
retained campsite/trip-creation migrations. The 14 earlier hosted versions are
kept as no-op markers so local and hosted migration version/name histories
remain identical.

The baseline excludes hosted data, auth users, trip memberships, Storage
objects, URLs, credentials, and the obsolete email-based admin allowlist. The
historical `seed_alpha_trip_members` version is deliberately a no-op because
its hosted rows were production data, not stable application fixtures.

## Retained migration replay

The following feature migrations replay after the baseline:

1. `20260726010611_expand_trip_creation_and_campsites.sql`
2. `20260726013323_refactor_create_trip_remove_legacy_singleton_id.sql`
3. `20260726013846_contract_singleton_trip_ids.sql`
4. `20260726143539_safe_trip_and_prep_feed_deletion.sql`
5. `20260726143737_index_prep_feed_cleanup_jobs_trip_id.sql`

The first three filenames were aligned to their actual hosted timestamps. The
expand migration body was restored to the hosted-applied SQL. The safe deletion
migration now explicitly grants the begin/complete RPCs to `service_role`,
matching the hosted ACL without depending on environment-specific default
privileges.

No remote migration-history repair is necessary. Do not run migration repair,
reset, or seed commands against the hosted project for this reconstruction.

## Canonical snapshot

The baseline was built from:

- read-only hosted migration-history queries;
- read-only catalog introspection of columns, constraints, indexes, functions,
  triggers, RLS, policies, grants, Storage, Realtime, and other app-owned
  objects;
- the checked-in application, tests, SQL, and hand-written TypeScript types;
- the retained hosted migration statements.

`supabase/schema_snapshot.sql` produces deterministic fingerprints for
application-owned schema. After a clean local replay, local and hosted matched:

| Category | Count | Fingerprint |
| --- | ---: | --- |
| columns | 142 | `b0c2ffd0abc6169f1ed4ebdb3427d266` |
| constraints | 42 | `6d4ae2505b974fcdb2bb9098c49cfbe3` |
| function grants | 16 | `2437999f4ef2cbdbded91f4156f39bdc` |
| functions | 8 | `0877425174338423a2f1895125e97a01` |
| indexes | 21 | `9e21c451b9e53e5222b75b83f2fe92a4` |
| other objects | structured | `4483527d98175ca781feb40e07a70ce7` |
| policies | 46 | `70d19e72f7cd9039a6aba44c2b9a406c` |
| required extensions | 1 | `aaeab90b5a69c95c5275c840d5cdc7ea` |
| RLS tables | 15 | `be59c64f67a2d9557a4bc8d2ab809162` |
| Storage bucket | 1 | `97c24d72cac8db8656d7e91f8e896493` |
| table grants | 299 | `daba4989491be1a75232eab73e83d086` |

The comparison excludes Supabase-managed internal schemas, owners, OIDs,
statistics, and data. There are no app-owned public views, materialized views,
sequences, triggers, enums, or Realtime publication entries. The app-owned
Storage configuration is the public `prep-feed` bucket plus the two
membership-scoped mutation policies.

## Generated application types

Canonical Supabase TypeScript database types are now generated from this
reproducible local schema. See `docs/supabase-type-generation.md` for the
generation, stale-check, and application boundary workflow.
