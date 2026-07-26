# Supabase type generation

`src/types/supabase.ts` is generated from the reproducible local Supabase
schema. It is the only `Database` definition in the application and must not
be edited by hand.

## Type layers

- `src/types/supabase.ts` contains CLI-generated database metadata.
- `src/types/database.ts` aliases generated row, insert, update, and RPC types
  without copying fields.
- `src/types/index.ts` contains API transports and application/view models.
- `src/lib/dashboardMapper.ts` validates nullable database rows and
  check-constrained strings before they enter UI state.

An optional singleton module is represented as `Row | null`. A present row's
nullable columns remain nullable in its generated type; a view model can make
specific values required only after the mapper verifies them at runtime.
External Open-Meteo payloads remain separate from generated weather inserts
and database rows.

## Commands

Use the package-pinned Supabase CLI version `2.109.1`:

```bash
npx supabase start
npx supabase db reset
npm run types:supabase
npm run types:supabase:check
```

The generator targets the local `public` schema. The stale check writes a
candidate into the operating system's temporary directory, compares it with
the canonical file, and always removes the temporary directory.

Run `npm run test:db` after the stale check for migration or database-function
changes. Ordinary unit tests and builds stay offline and do not depend on
Docker.

## Known generator boundary

PostgreSQL permits null values for function arguments unless the function body
rejects them, but the generated RPC metadata does not express argument
nullability. `replace_prep_feed_image` intentionally accepts null image URL
and storage path values for external/no-image lifecycle transitions. Its route
keeps one narrow, documented assertion at the typed RPC call while validating
the JSON result at runtime.
