# Invitation page polish package

Baseline: `b854735bb174ce0f686d3dd1ad99f9c769bfd2b3`.

## Authoritative manifest

Exactly four application-relative paths:

```text
src/components/invitations/InvitationLanding.tsx
src/components/invitations/InvitationLanding.test.tsx
src/components/invitations/invitationLanding.css
docs/invitation-page-polish-package.md
```

The component imports its scoped stylesheet and uses existing committed auth,
session and invitation contracts. No new dependency, asset, global stylesheet,
server, auth helper, API or migration is needed. Output screenshots, fixture
servers, build artifacts and all unrelated local work are excluded.

## Scope

The invitation page owns an opaque dark pine surface, readable text and restrained
actions. The approved signed-out, Accept, wrong-account, terminal and error
presentations remain intact. Existing account identity is shown in the Accept state.

Expiry presentation uses the existing timestamp in the browser's local timezone:
for example, `Expires Sep 20 at 2:00 PM`. Seconds are omitted; missing or invalid
values omit the expiry line. Existing helpers cover date ranges or date-only
labels, so the timestamp formatter is local to this component. No lifecycle or
expiry calculation changes are included.

## Verification

Validate the baseline archive with only these manifest files overlaid, using the
existing locked dependencies and synthetic local build configuration:

- InvitationLanding, invitation session, token and API route tests: 98 passing.
- Standard TypeScript and scoped TSX ESLint.
- Production build (existing Google Fonts require network access).
- Scoped whitespace, secret/path scan and package byte comparison.
- Local synthetic Accept-state spot-checks at 390 and 1440 pixels: natural expiry,
  no horizontal overflow, approved layout retained.

No hosted access, invitation email, deployment or push is part of this package.

## Retained review items

- `ACCOUNT_SWITCH_SIGNOUT_SCOPE_REVIEW`
- `ORIGINAL_CREATOR_MUST_REMAIN_OWNER`
- `PRODUCTION_AVAILABILITY_BROWSER_CHECK_UNVERIFIED`
