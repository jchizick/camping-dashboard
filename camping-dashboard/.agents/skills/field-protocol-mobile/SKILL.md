---
name: field-protocol-mobile
description: Apply Field Protocol's mobile field-briefing, readiness-first Home, Gear preparation, Field composition, and responsive conventions. Use for Field Protocol mobile Home, readiness, Gear, or Field workflow work; do not impose these patterns on unrelated products or flows.
---

# Field Protocol Mobile

Build the mobile trip workspace as a calm field briefing: trip identity, current readiness, the issue that matters, the action to take, then supporting context. Preserve the product's existing field-tool character rather than turning it into a generic KPI dashboard.

## Start from the product's source of truth

- Inspect the existing trip shell, readiness domain result, routes, alerts, weather, schedule, and responsive boundary before changing presentation.
- Treat the canonical readiness result as authoritative. Present its status, score, assessment coverage, priorities, blockers, warnings, and actions; do not recreate readiness calculations in UI components.
- Keep presentation-specific data collection in a shared Home view model when mobile and desktop consume the same sources.
- Mount only the active responsive composition. Do not keep duplicate interactive mobile and desktop trees hidden with CSS.
- Preserve established tablet and desktop behavior unless the request explicitly includes redesigning it.

## Readiness-first Home hierarchy

For the mobile Home, prefer this briefing order when the available data supports it:

1. Trip identity and timing
2. Readiness command centre
3. Compact conditions and next event
4. Optional later schedule preview
5. Conditional trip notice
6. Lower-priority campsite or map context

Avoid repeating readiness, weather, alerts, or the next event in multiple modules. Omit empty supporting surfaces instead of rendering decorative placeholders.

## Readiness command centre

- Make the semantic status more important than a decorative score.
- Use a prominent numeric score and accessible linear progress only when assessment coverage makes the score genuinely comparable.
- Treat partial coverage as a first-class state. A high or 100% assessed score must not imply overall readiness when required areas remain unassessed.
- When readiness is unavailable, do not manufacture a percentage or progress indicator.
- Distinguish blockers, warnings, and coverage gaps in both text and visual tone. Never rely on color alone.
- Keep a fully ready state concise and do not fabricate a task merely to fill the action area.

## Action priority

- Preserve the readiness domain's genuine next action as the primary action.
- Keep assessment-coverage remediation separate when a blocker or warning already owns the primary action.
- When no higher-priority readiness action exists, the coverage action may become primary.
- Reuse existing Gear, Plan, Field, and other product routes. Do not create parallel navigation semantics for the Home.

## Supporting context

- Treat weather as compact operational context, not a competing dashboard card. Show only useful available details such as current conditions, precipitation, or sunset.
- Present the next event once. A schedule preview should contain later events only.
- Label externally sourced alerts as `Trip notice`, retain their canonical severity and destination, and omit the notice surface when none exists.
- Keep maps and campsite context below immediate readiness and action content on mobile.

## Gear preparation workflow

- Keep packing progress and readiness distinct. Packing progress covers every planned item, including optional gear; readiness evaluates required gear only.
- Use the product-facing term `Required` for the existing required-item attribute. Preserve the underlying schema or domain name unless the work explicitly includes a data migration.
- Let people mark or unmark an item as Required in the existing add/edit flow. Prefer a clear binary control over a separate management surface.
- Consume the canonical Gear readiness result for status, blockers, warnings, coverage, and next action. Do not duplicate Gear scoring logic in UI components.
- Treat required gear by operational state: not acquired is missing and blocking; acquired but unpacked needs packing and warns; packed is resolved.
- Treat “no required gear identified” as an assessment-coverage gap, not as proof of readiness and not as a missing-item blocker.
- Keep acquired/on-hand and packed as separate controls. Packed is the primary high-frequency action; acquired remains accessible without competing with it.
- Keep optional gear fully functional in packing totals, estimated weight, quantities, ownership, and item controls, while excluding it from required-only readiness.
- Prefer semantic status copy such as the number of required items missing or still to pack, `Required gear ready`, or `Required gear not identified`. Avoid a redundant readiness percentage when the state is clearer in words.

For mobile Gear, prefer this order: screen identity, all-item packing progress, required-gear status and canonical action, estimated weight, quick filters, then the category checklist. Preserve the existing weight calculation and category taxonomy; do not add speculative analytics or reorder intentional/user-defined category order.

Use quick filters with literal semantics:

- `All`: every planned item
- `To pack`: items that are not packed
- `Required`: items marked Required

