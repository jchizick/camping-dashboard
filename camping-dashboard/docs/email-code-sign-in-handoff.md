# Email-code sign-in: local implementation handoff

Date: 2026-10-02. Release is not authorized or ready.

## Checkout and scope

Worktree: `C:/Users/jorda/.codex/worktrees/email-code-sign-in/Camping Dashboard`.
Application: `camping-dashboard/`. Branch: `codex/email-code-sign-in`.
Implementation baseline: `147d9e9ce30203494785683e50de9322429d02e2`.
This handoff accompanies the reviewed, default-off local checkpoint; its resulting commit SHA is
reported separately. Completed local verification is recorded below; release remains unauthorized.
The pre-existing isolated landing commit is the baseline, not part of this feature diff.
The original workspace was not edited. No infrastructure backlog, migrations, environment files,
deployment bindings, package changes, or dependency/CLI upgrades were imported.
Landing review/integration remains a separate release dependency.

## Implemented

- `src/lib/emailCode.ts`: default-off build-time availability and neutral error mapping.
- `src/lib/authContext.tsx`: email code request and verification via the existing Supabase browser
  client, signup allowed, `type: email`, shared synchronous operation guard for Google, request,
  verification, sign-out and invitation switching. Conflicts are rejected, not queued.
  Verification finishes independently of dialog dismissal and refreshes server components after
  the SSR browser client completes session-cookie storage. Auth events reconcile actual identity;
  stale online/offline hydration cannot overwrite a later event. Initial stored-session events do
  not supersede the online `getUser` check. Invitation switching uses `scope: local`.
- `src/components/auth/EmailCodeDialog.tsx` and `emailCodeDialog.css`: one native modal per page,
  email/code steps, six-digit paste/autofill, resend cooldown, change email, neutral errors,
  focus containment/restoration, Escape/close, pending-operation visibility after reopening.
  Email/code are held in memory, not placed in URLs, analytics or application storage.
- `SignedOutLanding.tsx`, `DesktopSignedOutLanding.tsx`, `DesktopLandingSections.tsx`: gated email
  controls and FAQ wording, shared desktop CTA dialog, separate existing desktop/phone compositions.
- `src/app/trips/page.tsx`: keeps the dialog host mounted during verification; the existing trip
  resolver waits until verification settles. Google callback and safe destination logic are retained.
- `InvitationLanding.tsx`: resets view on identity/confirmation changes, reinspects using the
  server-visible session, invalidates old inspect/accept responses including their token deletion
  and redirect effects. Signing in stays on `/invite`; acceptance remains explicit.
- `src/lib/tripContext.tsx`: resets membership/data consumers when trip or user changes; ignores
  late work from a previous identity; cached access must match the current user.
- `src/lib/invitations/template.ts`: gated server-generated availability wording. Invitation
  token transport, trusted email confirmation, matching email and server-side authorization remain intact.
- `supabase/config.toml`, `supabase/templates/confirmation.html`, `magic-link.html`: local email
  confirmations, six digits, 600-second expiry, one-minute request frequency, signup retained;
  both templates use `{{ .Token }}` without authentication links. No hosted equivalents were changed.

Existing authorization still uses membership and trusted Auth confirmation, with no profile
subsystem or provider-specific account requirements. No passwords, manual linking, identity
manipulation, merging or account-disclosure workaround was added. Existing email/name fallbacks remain.

## Changed-file inventory relative to the baseline

Modified (16):

- `src/app/trips/page.tsx`, `src/app/trips/page.ui.test.tsx`
- `src/components/invitations/InvitationLanding.tsx`, `InvitationLanding.test.tsx`
- `src/components/trips/SignedOutLanding.tsx`, `DesktopSignedOutLanding.tsx`, `DesktopLandingSections.tsx`
- `src/lib/authContext.tsx`, `authContext.test.tsx`
- `src/lib/tripContext.tsx`, `tripContext.test.tsx`
- `src/lib/invitations/template.ts`, `deliveryInfrastructure.test.ts`
- `src/lib/invitations/session.ts`, `session.test.ts`
- `supabase/config.toml`

New (7), for 23 total changed/new files:

- `src/components/auth/EmailCodeDialog.tsx`, `emailCodeDialog.css`
- `src/lib/emailCode.ts`, `emailCode.test.tsx`
- `supabase/templates/confirmation.html`, `magic-link.html`
- This handoff document

