# Camping Dashboard — Current Interface System

> Extraction date: 2026-08-09. This document records the implementation currently present in the working tree. It is an audit, not a redesign specification. The Expedition Home dashboard is the canonical visual reference. Values described as patterns are repeated or explicitly tokenized; isolated values remain identified as one-offs.

## Direction

- Product character: immersive backcountry expedition control rather than a generic administration dashboard.
- Primary visual anchor: full-viewport outdoor photography (`/sunset-over-the-lake.webp` for the approved Algonquin/Maple Lake identity), with a topographic texture and theme-specific atmospheric overlay. Unknown trips use a green/blue/amber gradient fallback.
- Operational content sits above the scene in dark, translucent green-black glass. Structure is expressed with restrained low-alpha borders, tonal surface shifts, and deep soft shadows.
- Information is deliberately dense: the Home view combines a trip hero, four-metric situation rail, Map, Weather, Readiness, Day Plan, and Priority Notice.
- Workspace-summary cards and the standalone Home footer pill are removed at every viewport; persistent navigation owns Plan, Gear, Crew, Guide, and Field Log access.
- The established signature is the combination of expedition photography, serif trip naming, field-status language, topographic atmosphere, and operational green/blue/amber signals.
- Expedition Home uses its own route-scoped semantic color contract. Do not replace it with generic global accent utilities when polishing Home.

## Implementation Scope and Authority

- Theme and global styling: `camping-dashboard/src/app/globals.css`.
- Font setup: `camping-dashboard/src/app/layout.tsx` and the opening `@import`/`@theme` declarations in `globals.css`.
- Shared trip shell: `TripAppShell`, `TripSidebar`, `TripPrimaryNav`, `TripMobileNav`, `TripMoreMenu`.
- Home composition: `HomeOverview`, `TripHero`, `TripSituationRail`, `TodaySummaryCard`, `ReadinessSummaryCard`, `PriorityAlertCard`, plus Home variants of `MapRouteCard` and `WeatherCard`.
- Shared card primitive: `camping-dashboard/src/components/ui/Primitives.tsx`.
- Current theme application: `ThemeProvider` adds `theme-expedition` or `theme-clean` to `<html>` and adds `dark` for night mode. Trip settings are authoritative after load; fallback is Expedition/night.
- CSS cascade order matters. Later Home color/glass rules and the final `@media (min-width: 1440px)` block override parts of earlier Home rules.

## Layout

### Workspace shell

- `<1280px`: one content column with a top app header.
- `>=1280px`: immersive two-column shell with `1rem` outer padding and `1rem` column gap; sticky full-height sidebar replaces the top header.
- Sidebar width: `11rem` (176px) at 1280–1439; `13rem` (208px) at `>=1440px`.
- Sidebar height: `calc(100dvh - 2rem)` with a `34rem` minimum; sticky offset `1rem`.
- Main surface: `min-height: calc(100dvh - 2rem)` and `--radius-hero` (`1.5rem` / 24px) at `>=1280px`.
- Shared shell/header inner cap: `max-width: 1600px`, centered.
- Trip section routes: `max-width: 1600px`, centered, with `1rem / 1.5rem / 2rem` page padding at base / `md` / `lg`.

### Home container