The required-gear summary may activate the same canonical `Required` filter, but it should not create a duplicate checklist. Keep Required and operational states visible in text or accessible labels rather than relying on color alone.

## In-trip Field composition

Treat Field as a concise operational read surface for use during the trip, not as a repository of park prose or an administration dashboard. On mobile, prefer this hierarchy when the available data supports it:

1. Field Essentials
2. Notices
3. Field Prep
4. Secondary Park Reference

Build the hierarchy from existing trip, park-intelligence, alert, weather, astronomy, and manual-prep sources. A shared Field view model may normalize these sources for presentation, but it must preserve canonical records, domain ordering, permissions, mutations, and readiness results.

### Field Essentials and conditions

- Prioritize fire restrictions, water guidance, ranger or park contact, campsite/site context, and concise current conditions.
- Make existing operational phone numbers tappable with an understandable accessible name. Never invent emergency numbers or missing contact information.
- Surface useful site notes without moving campsite definition or editing out of Plan. Plan owns trip and campsite definition; Field consumes the resulting context.
- Keep conditions and readiness semantically separate: conditions describe the environment, while readiness describes preparation. Field may present weather, precipitation, wind, daylight, fire, or water conditions, but must not derive readiness from them.
- Omit unavailable fields and keep empty states compact. Do not manufacture zeroes, contacts, advisories, or decorative placeholder panels.

### Notices

- Use `Notices` as the product-facing Field term while preserving internal alert schema, types, lifecycle, severity, active/dismissed state, ordering, refresh, creation, source URLs, and Home notice selection.
- Keep severity, a concise title, source, useful update context, and a short preview visible while collapsed. Make the complete body and source actions available through an accessible disclosure.
- Long advisories and multiple notices should remain scannable while collapsed; do not permanently truncate their information.
- Preserve refresh, add, dismiss, and delete controls according to existing permissions. Keep those controls secondary to reading the notice.
- A no-notices state should be quiet and truthful rather than a large empty surface.

### Field Prep

- Present the existing manual-prep checklist as `Field Prep`; do not describe it as real offline capability, offline safety, or synchronized app state.
- Consume the authoritative manual-prep readiness category for completion, availability, explanations, and actions. Do not recalculate its score in the composition.
- Preserve the supported manual confirmations for cached maps, permits, daily vehicle permits, downloaded routes, satellite devices, and emergency contacts without changing their storage contract.
- Treat a missing Field Prep record as unavailable rather than zero completion. Show checked and unchecked state in text or accessible state, not color alone.
- Keep genuine offline caching, synchronization, and service-worker architecture outside this presentation workflow until explicitly scoped.

### Field boundaries and secondary reference

- Keep wildlife, firewood context, astronomy, and other non-urgent park information available as secondary reference content, preferably in one compact disclosure instead of another card stack.
- Do not let Project Intel, mission metadata, or other internal/legacy surfaces compete with field utility in the primary mobile composition. Preserve those features elsewhere when they remain supported.
- Field does not replace Home readiness prioritization, Plan editing, Gear packing/readiness, or Crew responsibility ownership.
- Preserve route compatibility unless a route migration is explicitly scoped. User-facing destination terminology may improve without renaming internal route or schema identifiers.
- Below the mobile boundary, mount the Field-specific composition instead of stacking desktop cards. At and above the boundary, preserve the established desktop/tablet Field workspace except for safe shared terminology and accessibility improvements.

## Visual language

- Use the existing Field Protocol tokens, typography, spacing rhythm, and surface system.
- Favor a field-briefing composition: deep pine and charcoal foundations, sage/moss readiness cues, amber attention cues, and restrained lake-blue information cues.
- Use border-led hierarchy, compact glass surfaces, and a consistent 4px-derived spacing rhythm.
- Prefer one strong readiness command surface over a grid of equal KPI tiles, oversized ornamental gauges, or duplicated summary rails.
- Keep motion restrained and provide a reduced-motion treatment.

## Authenticated background atmosphere

