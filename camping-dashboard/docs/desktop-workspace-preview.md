# Desktop workspace preview

The signed-out desktop hero uses one complete product illustration at
public/trips/desktop-workspace-preview.webp. The live frame owns SYSTEM / TRIP
READINESS and exactly two registration marks. All dashboard content, including
Invite, Trip essentials, and the sidebar footer, belongs to the image. Its alt
text describes the full static example. There are no focusable descendants.
The wilderness photograph, landing copy, Auth controls, sections, footer, and
phone composition are independent and unchanged.

## Maintained source and fictional state

The fixture lives in scripts/previews/workspace/, outside src/app. There is no
production-accessible preview route. WorkspacePreview.tsx composes the recovered
historical desktop overview and sidebar with fixture-only adapters. provenance.json
lists every recovered source file and local font hash. The 19 rendering snapshots
were recovered from the original ignored fixture at historical asset commit
f81f47d5c0479768f5aa949bd2c75c7c48b8277e. Rendering imports are relative to the
snapshot/adapters; shared application imports are type-only.

Historical recovery inputs: output/landing-phase2/fixture/src/app/preview-rich/page.tsx,
its authContext stub and historical compiled CSS/fonts; the initial preview/page.tsx
and provenance.txt established its lineage. The enriched and synthetic-map capture
scripts established the expanded forecast, fictional map injection, Reposition
label, DPR, and Sharp settings. Only required source/assets were recovered;
ignored output directories were not copied wholesale.

Fixed content: Pine Lake Weekend; Northwoods Park; Pine Lake · Site 4; Jul 5–8,
2027; four days/three nights; Demo camper; 88% readiness; day-one 09:00 trailhead
and 11:30 base-camp events; current weather 18°C, mainly clear, sunset 20:47;
five fixed forecast days; the designated-tent-pad notice; critical gear packed;
meals planned for each day; gear and meal preparation assigned. The map is
fictional geography. No real user/trip data is used.

The renderer and browser use 2027-07-04T12:00:00.000Z, America/Toronto, en-US.
Relative labels remain Trip is approaching and Updated just now. Fonts are local
recovered Latin WOFF2 bytes: Barlow Condensed 800; DM Sans 400/500/600/700;
Inter 400/500/600/700; JetBrains Mono 400/500/700; DM Serif Display 400.
The latter compatibility faces preserve the original project typography set.
OFL licenses are beside the fonts. The original project logo and topographic SVG
are read locally from public/. No font, weather, map, Auth, invitation, or other
hosted requests are allowed during capture.