- `.home-overview` base cap: `width: min(100%, 1536px)`, centered.
- Very-large-desktop Home cap: `width: min(100%, 1600px)` at `>=1800px`. The wider cap improves viewport fill while preserving 32px of internal main-column breathing room per side at 1920px and maintaining the established photographic atmosphere.
- Base padding: `1.25rem 1.5rem` (20px vertical, 24px horizontal).
- Mobile (`<=767px`) padding: `0.75rem 0.75rem 1.5rem` (12px / 12px / 24px).
- Approved portrait-tablet mode (`768–1023px` wide, `orientation: portrait`): the 72px icon-only top-navigation model remains unchanged. Heading top padding is 42px and the Hero → Situation Rail gap is 24px; Home retains its base 24px horizontal padding.
- Approved compact-landscape mode (`1024–1279px` wide and `<=800px` high): the 80px top-navigation model remains unchanged; Home padding becomes `0.75rem 1.5rem 0.25rem` (12px / 24px / 4px), and heading padding becomes `2.5rem 2rem 0.75rem` (40px / 32px / 12px). Hero typography is unchanged and the Hero → Situation Rail gap is 16px.
- Approved short-desktop mode (`1280–1439px` wide and `<=800px` high): Home padding becomes `0.75rem 1rem 0.125rem` (12px / 16px / 2px); heading padding becomes `2.25rem 2.5rem 0.625rem` (36px / 40px / 10px), with no separate heading bottom margin.
- `>=1440px`: Home padding becomes `0 0 0.35rem`; the primary grid is `calc(100% - 2.5rem)` (40px total inset). At `1536–1799px`, the approved precision-fit rule reduces only Home bottom padding to `2px`; 1536×864 is an explicit no-scroll target.
- `>=1800px`: the approved large-desktop mode retains approximately `5.6px` (`0.35rem`) Home bottom padding, the 1600px Home cap, and the selected Readiness/Today/Map decompaction refinements.
- `>=1536px` also sets the heading and several cards to a denser large-screen presentation. The final `>=1440px` block replaces the earlier fixed-row grid with natural-height rows.

### Home composition

- Base operational grid: 12 equal columns, `0.875rem` row gap and `1rem` column gap (14px / 16px).
- Base placement: Map 7 columns, Weather 5; Readiness, Today, Priority each 4.
- Approved portrait-tablet mode (`@media (min-width: 768px) and (max-width: 1023px) and (orientation: portrait)`): preserves the sequence Hero → Situation Rail → Map → Weather → Readiness + Today → Priority. The Situation Rail remains four columns; Map and Weather are full width; Readiness and Today remain paired 6/6 cards; Priority remains full width and final.
- Portrait-tablet geometry at 768×1024: 42px heading top padding, 24px Hero → Situation Rail gap, 350px Map canvas with an approximately 493px Map card, intentionally unchanged approximately 323px Weather card with four forecast days, unchanged Readiness/Today pair, and an approximately 179px Priority card using its tablet-specific horizontal content treatment while retaining the header.
- Portrait-tablet fit: the measured document is approximately 1799px with about 775px of intentional scrolling. Zero-scroll is not a goal. A 350px Map canvas is the approved floor for this composition unless separately reviewed.
- Approved compact-landscape mode (`@media (min-width: 1024px) and (max-width: 1279px) and (max-height: 800px)`): dedicated three-track grid using `minmax(0, 1.52fr) / minmax(18.75rem, 1fr) / minmax(14.5rem, 0.82fr)`, three automatic rows, and 12px gaps. At 1024px the measured tracks are approximately 414px Map / 300px Weather / 232px right operational track. Map and natural-height Weather span rows 1–2; Readiness sits above Today on the right; Priority spans the complete final row.
- Compact-landscape geometry: four-column Situation Rail retained, 315px Map canvas, and 96px full-width Priority strip. The measured 1024×768 document height is approximately 1057px, producing about 289px of intentional scrolling. Zero-scroll is explicitly not a goal for this mode.
- Compact-landscape Weather constraint: approximately 300px is the practical minimum track width for the complete five-day desktop Weather treatment unless that component is separately reviewed.
- Approved short-desktop mode (`@media (min-width: 1280px) and (max-width: 1439px) and (max-height: 800px)`): dedicated three-track grid using `minmax(0, 1.6fr) / minmax(18rem, 1fr) / minmax(14.5rem, 0.8fr)`, three automatic rows, and 12px gaps. Map occupies the dominant left track and spans rows 1–2; Weather occupies the center track, spans rows 1–2, and keeps its natural card height; Readiness sits above Today in the right track; Priority spans the full grid in row 3 as the final module.
- Short-desktop geometry: 315px Map canvas and 96px full-width Priority strip. Hero typography and metadata sizes remain unchanged; only heading spacing is reduced, including a 16px Hero → Situation Rail gap.
- Short-desktop rationale: prioritize useful Map scale, complete Weather data, readable Readiness/Today content, and the established operational hierarchy over forcing the entire dashboard into a 720px viewport. Intentional vertical document scrolling is part of this mode; zero-scroll is not a requirement.
- `<=1023px`: Map and Weather each span the full row; Readiness and Today use 6 columns each; Priority spans full width.
- `<=767px`: grid becomes a flex column in the mobile information-priority order Today → Priority → Map → Weather → Readiness. Mobile prioritizes Today and Priority; Priority is not the final module in this mode.
- `>=1440px`: four-track natural-height layout: `5fr / minmax(17.5rem, 3fr) / 2.25fr / 2.25fr`; Map and Weather span both rows, Readiness and Today occupy the upper right, Priority spans the lower-right pair.
- Large map canvas (`>=1440px`): at least `24rem` (384px) high and flexes to card height.
- The approved 1536×864 and 1920×1080 modes remain independent of the short-desktop mode and must not inherit its spacing, grid, or fixed Map/Priority dimensions.

