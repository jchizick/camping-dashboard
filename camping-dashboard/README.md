# Camping Dashboard

## Application development

Install dependencies and run the development server against the environment in
`.env.local`:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local Supabase

Local database work requires Docker Desktop and the repository-pinned Supabase
CLI (`supabase@2.109.1`, installed by `npm install`). Use `npx supabase` so the
pinned version is selected.

Start the local stack and replay the complete migration history:

```bash
npx supabase start
npx supabase db reset
```

The reset applies all files in `supabase/migrations`, then the intentionally
empty `supabase/seed.sql`. Tests create synthetic users and trips inside
transactions and roll them back; no hosted users, trips, memberships, URLs, or
Storage objects are copied locally.

### Generated database types

The canonical database definition is generated from the reset local schema
with the repository-pinned Supabase CLI (`2.109.1`). With the local stack
running and migrations reset, regenerate and verify it with:

```bash
npm run types:supabase
npm run types:supabase:check
```

The check generates into a temporary directory, compares the result with
`src/types/supabase.ts`, and removes the temporary output. It exits non-zero
when the generated file is stale. Neither the default test suite nor the
production build runs this Docker-dependent check.

Regenerate after any migration that changes public tables, columns,
relationships, functions, views, enums, or composite types. Before merging
database-changing work, run:

```bash
npx supabase db reset
npm run types:supabase
npm run types:supabase:check
npm run test:db
```

Get the local URL and keys with:

```bash
npx supabase status
```

Create an ignored `.env.local` with the returned local-only values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<local SERVICE_ROLE_KEY>
```

Never use hosted or production credentials for local validation. With the local
values configured, run `npm run dev`. The application UI currently signs in
only through Google OAuth, so interactive local sign-in also requires a
developer-supplied local Google provider configuration; provider credentials
are intentionally not checked in. Database tests avoid that external dependency
by creating synthetic auth users transactionally. Local mail is captured at
`http://127.0.0.1:54324`.

## Validation

The default unit tests are offline and do not require Supabase:

```bash
npm test
npm run lint
npm run build
```

Database integration tests are deliberately separate:

```bash
npx supabase db reset
npm run test:db
```

These tests require Docker and the local Supabase stack. They reset only the
local database and must not be pointed at a hosted project.

Stop the stack while preserving local data:

```bash
npx supabase stop
```

For a fully clean disposable restart, discard local volumes and replay:

```bash
npx supabase stop --no-backup
npx supabase start
npx supabase db reset
```

The schema-only baseline is
`20260710135251_006_fix_trip_members_rls_recursion.sql`. Earlier hosted versions
are retained as history markers because their final schema is incorporated into
that baseline. In particular, the former production membership seed is
intentionally a no-op locally. Later campsite, singleton-contract, prep-feed,
and retry-safe deletion migrations remain independently replayable.
