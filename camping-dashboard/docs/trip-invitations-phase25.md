# Phase 2.5 — invitation token transport

Review candidate based on `c86512cf22a36ea4e1e22d4249d9407b49006432`.
No commit, push, deployment, production migration, real delivery, or Invite UI.

## Contract

Delivery now produces `https://<application-origin>/invite#<43-character-token>`.
The server GET is `/invite`, a dynamic generic shell with no inspection or mutation.
The old `src/app/invite/[token]/page.tsx` is removed; old links are not supported.

The browser validates canonical base64url shape, captures one token in sessionStorage,
and replaces the address with `/invite` before inspection. No new history entry is added.
Reload and same-tab OAuth recover it for up to one hour, without extending that window.
This recovery timeout does not change the database's seven-day invitation expiry.
Expired recovery, malformed/new invalid fragments, terminal invitation outcomes, and
ordinary explicit sign-out clear the stored token. Storage/URL-cleanup failures fail closed.
Opener-created tabs discard cloned sessionStorage and detach the opener; a fresh fragment
can then establish that tab's own invitation. A fresh plain tab shows email-link guidance.

OAuth uses only `next=/invite`. The existing PKCE callback and same-tab Google redirect
mechanism remain. The shared safe-next validator rejects old invitation paths and
token-bearing query/fragment returns, including encoded and nested-next forms.
Wrong-account switching retains the bounded per-tab secret while running the existing
user-cache/identity cleanup and sign-out. Ordinary sign-out does not retain the secret.

Inspection and acceptance retain the existing same-origin POST `/api/invitations`
JSON contract (`operation` and `token`). Verified server identity, digest derivation,
atomic acceptance, rotation, revocation, and consumed-token rules are unchanged.
An outdated acceptance response cannot clear a newer fragment's invitation state.

## Privacy and limits

The exact `/invite` route receives private/no-store and no-referrer headers, as does the
existing API. It remains outside service-worker trip fallback and OfflineBootstrap.
No invitation secret is copied to localStorage, IndexedDB, cookies, or offline data.
The production/Vercel guard continues to return 503 before auth/database construction.

Inspected invitation client/service modules contain no intentional token/body logging.
The local production-build probe observed only `/invite` and `/api/invitations` for the
flow, no token in any request URL or browser console, and no page errors. This does not
prove request-body secrecy in all hosting, tracing, analytics, extension, or same-origin
JavaScript environments. A fragment is visible until client capture runs; JavaScript must
be available. Do not introduce analytics that read or serialize the initial fragment or
sessionStorage. Someone manually requesting an obsolete token-path URL can still expose
that path to a host; the application no longer generates or accepts that transport.

Hosted verification is deliberately pending: this candidate was not deployed. Previously
observed production Vercel request logs recorded the full old token path. No claim is made
that existing logs were removed or that hosted request-body redaction is solved.

## Validation

- Focused transport/invitation/auth/proxy/callback/offline/token run: 120 passed, four
  opt-in DB tests skipped in that run. Four further callback cases passed in the full run.
- Final full Vitest: 927 passed across 113 files; four local DB cases skipped.
- Opt-in local service/bridge lifecycle suite: all four passed separately.
- Fixed disposable local Docker SQL suite: 339 assertions and seven concurrency cases passed.
- Root `tsc --noEmit`: failed on pre-existing archived/fixture files under `output/`.
  Standard TypeScript passed in an isolated HEAD-plus-candidate copy, without changing tsconfig.
- Scoped ESLint and diff whitespace checks: passed.
- Isolated production build: passed with synthetic environment placeholders. Initial build
  required the existing service-role environment variable; no production credentials used.
- Local Edge lifecycle fixture uses real InvitationLanding/AuthProvider and synthetic
  auth/repository/API boundaries. Fresh fragment, cleanup, reload, separate plain tab,
  opener-cloned tab, cross-origin mock OAuth callback, explicit matching-account acceptance,
  and wrong-account switch/re-auth/accept all passed. 158 request URLs contained no raw token;
  no browser errors. Evidence: `output/invitations-phase25/browser-results.json`.
- Real local Next production build probe: PASS; `/invite` cleans, safe 503 unavailable UI,
  private/no-store/no-referrer headers, plain-tab empty state, no token URL/console exposure.
  Real Google OAuth and hosted Vercel logs were not exercised for this undeployed candidate.

## Later dormant hosted verification

With an existing Playwright installation available (or `PLAYWRIGHT_MODULE` pointing to it)
and optionally `BROWSER_EXECUTABLE`, run only after that dormant deployment is authorized:

```
node scripts/check-invitation-transport.mjs https://<approved-dormant-deployment>
```

The script generates a fresh fake token, never prints it, performs no sign-in/acceptance,
checks request URLs and privacy headers, and expects the production guard's 503. Inspect
Vercel request/runtime logs for that time window independently. Expect GET `/invite` and
POST `/api/invitations`, no token query/path and no captured body. This script cannot access
or certify hosting logs; review observability settings and any body-capture integrations.

## Changed files (relative to camping-dashboard)

- `src/app/invite/[token]/page.tsx` — deleted
- `src/app/invite/page.tsx` — new token-free route
- `src/app/auth/callback/route.test.ts`
- `src/components/invitations/InvitationLanding.tsx`
- `src/components/invitations/InvitationLanding.test.tsx`
- `src/lib/authContext.tsx`
- `src/lib/authContext.test.tsx`
- `src/lib/authRedirect.ts`
- `src/lib/supabaseProxy.ts`
- `src/lib/supabaseProxy.test.ts`
- `src/lib/invitations/contracts.ts`
- `src/lib/invitations/service.ts`
- `src/lib/invitations/service.test.ts`
- `src/lib/invitations/localLifecycle.test.ts`
- `src/lib/invitations/privacy.test.ts`
- `src/lib/invitations/session.ts` — new
- `src/lib/invitations/session.test.ts` — new
- `scripts/check-invitation-transport.mjs` — new
- `docs/trip-invitations-phase25.md` — this report

## Activation prerequisites remain

1. Authorize/apply production migrations.
2. Configure a real transactional delivery provider.
3. Durable delivery-status handling.
4. Rate limiting for inspection, creation, resend, and acceptance.
5. Dormant hosted-log verification, including request-body observability review.
6. Staged two-account Google OAuth QA.