## Responsive Strategy

- The system uses hard CSS handoffs rather than container queries.
- Navigation and Home layout do not share one breakpoint model: navigation changes at 768 and 1280; Home content also changes at 640, 1024, 1279/1280, 1440, and 1536.
- Mobile uses an action-first narrative: Today and Priority lead, followed by Map, Weather, and Readiness. Priority is intentionally not the final mobile module.
- Tablet preserves the top header, removes bottom navigation, and progressively increases information density without introducing the sidebar.
- Portrait tablet uses an orientation-scoped proportional refinement rather than a new topology: the full-width Map/Weather sequence and paired Readiness/Today cards remain, with deliberate document scrolling.
- Short landscape tablet/compact desktop uses an explicit `1024–1279px` and `<=800px` media condition. It keeps the 80px labeled top navigation while replacing the base two-row Home grid with the approved three-track operational sequence.
- Wide desktop introduces the immersive sidebar, removes the header, and lets the outdoor scene read around a centered/capped Home workspace.
- Wide-but-short desktop uses an explicit width-and-height media condition so its compact composition does not become the default 1280–1439px layout at taller viewport heights.
- Forecast density is content-responsive by viewport: 3 days under 640px, 4 days from 640–1023px, 5 days at 1024px and above.
- Reduced transparency uses opaque equivalents and removes backdrop filters. Reduced motion globally reduces animation/transition duration and explicitly disables workspace loading animation.

## Breakpoints

| Threshold | Current effect |
| --- | --- |
| `<640px` | Forecast shows three days. |
| `640–767px` | Forecast shows four days. |
| `768px` | Bottom nav and mobile More disappear; 72px desktop header navigation with icon-only primary destinations and desktop More appears; main bottom-nav clearance is removed. |
| `768–1023px`, portrait | Approved portrait-tablet proportions: 42px heading top padding, 24px Hero → Situation Rail gap, four-column rail, 350px Map canvas, paired Readiness/Today, and approximately 179px final Priority card; intentional scrolling remains. |
| `1024px` | Header grows from 72px to 80px; top-nav text labels appear; Home Map/Weather return to 7/5 split; all five forecast days show. |
| `1024–1279px` and `<=800px` high | Approved compact-landscape Home mode: unchanged 80px top navigation, compact heading spacing, three operational tracks, 315px Map canvas, and 96px full-width final Priority strip; intentional document scrolling remains. |
| `1280px` | Header disappears; 176px sticky sidebar appears; shell gains 16px outer padding/gap. |
| `1280–1439px` and `<=800px` high | Approved short-desktop Home mode: reduced hero spacing, three operational tracks, 315px Map canvas, and 96px full-width final Priority strip; intentional document scrolling remains. |
| `1440px` | Sidebar becomes 208px; final natural-height four-track Home composition activates. |
| `1536px` | Additional compact Home card/header/content rules activate on top of the 1440px composition. From 1536–1799px, Home bottom padding is 2px; 1536×864 is an explicit no-scroll target. |
| `1800px` | Home cap increases from 1536px to 1600px; approximately 5.6px Home bottom padding and the approved large-desktop decompaction remain, while existing grid tracks absorb the added width without changing proportions. |

Tailwind-aligned thresholds visible in component utilities are `sm=640`, `md=768`, `lg=1024`, `xl=1280`, `2xl=1536`; custom CSS additionally uses 1440px and 1800px.