Font license sources:
[Barlow](https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/OFL.txt),
[DM Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt),
[DM Serif Display](https://raw.githubusercontent.com/google/fonts/main/ofl/dmserifdisplay/OFL.txt),
[Inter](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt).
JetBrains Mono's license is copied from src/app/fonts/OFL-JetBrainsMono.txt.

## Capture workflow

Run from the camping-dashboard project directory after installing the existing
locked dependencies. Use an already available Playwright module and installed
Chrome; the harness never installs packages or browser binaries. On this desktop:

```powershell
$env:PREVIEW_PLAYWRIGHT_MODULE = 'C:/Users/jorda/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node scripts/previews/workspace/capture-workspace.mjs
```

The default destination is output/workspace-preview/unified/. The server binds
127.0.0.1 on an ephemeral port and is closed after capture. No client JavaScript
is served. External requests are aborted and fail capture. Runtime/resource
errors also fail it. Service workers, animation, transitions, and caret blinking
are disabled. Focus is cleared and the pointer moved outside the target. Capture
waits for fonts, image decoding, fixture readiness, and two stable geometry samples.

Product width is 1440 CSS px; viewport 1440 × 900; DPR 2. The explicit
[data-workspace-preview-capture] element is 1280 × 775.5 CSS px and scales the
product by 8/9 from its top-left origin. Playwright encloses that fractional
height in 776 CSS px; Sharp removes the single extra bottom device pixel. This
preserves product geometry rather than shrinking the entire capture. The saved
PNG and final WebP are exactly 2560 × 1551. Sharp encodes lossy WebP at quality 90,
without metadata. Dimensions, opacity, ICC, EXIF, and XMP are asserted.

The script writes source.png, candidate.webp, and report.json, never the public
asset. Review the candidate against the current composite at maximum width and
768px, then copy it deliberately into public/trips/desktop-workspace-preview.webp.
Keep intrinsic Image dimensions 2560 × 1551 and the simple width:100%, height:auto
normal-flow CSS. The Image is unoptimized because this WebP is already encoded
and sized deliberately. Next optimization at intermediate widths rounds its
height (the 1920px rendition changed the maximum frame by 0.15625px). Serving
the 147.89 KiB master directly preserves the exact 2560:1551 ratio and quality
without CSS compensation. Phones never mount/request this desktop image.
Do not add live dashboard overlays or spacing compensation.

## Reproduction gate and recorded output

Before adding unified content, the historical mode reproduced the immutable
released Git blob:

```powershell
node scripts/previews/workspace/capture-workspace.mjs output/workspace-preview/historical --historical
```

Historical pipeline: 1440 × 900 CSS px, DPR 2, expanded forecast, original map SVG,
Reposition label, 2880 × 1800 PNG resized to 2560 × 1600 WebP at quality 90.
Baseline: 494b7612e060df6f9ea608fa19868fe9f15b364e; tree
55b9c14ac19bc82eb74c67ba939cbd819135c801. Reference SHA-256:
e0d67ac883be7f327b5dd0e4fb669dec20679b95c7f9664632853248efa9ec46.

The reproduction was not byte-identical. Its decoded mean absolute channel
error was 0.0337522 on a 0–255 scale; 0.0426351% of channels differed by more
than 10. Sidebar, overview, identity, map, forecast, and notice geometry matched
the recovered source measurements. Fonts, wrapping, map placement, forecast,
borders, spacing, and pixel appearance were inspected without material drift.
The gate passed before Invite/essentials were added. Later adapter cleanup yielded
the same historical SHA-256 ae1294a82dee6e371ce895651485eaf327917d1c853de0cd96d939c6235702c4.
Historical mode always compares with the immutable Git blob, even after replacing
the public asset.

Current unified output: 2560 × 1551; 151442 bytes (147.89 KiB);
SHA-256 55fb39a9e9df8283ad8b5673203f3f18f417acc12cfb7fc2bd67cbcbd0b37676. It is opaque lossy VP8 WebP with no ICC/EXIF/XMP/alpha.
Recorded toolchain: Chrome 154.0.8037.99, Node 24.13.1, Sharp 0.34.5,
libvips 8.17.3, libwebp 1.6.0. Browser/encoder upgrades can
change bytes; compare geometry and decoded appearance before accepting updates.

## Updating product appearance

InvitePreview.tsx uses Lucide UserPlus 16px/stroke 2, an inert span labelled Invite.
Its resting CSS is copied from current TripAccessInvite/tripAccess.css: DM Sans
500 12px/1.4, 6px/10px padding, 6px gap/radius, transparent background, subtle night
border/text, right:0 and top:24px in the identity header. Unscaled dimensions are
approximately 75.046875 × 36px. Do not mount TripAccessProvider or permission/API
logic in the fixture.

TripEssentials.tsx copies the approved heading, icons, Gear/Meals/Crew columns,
and status text. unified.css preserves the original overlay colors, proportions,
typography, dividers, and spacing at the 1238px maximum interior presentation,
converted to 1440px source coordinates. The recovered sidebar supplies its own
Trip Extras/account footer. Footer sizing aligns it with the approved composite.
Keep these adaptations explicit; do not silently update the historical snapshots
from modern components. For an intentional change, review the authoritative
runtime appearance, update the local adapter, recapture, compare, and update the
asset/alt/contracts/output record together.

## Local validation boundary

Regression tests cover the single image, dimensions, alt, absence of overlays and
focusable controls, live instrumentation, phone isolation, opaque WebP chunks, and
capture isolation contract. Browser QA uses the real landing components/styles
with local image/Auth adapters; the Google callback is a spy and email is only
opened/closed. It never performs hosted Auth or sends email. Production build
results and full viewport evidence are recorded in the local implementation report.