- Use a dark expedition base with a subtle, large-scale topographic contour texture throughout the authenticated Field Protocol environment. `/public/topo-map-bg.svg` is the canonical contour asset.
- Prefer direct SVG background rendering when a low-opacity mask makes contour detail disappear. Give contour strokes tiered opacity in muted Field Protocol sage or green-grey tones rather than harsh black.
- Keep the topographic pattern subtle but unmistakably visible in exposed page background around and between working surfaces. Use a large cartographic scale rather than a small, repetitive wallpaper treatment.
- Place the contour layer beneath atmospheric overlays and operational surfaces. Do not render it inside individual cards or allow it to compete directly with text.
- Keep primary working surfaces sufficiently opaque for fast scanning and reliable readability.
- Mobile may use a stronger contour presence than tablet or desktop. Keep desktop quieter under its maintenance-mode visual contract.
- Reduced-transparency or similar accessibility modes may suppress the contour texture in favor of clearer opaque surfaces.
- Keep the canonical contour asset in the offline application shell so saved-trip cold starts retain the authenticated visual identity.
- Treat all background imagery as atmosphere rather than required information. The product must remain fully usable when it does not render.

## Authenticated mobile typography

Below 768px, use typography to separate high-value operational signals from the supporting interface without turning every heading or number into a display treatment.

- Use Barlow Condensed ExtraBold 800 selectively as the authenticated mobile operational display face. Apply its primarily all-caps presentation through CSS or equivalent presentation logic; never mutate dynamic source strings to create uppercase content.
- Appropriate Barlow roles include mobile trip hero identity, page titles, major readiness values and short readiness states, selected-day displays, packing ratios, temperature, and other deliberately chosen high-value operational metrics.
- Do not use Barlow for body copy, long or unpredictable dynamic content, navigation, buttons, forms, Gear, meal, or participant names, Notices, connectivity or read-only messaging, ordinary metadata, or micro-labels. Avoid Barlow below roughly 20px.
- Use DM Sans as the authenticated mobile UI and body family for headings, controls, navigation, forms, labels, metadata, descriptions, dynamic content, and supporting text. Short uppercase operational labels also use DM Sans rather than Barlow.
- Use JetBrains Mono only for genuinely technical or fixed-width data. Ordinary dates, times, weights, calories, actions, and labels should use DM Sans, with tabular numerals when alignment is useful.
- Give authenticated mobile trip and page identity the operational Barlow language while keeping the persistent trip shell or header and bottom navigation in DM Sans.
- Keep connectivity states such as `Offline · Read-only` in DM Sans and visually distinct from readiness.
- Favor DM Sans, conventional casing, and readable control and input sizes in mobile forms rather than condensed branding.
- Keep signed-out and editorial typography intentionally flexible. DM Serif remains available, and future marketing work may use DM Serif, Barlow Condensed, or both alongside DM Sans when appropriate.
- Package typography assets with the application build and offline shell so authenticated mobile typography remains locally available without a runtime Google Fonts dependency.

## Responsive and accessibility checks

- Verify the project's actual mobile boundary. For Mobile v1, mobile compositions are below 768px and the existing tablet/desktop compositions begin at 768px.
- Check representative widths at 360, 390, 414, 768, 1024, 1280, and 1536 pixels, including short landscape heights where relevant.
- Confirm there is no horizontal overflow, clipped fixed navigation, duplicated focusable content, or repeated readiness/next-event announcements.
- Use semantic headings, descriptive action labels, visible keyboard focus, touch targets of at least 44px where practical, and accessible progress semantics.
- Keep mobile-only layout rules below the boundary. Shared terminology, accessibility, and domain-consumption fixes may improve desktop, but do not redesign desktop interaction without explicit scope.

## Verification

Cover at least these behavior classes when they are in scope:

- Ready or high-readiness state
- Blocker state and canonical action
- Warning state and canonical action
- High or 100% score with incomplete assessment coverage
- Unavailable readiness
- Fully ready state without fabricated work
- Next-event and schedule de-duplication
- Missing weather, notice, schedule, and campsite data
- Mobile/desktop boundary behavior
- All-item packing progress with optional gear present
- Required gear that is missing, acquired but unpacked, and packed
- Required-assessment coverage when only optional gear exists
- Independent acquired and packed controls
- Exact `All`, `To pack`, and `Required` filter semantics
- Field Essentials priority, omission of absent values, and tappable contact behavior
- Notice count, severity, ordering, collapsed summary, expandable full body, source links, permissions, and no-notices state
- Long and multiple notice density while collapsed
- Field Prep authoritative completion, unavailable state, six existing confirmations, and unchanged mutation paths
- Secondary park reference priority and absence of Project Intel from the primary mobile Field composition
- Field route compatibility and exclusive mobile-versus-desktop composition mounting

Run focused component tests, type checking, linting, a production build, and responsive browser verification in proportion to the change. Keep unrelated dirty-tree work intact.