## Exact Viewport Audit Matrix

| Viewport | Navigation mode | Home columns/reflow | Density and visibility | Width/capping behavior |
| --- | --- | --- | --- | --- |
| 390×844 | Sticky 64px top header with Back, trip identity, mobile More; fixed 5-item bottom nav, 68px plus safe area. | 2×2 situation rail; single flex stack ordered Today, Priority, Map, Weather, Readiness. | 3 forecast days; compact weather/daylight; hero title capped at 2.4rem; all main modules remain visible. | Home uses 12px side padding. Main reserves bottom-nav height plus 16px and safe area. No desktop cap is reached. |
| 414×896 | Same mobile header and fixed bottom nav as 390px. | Same 2×2 rail and ordered single-column module stack. | Same 3-day forecast and mobile compaction; slightly more inline room only, with no separate breakpoint. | Same 12px Home inset and bottom-nav clearance; fluid width. |
| 768×1024 | Approved 72px top header; bottom nav/mobile More hidden; icon-only primary navigation and desktop More shown. | Canonical portrait sequence: Hero → four-column Situation Rail → full-width Map → full-width Weather → 6/6 Readiness + Today → full-width final Priority. | 42px heading top padding; 24px Hero → rail gap; 350px Map canvas / approximately 493px Map card; unchanged approximately 323px Weather with four forecast days; approximately 179px horizontal-content Priority treatment. Document height is approximately 1799px with about 775px of intentional scroll. | Home retains 24px side padding and does not reach its cap. Zero-scroll is explicitly not required; 350px is the approved Map canvas floor unless separately reviewed. |
| 1024×768 | Unchanged 80px top header; desktop nav labels appear; bottom nav hidden. | Approved compact-landscape three-track Home: approximately 414px Map / 300px Weather / 232px right track with 12px gaps; Map and Weather span rows 1–2, Readiness sits above Today, and Priority spans the full final row. The Situation Rail remains four columns. | Compact heading spacing with a 16px Hero → Situation Rail gap; 315px Map canvas; complete five-day Weather; readable Readiness/Today; 96px Priority strip. The measured document height is about 1057px with about 289px of intentional scroll. | Home retains 24px side padding and does not reach its cap. Zero-scroll is explicitly not required; approximately 300px is the practical minimum for the five-day desktop Weather treatment. |
| 1280×720 | Top header hidden; 176px sticky sidebar with full labels and More. | Approved three-track short-desktop mode: Map spans rows 1–2 on the left; natural-height Weather spans rows 1–2 in the center; Readiness sits above Today on the right; Priority spans the full final row. | Reduced heading spacing with a 16px Hero → Situation Rail gap; 315px Map canvas; complete five-day Weather data; readable Readiness and Today; 96px Priority strip. The measured 1000px document intentionally scrolls about 280px. | Shell consumes 16px outer padding and 16px gap; main column is about 1056px. Home uses 16px side padding and does not reach its cap. Zero-scroll is explicitly not required. |
| 1536×864 | 208px sticky sidebar; no top/bottom nav. | Final 1440 four-track natural-height grid is active; Map and Weather span two rows; Readiness/Today upper right; Priority closes the lower right. | The `>=1536px` compact rules also apply: 45px card header strips, smaller Readiness ring, condensed Today rows, hidden Priority header, and inline Priority action. Later 1440 rules restore natural card height and some Today/Readiness text. The final document height is 864px with no scrolling. | Shell main column is about 1280px. Home is uncapped within it; the primary grid uses a 40px total inset. Home bottom padding is 2px. |
| 1920×1080 | 208px sticky sidebar; no top/bottom nav. | Same four-track natural-height large Home composition as 1536, ending with Priority. | Same inherited 1536 compact rules, with the `>=1800px` refinements and wider Home cap. The final document height is 1080px with no scrolling. | Shell main column is about 1664px. Home caps at 1600px and centers, preserving 32px of internal main-column breathing room per side; the primary grid is about 1560px wide after its 40px total inset. Home retains approximately 5.6px bottom padding. |

## Spacing

### Established rhythm