## Mobile/browser closeout and final diff review (2026-10-02)

This section is the latest evidence. The earlier local pass below remains the historical record,
including its two token-bearing observations and their disposition. The earlier mobile blocker is
resolved; the completed backend expiry/database cycle was not repeated.

### Runner and measured viewports

The in-app browser's failed override was not repeated. The explicitly permitted fallback used the
already installed Playwright **1.61.1**, Chromium **149.0.7827.55**, headless, with isolated nonpersistent
contexts. No packages, browser binaries or dependencies were installed or upgraded. An initial blank
mobile page had the usual 980px layout viewport without a viewport meta tag; a probe with that meta
and then the actual app both measured exactly 390x844 before authentication.

| Requested viewport | Observed innerWidth x innerHeight | Visual viewport | Pointer/orientation | Actual landing composition |
| --- | --- | --- | --- | --- |
| 390x844 | 390x844 | 390x844, scale 1 | coarse, portrait | phone |
| 360x800 | 360x800 | 360x800, scale 1 | coarse, portrait | phone |
| 767x1000 | 767x1000 | 767x1000, scale 1 | coarse, portrait | phone |
| 768x1024 | 768x1024 | 768x1024, scale 1 | coarse, portrait | desktop |
| 768x500 | 768x500 | 768x500, scale 1 | coarse, landscape | phone, as the existing landscape rule requires |
| 1440x900 | 1440x900 | 1440x900 | fine, landscape | desktop |

The touch/mobile context used deviceScaleFactor 1; desktop used a separate fine-pointer context.
These are browser emulation results, not physical-device keyboard, clipboard or autofill verification.
No layout rules were changed to accommodate the runner. No horizontal overflow was measured in the
matrix. The desktop smoke check opened exactly one email dialog and dismissed it without authenticating.

### Actual mobile results and bounded timing checks

At 390x844, the real UI requested a local code, focused the field, showed six-digit/ten-minute
instructions and a disabled one-minute resend control, and displayed the neutral invalid-code error.
Forward/reverse Tab containment, Escape dismissal, focus restoration, cleared code on reopening and
formatted browser input were checked. All controls were reachable. The code dialog fit inside both
390x844 and 360x800; its error state also fit at 390x844. Masked screenshots were inspected.

A fresh invitation was created through a verified local owner's existing service/authorization bridge
and limiter, with delivery captured only into a private in-process variable. An accepted invitation was
not reused as evidence of pending acceptance. The browser first used the wrong confirmed account,
observed denial, switched accounts, and retained the token-free invitation route. Matching-email OTP
verification stayed on `/invite`, showed the intended editor invitation and did not accept it. The
owner-only management bridge confirmed a pending invitation and no invitee membership before the click.
Pending-state reload and 360/390 invitation layouts passed. Explicit acceptance granted editor membership,
opened the intended trip and survived reload without the previous account's trip presentation.

Two timing checks used real local responses underneath controlled delays, with no new proxy or endpoint:

1. Held the successful verification **POST** response, dismissed and reopened the dialog to verify its
   guard remained active, dismissed again, then released the response. Authentication completed and the
   correct trip/session survived reload. OPTIONS preflight was excluded from the final delay handler.
2. Held a real **signed-out inspection** response while matching-user verification established the new
   session and pending invitation view, then released it. The current view and recovery storage remained
   intact. Existing identity teardown could abort the old browser request; the check accepts that valid
   cancellation path as well as harmless late delivery. It does not claim an uncancelled old-user terminal
   response was processed. Existing mock tests remain the evidence for terminal stale inspect/accept
   payloads and redirect/token-deletion suppression.

All invitation URLs remained token-free after capture, verification refresh and reload. Tokens, codes,
cookies and keys stayed in memory in this closeout. No token-bearing fixture page was rendered. Tracing,
HAR, video, request/console logging and storage-state export were disabled; code screenshots masked inputs.
The prior token-observation incident is retained below, not replaced by a blanket historical claim.

### Correction, diagnostic limits and final review

One application defect was demonstrated: HTML `maxLength=6` truncated spaced input before normalization,
so a formatted six-digit code could become five digits. Removed that premature input limit; the existing
change handler still strips non-digits and caps at six, with six-digit form/helper validation unchanged.
The real browser's formatted insertion then passed. The focused regression now checks exact normalized
values for spaced input and a hyphenated value containing an extra digit. No architecture, schema,
identity-linking, availability-default or composition changes were made.

