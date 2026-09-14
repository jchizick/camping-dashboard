# Trip Access UI package

Approved baseline: `f2d94d233e27d24d96c2f81b52b2fdf9092c0d45`.
Commit shape: one self-contained feature commit, `feat: add trip access management UI`.

## Authoritative manifest

Exactly **10 paths**, relative to this application directory (`camping-dashboard/` in the repository). This manifest includes itself.

| Path | Category | Purpose / dependency reason |
| --- | --- | --- |
| `src/components/home/DesktopWorkspaceOverview.tsx` | UI SOURCE | Mounts the secondary Owner Invite control in the existing desktop identity header. |
| `src/components/trip/TripAppShell.tsx` | UI SOURCE | Mounts access state beneath existing providers; gates presentation with Owner and online workspace state. |
| `src/components/trip/TripMoreMenu.tsx` | UI SOURCE | Adds the phone More entry and transfers focus into the shared access sheet. |
| `src/components/trip/access/TripAccessProvider.tsx` | UI SOURCE | Shares availability/open action with the two entry points and composes the sheet. |
| `src/components/trip/access/TripAccessSheet.tsx` | UI SOURCE | Invite form, roster, pending expiry, confirmations and focus restoration using existing CrudSheet. |
| `src/components/trip/access/useTripAccessManagement.ts` | UI SOURCE | Calls existing product APIs; loading/errors, duplicate prevention, actual Retry-After cooldown, mutation then refresh. |
| `src/components/trip/access/tripAccess.css` | UI SOURCE | Scoped desktop/phone presentation, approved CTA alignment, wrapping and destructive interaction states. |
| `src/components/trip/access/TripAccess.test.tsx` | UI TEST | Durable synthetic response tests for permissions, dormancy, form, roster, expiry, actions, errors, cooldown and phone/focus behavior. |
| `src/components/trip/access/tripAccessContract.test.ts` | UI TEST | Owner/online integration contract, existing phone layout, bottom-nav preservation and Crew independence. |
| `docs/trip-access-ui-package.md` | DOCUMENTATION | Authoritative manifest, closure, validation and retained follow-ups. |

No EXISTING INTEGRATION TEST files were changed. Existing Home, workspace, More, phone-layout, invitation, removal, management and Crew tests were run unchanged from the baseline.

## Dependency closure

The nine source/test paths recursively resolve 116 local files. Every dependency exists in the committed baseline or the listed candidate; none is an omitted untracked helper. CSS imports resolve, including the existing sheet/workspace material system. Runtime uses only existing React/Next and lucide dependencies. The management DTO is a type-only import from committed invitation contracts. No package/dependency update is needed.

The tests contain their own synthetic fetch responses. They do not import ignored browser fixtures, screenshots, review notes, hosted credentials or sessions. No machine-specific path is required. An archive of the exact baseline plus only the nine candidate files passed the clean-source checks; this documentation was then added to that candidate. Existing dependencies were reused without copying local environment files or unrelated source modifications.

## Preserved contracts

- Desktop secondary Invite opens the existing right-side CrudSheet; phone Trip access lives in More. No sidebar or bottom-nav destination was added.
- Viewer/Editor have no management entry. Owner rows have no removal or role-change control.
- Availability GET must explicitly return `tripAccessAvailable: true`. False/failure exposes no Invite, phone entry or sheet and sends no `list_access` request. Current production remains dormant; no production endpoint was contacted to verify this.
- Only existing `/api/invitations` operations are used: GET availability, POST `list_access`, `create`, `resend`, `revoke`, `remove_access`. Server authorization is unchanged.
- Viewer defaults; Editor is selectable. Safe errors, pending state and duplicate guards remain. HTTP 200 with failed/unknown delivery never claims sent. Actual Retry-After drives cooldown.
- Memberships and pending invitations come from the server snapshot. Successful mutation refreshes it. No polling, realtime or optimistic roster was added.
- Expiry uses the browser locale/timezone, with invalid dates omitted. Null email remains Unknown member; pending empty state remains inline.
- Revoke/remove remain neutral at rest, using existing danger tokens for interaction and confirmation. Confirmation, Escape, focus return and phone touch targets remain.
- Trip Access is independent of Crew. Removing access does not modify Crew or responsibilities; the confirmation states this explicitly.

## Clean-source validation

- Relevant Vitest gate: **436 passed, 20 environment-gated skipped**, across 41 passing and 2 skipped files. Includes 32 Trip Access/contract tests and existing invitation API/server, management, removal, workspace/phone/More, Home and Crew coverage. No live email or hosted QA.
- Standard `tsc --noEmit`: PASS.
- Scoped ESLint: PASS.
- Production `npm run build`: PASS, 13 static pages generated. Required environment values were synthetic placeholders with a localhost Supabase URL. Existing Google font downloads were allowed; no hosted project credentials were used. Nested archive placement produced a non-failing Next multiple-lockfile warning.
- Scoped whitespace/diff and secret/path checks: PASS.
- Prior approved eight-width visual study retained. Clean-candidate local fixture spot-checks at 1280, 1440, 390 and 768 confirm the approved layout and no horizontal overflow. The fixture uses actual changed components with synthetic Owner eligibility/data and simplified surrounding navigation; it is not hosted auth QA.

## Excluded work

LOCAL / EXCLUDED: all `output/` content, including Trip Access screenshots, temporary baseline archives/candidates, fixture servers, validation scripts and review notes. These are evidence only, never application/test dependencies and never part of this commit.

UNRELATED: the following 28 pre-existing paths remain byte-for-byte unchanged and excluded:

- `src/app/globals.css`
- `src/app/mobileTypographyApplication.test.ts`
- `src/components/home/MobileHomeOverview.test.tsx`
- `src/components/home/ReadinessGauge.tsx`
- `design-qa.md`
- `docs/our-adventures-image-preflight.md`
- `docs/privilege-normalization-package-audit.md`
- `docs/staging-catalog-diagnosis.md`
- `docs/staging-function-grant-diagnosis.md`
- `docs/staging-preparation.md`
- `docs/staging-privilege-normalization.md`
- `docs/staging-type-diagnosis.md`
- `public/C7BD79FC.jpg`
- `public/SCHABO-Condensed.woff2`
- `public/green_trees_topographic_bg.png`
- `public/sunset-camp-fire.png`
- `scripts/offline-reliability-browser.cjs`
- `scripts/staging/discover-credentials.ps1`
- `scripts/staging/memories-in-page-probe.js`
- `scripts/staging/memories-in-page-probe.test.mjs`
- `scripts/staging/memoriesImagePreflight.mjs`
- `scripts/staging/memoriesImagePreflight.test.mjs`
- `scripts/staging/our-adventures-baseline.sql`
- `scripts/staging/run-vercel-prep.ps1`
- `scripts/staging/sqlLocalPreflight.mjs`
- `scripts/staging/vercelPrep.mjs`
- `scripts/staging/vercelPrep.test.mjs`
- `scripts/staging/vercelPrepRunner.mjs`

## Retained follow-ups / release boundary

- `ORIGINAL_CREATOR_MUST_REMAIN_OWNER`: ownership management and hidden-invitation uniqueness reservation remain deferred.
- `ACCOUNT_SWITCH_SIGNOUT_SCOPE_REVIEW`: no authContext or Switch Account change.
- `PRODUCTION_AVAILABILITY_BROWSER_CHECK_UNVERIFIED`: no production browser or API check in this task.

This package changes no server contract, authorization, database, migration, auth, offline/PWA or Crew logic. Packaging authorizes a local commit only, not push, deployment, hosted access, project pause/resume or email.