- The implementation strongly clusters around a 4px-derived system, especially 4, 8, 12, 16, 20, 24, and 32px.
- Repeated micro gaps: `0.25rem` (4px), `0.5rem` (8px), `0.75rem` (12px).
- Repeated component gaps: `0.875rem` (14px), `0.9rem` (14.4px), `1rem` (16px).
- Repeated card padding: 12px compact, 16px Home, 20px shared/default, 24–32px page/section.
- The 14px/14.4px values are established in Home grid work, but should not be generalized outside those grids.
- The short-desktop Home grid deliberately uses a repeated 12px gap in both axes; this is scoped density, not a replacement for the base 14px/16px Home grid gaps.
- The approved compact-landscape Home grid also uses 12px gaps in both axes. This value belongs to its height-aware three-track composition and does not change the default portrait-tablet spacing.
- Portrait tablet retains the base 14px operational row gaps; its refinement comes from hero, Map, and Priority proportions rather than generalized gap compression.

### Concrete recurring values

- Shared `Card` header: `px-5 py-4` (20px horizontal / 16px vertical).
- Shared `Card` body: `p-5` (20px).
- Home card header override: `0.75rem 1rem` (12px / 16px).
- Home card body override: `1rem` (16px); Weather body is `0.75rem 1rem 0.85rem`.
- `>=1536px` key Home header strips: `0.5rem 0.75rem` (8px / 12px), fixed at `2.8125rem` (45px).
- Sidebar surface: 16px padding; sidebar nav rows use roughly 10.4px vertical / 12px horizontal.
- Trip section page vertical stack: `space-y-6` (24px).
- Hero heading region: fluid large top breathing room, then tighter operational content below.

## Typography

- UI sans: Inter, with system sans fallbacks. Body uses this family globally.
- Data/metadata mono: JetBrains Mono with UI-monospace fallbacks. Used for times, measurements, percentages, forecast values, phases, and compact badges.
- Display serif: DM Serif Display 400, with Georgia/Times fallbacks. It is intentionally limited to the Home trip hero title.
- Hero title: `clamp(2.9rem, 4.2vw, 3.5rem)`, 400, `0.98` line-height, `-0.025em`; mobile `clamp(2rem, 10vw, 2.4rem)`; large rules can raise it to `clamp(3.25rem, 4vw, 3.85rem)`.
- Hero location: `clamp(1rem, 1.6vw, 1.2rem)`, 500.
- Operational eyebrow/status: approximately 10–12px, 700, uppercase, `0.08em` tracking.
- Card header labels: shared primitive is 12px, 600, uppercase, tracked.
- Core body hierarchy: 16px/600 titles; 14px body; 12px support; 10–11px dense metadata.
- Dynamic numerical content commonly uses the mono family; tabular numerals are not declared globally.

## Surfaces

### Expedition workspace tokens (day presentation)

- Sidebar solid/translucent: `#183127` / `rgba(15,34,27,.66)`.
- Standard solid/translucent: `#20382e` / `rgba(23,43,35,.58)`.
- Dense solid/translucent: `#1a2f28` / `rgba(18,35,29,.78)`.
- Elevation: `0 22px 60px rgba(2,12,9,.30)`.

### Expedition workspace tokens (night presentation)

- Sidebar solid/translucent: `#0c1e19` / `rgba(7,22,18,.68)`.
- Standard solid/translucent: `#12251f` / `rgba(12,29,24,.62)`.
- Dense solid/translucent: `#0d1e1a` / `rgba(8,23,20,.82)`.
- Elevation: `0 24px 70px rgba(0,0,0,.48)`.

### Explicit Home surface variants

- `home-glass-surface--standard`: Map and other broad/context surfaces; 20px blur and `saturate(1.1)` when supported.
- `home-glass-surface--dense`: Weather, Readiness, Today; denser alpha, 20px blur and `saturate(1.1)`.
- `home-glass-surface--warning`: Priority Notice; warning surface/border with 18px blur and `saturate(1.08)`.
- Opaque solid fallbacks precede enhancement. `prefers-reduced-transparency` restores the solid recipes and disables backdrop blur.
- Home card headers use a dense/standard color mix rather than a separate raised layer.

## Borders