Early browser-run assertions were corrected to scope errors to the dialog (excluding Next's route
announcement) and to avoid desktop-only text assumptions. A subsequent authenticated trip route returned
404 even after full reload. The source and passing production manifest contained the route. Restarting
only this task's dev server with the prior working IPv4 loopback bind restored a 200 authenticated route
preflight and the complete browser flow passed. Browser origin stayed `http://localhost:3145` throughout;
no origin policy was weakened. This establishes resolved local dev-server state, not a proven root cause
for the transient 404. No routing change was made to mask it.

Final diff review against `147d9e9` covered shared operation locks/finally release, auth-event reconciliation
and stale hydration, identity-bound trip resolution/cache consumers, invitation generations and explicit
acceptance, public history integration, default-off Google continuation/wording, and separate phone/desktop
composition. No additional actionable application defect was demonstrated. Existing Google/mock regressions
were retained; no real Google OAuth or OAuth-only fixture was attempted.

Fresh checks in this closeout:

- **130 tests passed** in eight affected auth, email, invitation, trip/cache, landing and phone-layout files.
- The final real-browser closeout passed, including the matrix, main mobile flow and two bounded timing checks.
- **Production build passed** with feature availability unset, invitations disabled and synthetic unreachable
  local service values. **Standard TypeScript passed** (`tsc --noEmit --incremental false`, including
  generated Next route types); **ESLint passed** for all changed/new TS/TSX files; **diff check passed**.
- The earlier **267-test** suite and separately retargeted **20 database tests** remain prior evidence, not
  reruns in this closeout. The 610-second expiry check was not repeated.

At the end of the browser closeout, the inventory was **16 modified + 7 untracked feature files (23 total)**, listed above. The tracked
baseline diff remains +268/-54; this closeout's application edits are in the already-untracked dialog
and email regression file. HEAD/branch were unchanged during that closeout; no infrastructure history was imported. A final ancestry check found
zero intersection between the feature history and the 48 distinct local-master-only commits outside
the remote-master/isolated-landing baseline (the 47 infrastructure commits plus local landing checkpoint).

### Resources and checkpoint decision

The retained project, exact 34 migration versions, Auth image and effective local Mailpit SMTP/no-hook
settings were rechecked before requests. App credentials and feature enablement were process-local;
invitation delivery stayed at the local capture boundary. No replacement stack or network was created.
Only the eight initially stopped task containers and task app process were started. Abandoned pending
mobile test invitations were revoked through the existing authorized bridge before the final fresh
fixture. The successful new editor membership and accepted invitation remain in the isolated test data.

Temporary browser-test code/config is removed. Sanitized measurements and masked/secret-free screenshots
remain ignored under `output/playwright/email-closeout/`; temporary browser contexts were closed. Shared
feature defaults remain disabled. Final inspection confirmed **zero task app listeners and zero running
project containers**. Both task-started dev-server instances were stopped; retained volumes, networks
and test data remain. No unrelated services were stopped.

The patch is **ready for a reviewed, default-off local checkpoint** with the final checks passed.
No outstanding mobile acceptance defect remains in the tested Chromium emulation. Physical-device behavior,
other browser engines, broader race interleavings, hosted Auth/SMTP/deployment access, real-provider
compatibility and landing integration remain separate review/release boundaries. The browser closeout
did not create a commit. The subsequent authorized local checkpoint includes these 23 files and only
checkpoint-documentation edits after verification; application content is unchanged. It is not release
or production-enablement approval.

### Reproducing the separate local database test run

The ordinary test command does **not** execute the retargeted database tests. Do not simply set
`INVITATION_LOCAL_DB_TEST=true` on the original files: they name `supabase_db_invitation-phase1-test`.
Before a separately authorized rerun, inspect both complete tests again, stop concurrent invitation tests,
and confirm the retained task DB identity/network/volume and exact migration versions. These existing
fixtures insert ordinary confirmed email users and remove their own named rows; lifecycle tests clear the
isolated rate-limit table. They must never target another checkout's DB or manufacture OAuth identities.

From this application directory, the following Python recipe creates unique ignored copies and keeps the
original test files untouched. Run it only after those checks and while the intended local DB is running:

```python
from pathlib import Path
import json, os, subprocess, uuid

project = 'email-code-local-20261002'
target = 'supabase_db_' + project
container = json.loads(subprocess.check_output(['docker', 'inspect', target]))[0]
assert container['State']['Running']
assert set(container['NetworkSettings']['Networks']) == {'email-code-local-host-20261002'}
assert any(m.get('Name') == target for m in container['Mounts'])
versions = subprocess.check_output([
    'docker', 'exec', target, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres',
    '-c', 'select version from supabase_migrations.schema_migrations order by version'
], text=True).strip().splitlines()
assert versions == sorted(p.name.split('_')[0] for p in Path('supabase/migrations').glob('*.sql'))

folder = Path('output') / ('db-recheck-' + uuid.uuid4().hex)
folder.mkdir(parents=True, exist_ok=False)
files = []
try:
    sources = [
        ('src/lib/invitations/localLifecycle.test.ts', 'localLifecycle.test.ts', {
            "from './service'": "from '@/lib/invitations/service'",
            "from './delivery'": "from '@/lib/invitations/delivery'",
            "from './rateLimit'": "from '@/lib/invitations/rateLimit'",
            "from '../tripInvitationToken'": "from '@/lib/tripInvitationToken'",
        }),
        ('src/app/api/invitations/removalLocal.test.ts', 'removalLocal.test.ts', {
            "from './route'": "from '@/app/api/invitations/route'",
        }),
    ]
    for source, name, imports in sources:
        text = Path(source).read_text(encoding='utf-8')
        assert 'supabase_db_invitation-phase1-test' in text
        text = text.replace('supabase_db_invitation-phase1-test', target)
        for old, new in imports.items():
            assert old in text
            text = text.replace(old, new)
        destination = folder / name
        destination.write_text(text, encoding='utf-8')
        files.append(destination)
    config = folder / 'vitest.local.config.ts'
    config.write_text(
        "import {defineConfig} from 'vitest/config'; export default defineConfig({"
        "resolve:{tsconfigPaths:true},test:{environment:'node',fileParallelism:false,"
        "mockReset:true,restoreMocks:true,include:[" +
        json.dumps(folder.as_posix() + '/*.test.ts') + "]}});", encoding='utf-8')
    files.append(config)
    env = dict(os.environ, INVITATION_LOCAL_DB_TEST='true')
    result = subprocess.run(['node', 'node_modules/vitest/vitest.mjs', 'run',
                             '--config', str(config)], env=env, capture_output=True, text=True)
    # Full output remains in memory; do not dump SQL/fixture errors containing private parameters.
    for line in result.stdout.splitlines():
        if line.strip().startswith(('Test Files', 'Tests ', 'Duration ')):
            print(line)
    assert result.returncode == 0, 'Local DB run failed; inspect diagnostics privately and sanitize findings'
finally:
    for file in files:
        file.unlink()
    folder.rmdir()  # only the new empty directory, never recursive cleanup
```

## Local verification and corrective pass (2026-10-02)

Historical status at the end of the earlier pass: the real local Auth/session/invitation evidence gap
was substantially closed; responsive mobile and browser timing checks were still open. The closeout
section above supersedes those two gaps. This is not a hosted readiness claim. Earlier mock-only/Docker-blocked findings are superseded by this section.

### Runtime and isolation

- Docker Desktop Linux engine was available (server 29.6.1, context `desktop-linux`). Existing stopped
  invitation/recovery stacks and the existing `camping-dashboard` volume were not reused or modified.
- New project `email-code-local-20261002`, API `http://127.0.0.1:55421`, DB port 55422,
  mail capture port 55424. The task-only directory `output/email-code-local-20261002/supabase`
  holds a local config copy, exact baseline migrations/templates and empty seed. No `.env` or deployment
  bindings were copied. Exact migration-version comparison found all 34 baseline migrations and no extras.
- Default Docker pool allocation failed because existing pools were exhausted. After read-only network
  and route inspection, task-only networks were allocated: `email-code-local-20261002` (10.233.47.0/24,
  internal, unused after published DB connectivity failed) and `email-code-local-host-20261002`
  (10.233.48.0/24, used successfully). No existing network, volume or database was reset or removed.
- Auth image `public.ecr.aws/supabase/gotrue:v2.192.0`; mail image
  `public.ecr.aws/supabase/mailpit:v1.30.2`; CLI 2.109.1; Auth JS 2.98.0; SSR 0.9.0; Next 16.1.6.
