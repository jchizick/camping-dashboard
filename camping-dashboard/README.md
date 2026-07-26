# Camping Dashboard

## Development

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validation

The default unit tests are offline and do not require Supabase:

```bash
npm test
npm run lint
npm run build
```

Database integration tests are deliberately separate:

```bash
npx supabase start
npx supabase db reset
npm run test:db
```

These tests require Docker and the local Supabase stack. They reset only the
local database and must not be pointed at a hosted project.

The repository currently contains migrations beginning with the campsite
expand phase. Before `supabase db reset` can succeed on a clean machine, restore
the project’s earlier baseline migrations (through
`20260710135251_006_fix_trip_members_rls_recursion`) from the canonical schema
history. Do not synthesize that baseline from production data. The expand
migration intentionally aborts if its required base tables are absent or if
existing trip relationships are ambiguous.