- Default structural border is 1px.
- Expedition day workspace subtle/strong: `rgba(235,241,231,.18)` / `.30`.
- Expedition night workspace subtle/strong: `rgba(220,233,224,.16)` / `.28`.
- Home route semantic border: `#34453c` in the Expedition Home color contract; derived alpha mixes are used for subdivisions.
- Active navigation adds an inset 1px ring rather than a heavier outer border.
- Focus treatment is consistently a 2px outline/ring with 1–3px offset depending on component.
- Dashed borders are reserved for empty states.

## Radii

- Tokenized card radius: `--radius-card: 1.25rem` (20px).
- Tokenized hero/main radius: `--radius-hero: 1.5rem` (24px).
- Shared `Card` primitive before Home override: `rounded-2xl` (16px).
- Situation rail: `1.15rem` (18.4px), reduced to 16px on mobile and at `>=1536px`.
- Sidebar: 20px.
- Common controls: 12px (`rounded-xl`) or approximately 12.8px for sidebar rows.
- Nested content/notice surfaces: commonly 12px (`rounded-xl`).
- Statuses, rings, and icon containers: fully rounded/pill.
- These values form a hierarchy, but the fractional 17.6/18.4px values are component-specific and should not be promoted to new global radius tokens without review.

## Color / Operational States

### Expedition Home semantic contract

- Canvas `#101915`; surface `#17221c`; subtle surface `#1e2c24`; border `#34453c`.
- Primary text `#f1f0e8`; secondary text `#b7bcaf`.
- Primary action/sage `#8ebf9b`; hover `#a5cfad`; focus amber `#e0ae55`.
- Weather/Map blue `#76b2cf`.
- Readiness/Gear green `#82b990`.
- Daylight/Guide amber `#d5a14b`.
- Plan green `#8ebf9b`.
- Crew blue-gray `#78a9b9`.
- Record/Field Log neutral `#aab4ad`.
- Status positive `#82b990`, warning `#d5a14b`, danger `#e07b65`, info `#76b2cf`.

### Workspace semantic aliases

- Sage maps to readiness/success and the primary workspace action.
- Amber maps to attention, daylight, warning surfaces, and operational focus in some contexts.
- Blue maps to weather, map, informational states, and crew.
- Red/coral maps to critical and danger.
- Color is categorical/semantic, not decorative. Maintain the Map/Weather/Readiness/Plan/Gear/Crew/Guide/Field Log assignments.

## Icons

- Icon library: Lucide React.
- Primary trip nav: 16px in top header, 19px in sidebar and bottom nav.
- Card header icons: 16px.
- Situation rail icons: 25.6px base; 28px in the `>=1536px` compact/wide treatment.
- Inline chevrons/actions: 14–16px.
- Small metadata/weather glyphs: commonly 11–14px.
- Hero location/meta: 16–18px; hero status: 15px.
- Icon color carries category/state meaning; most non-status icons inherit secondary text.

## Controls

- Standard app-shell and form target: `min-height: 2.75rem` (44px); icon-only shell controls also use `min-width: 44px`.
- Primary top-nav links: minimum 44×44px; 8px horizontal padding, rising to 12px at `lg`.
- Sidebar rows: minimum 44px, 12px horizontal padding.
- Bottom-nav links: minimum 64px tall inside a 68px mobile bar, plus safe-area padding.
- Home map location action: minimum 44px normally; compact large-screen override reduces it to 32px.
- Home weather refresh is a 28×28px icon control.
- Active/hover states use a low-alpha sage/action surface; focus is a 2px semantic ring/outline.
- Disabled states commonly reduce opacity to 0.6.

## Cards

### Shared Card primitive

- Flex column, overflow hidden, 1px border, 16px radius.
- Header: 20px horizontal / 16px vertical, bottom divider, 50% card-surface tint, 12px uppercase 600 label, 16px accent icon.
- Body: 20px, flexes to fill, `min-height: 0`.
- Home cards opt into explicit surface classes and then override radius, header, body, border, and shadow without changing the shared primitive.

### Home operational cards