- Before requests, runtime inspection verified SMTP host `supabase_inbucket_email-code-local-20261002`,
  port 1025, no SMTP password, no enabled email hook or configured hook URI, and only the task network.
  Effective confirmation was required; OTP length 6, expiry 600 seconds, frequency one minute.
  Effective CLI local `GOTRUE_RATE_LIMIT_EMAIL_SENT` was 360000, not a hosted quota assurance;
  request/verification throttles and the per-recipient resend limit remained active. Nothing was
  weakened to accelerate expiry. CLI also emitted a pg-delta cache-export connectivity warning;
  startup and exact migration verification subsequently succeeded.
- Browser app used process-local local keys, email flag enabled and the existing local invitation
  delivery sink. No Resend configuration or external delivery was used. Next dev canonicalizes the
  request URL to `localhost`: invitation POSTs from `127.0.0.1:3145` failed `invalid_origin` (403),
  while `localhost:3145` passed the unchanged origin check. This was an environment mismatch, not a
  reason to weaken authorization. Initial trip-cookie checks used 127.0.0.1; invitation checks used localhost.

### Actual local evidence

| Check | Result and limit |
| --- | --- |
| New-user Auth | Supported `signInWithOtp` and `verifyOtp(type: email)` delivered locally and established a confirmed user. |
| Returning-user Auth | Local sign-out, another code and verification retained the same UUID and owner membership through RLS reads. |
| Both templates | Captured confirmation and returning magic-link paths contained six-digit codes, ten-minute instructions and no authentication links. |
| Invalid/reused/expired codes | Invalid and reused codes rejected; actual expiry rejected after 610 elapsed seconds with the unchanged 600-second runtime setting. No mock expiry is substituted. |
| Resend | Immediate supported API retry rejected with `over_email_send_rate_limit`; browser displayed the one-minute cooldown. |
| Server-visible cookies | Browser OTP sign-in created a trip through cookie-authenticated `POST /api/trips/create` (201); authenticated `GET /api/invitations` returned 200. This establishes server auth recognition, not a claim that every client-rendered trip field is server-rendered. |
| Trip/session reload | New browser user created `Local browser continuity`; full reload retained account and trip. Accepted invitee likewise retained `Local OTP continuity` and the correct account after reload. |
| Invitation setup | A separately verified local owner called the existing service/bridge/limiter. Only the delivery boundary was captured in memory and served by a temporary loopback fixture page. No production endpoint was added. |
| Wrong email / switch | Wrong confirmed browser account was denied. Local-scope switch retained the invitation and returned to signed-out invitation UI without the former identity/trip. |
| Matching email | Verification stayed on `/invite`, re-inspected, displayed the editor invitation, and did not accept. Read-only SQL confirmed one pending invitation and zero invitee memberships before the click. Reload retained the pending invitation and matching identity. |
| Explicit acceptance | Browser click granted exactly editor membership, navigated to the intended trip, and reload retained access. The old account and old trip were absent from the new workspace. |
| Sign-out / return | Sign-out removed prior account/trip presentation. Returning invitee could authenticate again and see existing access. |
| Stale inspect/accept / event races | Focused mock regressions passed; identity-keyed teardown, aborted inspection, generation checks and trip-cache guards reviewed. Deliberately delayed real browser responses were not injected, so this specific timing evidence remains mocked. |
| Desktop browser | Actual empty code step and invitation states inspected at the observed 1280x720 viewport, with focused input, readable instructions and reachable controls. No real code was included in screenshots. |
| Mobile browser | Attempted 390x844 and 1440x900 overrides did not change actual rendered screenshot size; extended DOM locator surface also failed to address the native tab. No new mobile code-step/invitation pass is claimed. Prior email-step/breakpoint results remain historical only. |
| Google-like fixture / real Google | Not performed; no supported faithful OAuth-only fixture mechanism established. No managed Auth identity manipulation or real Google OAuth was used. |

### Demonstrated corrections

1. Resend could briefly read **61 seconds** when issuance completed between timer ticks. Cap the display
   at 60; the existing Auth helper and server cooldown still enforce eligibility. Added a focused regression.