- Map: standard glass; broad visual field; 350px canvas under 768 and in the approved portrait-tablet mode, 390px from 768 by default outside that portrait exception, scoped 315px exceptions in the approved compact-landscape and approved short-desktop modes, and a minimum 384px at `>=1440px`. The portrait-tablet 350px canvas is an approved floor unless separately reviewed.
- Weather: dense glass; current conditions + three compact metrics + daylight track + responsive 3/4/5-day forecast.
- Readiness: dense glass; 84px ring base, 68px at `>=1536px`, interpretation plus three lowest readiness categories.
- Today: dense glass; vertical timeline with time/marker/content axis; metadata compresses at `>=1536px`.
- Priority: warning glass; tone-specific inner notice. Portrait tablet retains the header and uses horizontal content distribution at approximately 179px total height. In short-desktop mode it becomes a 96px full-width final strip. At `>=1536px`, its card header also disappears and content becomes a compact horizontal strip with inline action, but that large-screen geometry remains independently owned.

## Navigation

- Canonical primary destinations and order: Home, Plan, Gear, Crew, Guide.
- Field Log is secondary: exposed through More, not the five-item primary navigation.
- `<768px`: sticky top identity/action header plus fixed bottom five-item navigation.
- `768–1279px`: top header contains Back, trip identity, centered primary navigation, and More. At 768–1023 the primary nav is icon-only; at 1024+ labels appear.
- `>=1280px`: sticky left sidebar contains Back, identity/location, full labeled primary navigation, and More at the bottom; top and bottom navigation are hidden.
- Header heights: 64px mobile, 72px tablet (`<=1023px`), 80px at 1024–1279.
- Active state: tinted semantic background + inset ring; mobile adds a 2px top indicator.
- Long trip identity is visually truncated but preserved in the `title` attribute.

## Home Dashboard Patterns

- Hero establishes trip identity and status before operational detail. It remains over the scene rather than inside a card.
- Situation rail always presents Weather, Readiness, Sunset, Next Event in that order; four columns normally, 2×2 on mobile.
- Outside mobile, the operational grid keeps live context first (Map/Weather), then readiness/action modules.
- Mobile stacks the operational modules in DOM and visual order as Today → Priority → Map → Weather → Readiness, prioritizing immediate schedule and urgency. Priority is not the final module on mobile.
- Priority is the intentional final Home module for portrait tablet, compact landscape, short desktop, and large desktop, closing those operational sequences with the highest-value exception or all-clear state.
- Short desktop preserves the same narrative ending: Priority spans the complete operational width after Map, Weather, Readiness, and Today rather than behaving as a peer card in a lower three-card row.
- Compact landscape at 1024 preserves that narrative while retaining the top-navigation shell: Map and Weather establish context, Readiness and Today share the right operational track, and Priority closes the full width.
- Portrait tablet preserves the stepped operational narrative and uses proportional refinement only; Map remains immersive, Weather remains complete, Readiness/Today stay paired, and Priority remains the intentional final card.
- Metadata hierarchy is consistent: uppercase/tracked label → strong value/title → muted support detail.
- Numeric and time data commonly use JetBrains Mono.

## Responsive Component Rules

- Hero: top padding and type scale compress on mobile; max title width stays 18 characters and permits anywhere wrapping.
- Situation rail: 4 columns down to 768; 2×2 at 767 and below. Dividers change from vertical-only to a 2×2 grid pattern.
- Weather forecast: 3 / 4 / 5 visible days at `<640` / `640–1023` / `>=1024`.
- Weather mobile: fixed minimum card height 268.32px, tighter padding, hidden daylight duration/icons, smaller forecast icons.
- Map canvas: 350px base and approved portrait-tablet floor, 390px at `md` outside the orientation-scoped portrait exception, height-aware 315px exceptions for the approved 1024–1279px compact-landscape mode and approved 1280–1439px short-desktop mode, then flex/natural with 384px minimum at `>=1440px`.
- Home operational layout: stacked ordered flex on mobile; stepped 12-column layout from tablet through 1439 by default; a dedicated three-track override at 1024–1279px and `<=800px` high; a separately owned three-track override at 1280–1439px and `<=800px` high; four-track composition at `>=1440px`.
- Portrait-tablet density changes proportions without changing topology or typography: 42px heading top padding, 24px Hero → Situation Rail gap, four-column rail, 350px Map canvas, unchanged Weather and 6/6 Readiness/Today cards, and an approximately 179px horizontally distributed final Priority card. The measured 1799px document intentionally scrolls about 775px at 768×1024.
- Compact-landscape density changes layout and spacing before typography: unchanged 80px navigation, 40px heading top padding, 16px Hero → Situation Rail gap, four-column rail, 12px grid gaps, complete five-day Weather at a practical minimum width of approximately 300px, readable Readiness/Today, and intentional scrolling around 289px at 1024×768.
- Short-desktop density changes spacing and layout before typography: 36px heading top padding, 16px Hero → Situation Rail gap, 12px grid gaps, compact header/body spacing, complete Weather/Readiness/Today content, and intentional vertical scrolling.
- Large (`>=1536px`) density: 45px header strips, tighter card padding, smaller readiness ring, condensed Today metadata, and a compact Priority strip. The 1536–1799px precision-fit range uses 2px Home bottom padding, and 1536×864 is an explicit no-scroll target.
- Very large (`>=1800px`) width: Home expands from the 1536px base cap to 1600px and retains approximately 5.6px Home bottom padding plus the approved large-desktop decompaction; track proportions and photographic treatment remain unchanged.
- Section route cards deliberately remove legacy internal height caps and use document scrolling.

## Candidate Inconsistencies

### Home control hit-area exceptions

- Component/location: Weather refresh and large-screen Map location action.
- Current values: weather refresh is 28×28px; Map action is normally at least 44px tall but becomes 32px at `>=1536px`; most shell/form controls are 44px minimum.
- Why it appears inconsistent: these two controls depart from the otherwise repeated 44px control target.
- Assessment: appears intentional for dense card headers, but is a real system exception and should not silently become a general compact-control rule.

### Card radius ownership is split

- Component/location: shared `Card` versus Home route cards.
- Current values: shared primitive is 16px (`rounded-2xl`); Home cards are overridden to tokenized 20px; the situation rail is 18.4px.
- Why it appears inconsistent: several near-card radii coexist without a single shared scale.
- Assessment: the 16/20/24 hierarchy appears intentional; the 18.4px rail radius is component-specific and should remain documented as such rather than normalized automatically.

### Duplicate Inter loading paths

- Component/location: `app/layout.tsx` and the first line of `globals.css`.
- Current values: layout inserts a Google Fonts stylesheet for Inter 300–900, while CSS also imports Inter 400–700 together with JetBrains Mono.
- Why it appears inconsistent: the same family is requested through two paths with overlapping weights.
- Assessment: likely implementation accumulation rather than a visual requirement. Do not change without checking font-loading behavior.

### Expedition base tokens versus Home-scoped tokens

- Component/location: `.theme-expedition` base variables and the later Expedition Home color pilot selector.
- Current values: base Expedition day variables are light, while Expedition Home is remapped to the dark green `#101915 / #17221c / #1e2c24` system.
- Why it appears inconsistent: the same named theme has different route-scoped surface semantics.
- Assessment: intentional Home scoping is strongly evidenced by comments and tests. It is an architectural split, not a value to normalize, but future changes must identify which contract they target.

## Decisions Not Confidently Inferred

- Which remaining compact `>=1536px` density rules should eventually become shared tokens rather than viewport-scoped component refinements; current ownership is approved and should not be generalized without review.
- Whether Expedition day is expected to remain visually dark on Home while non-Home Expedition day surfaces use the lighter base contract.
- The intended canonical treatment for arbitrary trip photography. The current implementation only maps one approved trip identity to one local image and otherwise uses an atmospheric fallback; there is no general trip-image data contract.

## Audit Guardrails for the Responsive-Polish Pass

- Preserve the outdoor scene, topo atmosphere, serif hero, glass density hierarchy, and existing semantic color roles.
- Treat `HomeOverview` and its explicit Home variants as the canonical composition; do not infer a generic dashboard card system from non-Home legacy cards.
- Preserve the navigation ownership changes at 768px and 1280px unless the responsive task explicitly authorizes behavioral change.
- When adjusting a recurring value, distinguish a tokenized/repeated pattern from the one-offs identified above.
- Do not normalize the Candidate Inconsistencies without separate review and authorization.