2. OTP `router.refresh()` could restore a removed invitation fragment because `captureInvitationSession`
   forwarded Next's internal history state. Use the public `history.replaceState(null, '', '/invite')`
   integration so Next updates its canonical URL and preserves its own internal state. No internal fields
   are edited. Added a regression; a fresh-fragment returning-user browser verification then kept the
   token-free `/invite` URL and showed existing access.

Two synthetic local invitation URLs appeared in tool observations: one automatic fixture-page snapshot,
then the restored-fragment defect. The first was revoked through the verified owner's authorization
bridge before replacement; the second was explicitly accepted and no longer pending. Read-only SQL
confirmed one revoked and one accepted invitation, with only the intended editor membership. No code,
Auth cookie, access/refresh token or hosted credential was output. The handoff and screenshots contain
no invitation tokens. This observation lapse is recorded rather than claiming perfect token-log hygiene.

### Regression and build checks

- Final focused suite: **267 passed**, 18 passing files; five opt-in lifecycle tests skipped in the
  ordinary run because the local-DB opt-in was unset. Earlier run without required synthetic public
  Supabase values had 240 passes and one import-time environment failure; rerun with safe values passed.
- Separately, **all 20 previously skipped local database tests passed** in two reviewed temporary copies
  retargeted only to `supabase_db_email-code-local-20261002`. These exercise actual SQL/service behavior;
  the removal route tests still mock session transport. Their existing ordinary-email Auth fixture
  inserts were not repurposed into OAuth identities. They cleaned only their named fixture rows in the
  isolated DB; limiter cleanup ran before browser invitation checks. Original hard-coded files unchanged.
- Google callback/redirect, flag-off behavior, operation-guard release, verification after dismissal,
  auth-event ordering, stale identity/cache results, invitation privacy, landing and typography checks
  are included. No shared-code regression was demonstrated beyond the two corrections above.
- Production build **passed**, including Next generated route validation and page generation. Standard
  `tsc --noEmit --incremental false` **passed**; ESLint on every changed/new TS/TSX file **passed**.
  `git diff --check` passed. The tracked diff is 16 files, +268/-54; seven new files are listed above.
  The first build compiled and passed Next TypeScript but page-data collection needed the existing
  required service-role environment variable. Rerun uses an unreachable loopback endpoint and synthetic
  public/service keys, with email availability unset and invitations disabled. No production key used.

### Cleanup and retained local resources

Dev app (3145), in-memory invitation fixture server (3146), OTP harness and database test processes
are stopped. The eight task containers (db, auth, kong, rest, inbucket, storage, pg_meta, analytics) were
stopped explicitly (final inspection: zero task containers running and zero app listeners on 3145/3146); no unrelated service was stopped. Both task networks and all task volumes are
intentionally retained, including isolated test accounts/trips and invitation records. No volumes were
removed or pruned. Temporary TypeScript fixture copies/config were removed. The ignored isolated
Supabase config/migration/template copies and nonsecret OTP harness remain for reproducibility; they do
not alter shared project settings. Browser viewport override was reset. Mail and delivery tabs were
closed; app-tab cleanup encountered a browser-policy error after its server stopped and it was not
marked to persist. No persistent feature-enable or environment override remains.

## Compatibility evidence and deferred checks

Email-created -> Google: automatic same-email OAuth linking remains the documented expected behavior
for eligible verified accounts, subject to later real-provider verification.

Google-created -> email code: existing-user authentication is the evidence-backed working hypothesis
from the previously inspected upstream implementation, not a documented universal Supabase contract.
Public documentation is less definitive. Neither universal success nor universal failure is assumed.
Installed local Auth behavior for a Google-created/OAuth-only account remains unverified here. Later successful checks must establish actual
delivery/login, UUID continuity, preserved trips/roles/authorization and observed identity representation;
creation of an `email` identity is not required.

A safely created local Google-like fixture would establish only local Auth behavior for that simulated
account shape, never real Google OAuth behavior. Do not mutate `auth.users`, `auth.identities`, or other
managed Auth internals, or add Admin identity manipulation merely to manufacture it. If the existing
supported local mechanisms cannot represent it faithfully, retain the evidence gap and defer to the
separately authorized real-provider launch phase. Do not block independent email-code development for
that fixture alone. Classify failures as application, configuration, delivery, or confirmed platform
behavior; do not accept every failure as a platform constraint.

## Read-only hosted audit

Previously verified through authenticated connectors on this date; not repeated during this local pass:

- Supabase project `Camping Dashboard` (`gdsmyxzqtmhwbcyobzou`) is `ACTIVE_HEALTHY`.
- `field-protocol-staging` (`mgnkvfohpqixgacszovv`) is `INACTIVE`; it was not resumed.
- Repository operational documents identify those as production/staging respectively. This is recorded
  mapping evidence, not verification of the environment bindings in a current Vercel deployment.
- Resend `mail.fieldprotocol.online` and `staging-mail.fieldprotocol.online` are verified for sending;
  receiving is disabled; open/click tracking is false. The connector reports their DKIM/SPF records
  verified. This does not prove that Supabase Auth uses either domain or Resend at all.
- Vercel connector returned no accessible teams. Current deployment/environment bindings were not available.
- Installed local client tooling is Auth JS 2.98.0, SSR 0.9.0, CLI 2.109.1. These are not the hosted Auth
  server version; that version remains unknown. No dependency versions were changed.

Unverified because safe Auth configuration read access is unavailable in the exposed connector and no
management token is available in this task's process environment:

| Setting | Status / required evidence before enabling |
| --- | --- |
| Effective Auth delivery | Unknown: determine built-in SMTP, custom SMTP, or an overriding send-email hook. |
| SMTP | Enabled state, host, port/TLS, username, From name/address/domain, credential presence all unknown. Credential validity and mailbox delivery require later separately authorized verification. |
| Email Auth | Provider/signup/confirmation/passwordless controls unknown. |
| Templates and OTP | Hosted confirmation/magic-link templates, six-digit length, ten-minute expiry and resend frequency unknown. Local files do not prove hosted application. |
| URL configuration | Site URL and allowed redirects unknown; existing Google flow must remain valid. |
| Abuse protection | Sending/request/verification limits, quotas and CAPTCHA unknown. If CAPTCHA is enabled, token integration is a prerequisite; if disabled, record a launch decision. No protection was changed automatically. |
| Provider/DNS | Provider quotas, effective sender alignment, TLS policy and mailbox placement unverified. Prior user-reported invitation spam/DMARC failure remains unresolved; verified DNS records do not prove it fixed. |

Only project inventory and domain settings were read. No complete secret-bearing Auth configuration was
retrieved or printed. The audit intentionally does not equate SMTP presence with valid credentials or
successful delivery. No external emails or hosted authentication tests occurred.

Current public references used:

- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Local templates](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Changelog](https://supabase.com/changelog): checked relevant Auth/email breaking changes, including
  the default-SMTP template restrictions for newly created free projects. Applicability to the deployed
  project's effective transport/plan has not been established.

## Availability and release gates

`NEXT_PUBLIC_EMAIL_CODE_SIGN_IN_ENABLED` is false unless explicitly set to the exact string `true`.
It gates UI, helpers and availability wording. It is a Next.js build-time application-availability flag,
not a provider-level security boundary or runtime kill switch; changing hosted availability requires a
new build. No shared `.env` or deployment binding was created. Preview overrides were process-local;
preview servers are stopped at handoff. Ignored `.next/dev` files may contain the earlier enabled
preview bundle; the production build was created with the flag unset. No persistent override remains.

Still required before release:

1. Review the final local patch and recorded browser evidence. The bounded Chromium mobile flow and
   two real-response timing checks passed; broader interleavings and terminal stale-response payloads
   retain the explicit mock-only limits above. No local verification result substitutes for hosted QA.
2. Obtain safe Auth configuration and deployment-binding read access; resolve the audit gaps and any
   CAPTCHA prerequisite. Apply hosted changes only under separate authorization.
3. Later authorized delivery checks, mailbox placement/alignment, rate limits, and real Google/email
   compatibility including UUID/authorization continuity. No launch claim follows from mocks.
4. Review/integrate the isolated landing dependency and obtain release review of this default-off checkpoint.

No new migration prerequisite was demonstrated.
`20260921200943_bound_invitation_rate_limit_cleanup.sql` was not imported. Hosted application remains unknown and the
invitation cleanup/release concern remains separate; do not import the 47-commit infrastructure backlog.

The implementation and verification phases created no commit. The subsequent checkpoint phase authorizes
one local commit only. No push, merge, deployment, promotion, hosted configuration change, credential
change, hosted migration, hosted user creation, hosted authentication, project resume, external email,
or production enablement was performed.
