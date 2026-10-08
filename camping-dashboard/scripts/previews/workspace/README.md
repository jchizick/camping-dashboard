# Local workspace preview tooling

The signed-out desktop landing ships a single static illustration. This directory
preserves the approved Pine Lake rendering source so that future screenshots can
be rebuilt without a preview route, hosted services, or discarded output files.

See [the maintained workflow](../../../docs/desktop-workspace-preview.md) for
capture commands, data, licenses, the reproduction gate, and publication checks.

- WorkspacePreview.tsx: complete product composition.
- fixture.ts: fixed fictional trip, readiness, weather, schedule, and notice.
- coverage.ts: separate fictional module counts/labels; does not change readiness.
- historical/: the 19-file historical rendering closure recorded in provenance.json.
  Imports are local; service-dependent surfaces use static adapters. The forecast
  starts expanded. This deliberately avoids drift from current runtime components.
- adapters/: fictional identity, static framework boundaries, resting Invite, and
  the static Coverage Counters rail. No live Trip Access provider is mounted.
- preview.css: frozen historical rules used by the approved rendering, recovered
  from its compiled CSS. Do not regenerate it from current application CSS.
- unified.css: aligned sidebar/coverage composition, approved Invite appearance with a
  16px right inset, and embedded static 18px warning / 24px CloudSun-like icons.
  The icons are pseudo-elements scoped to the unified product; historical mode
  never loads this stylesheet. No post-capture compositing or live overlays.
- fonts.css, fonts/: recovered local font bytes, hashes, and licenses.
- map.svg: the original fictional Pine Lake map; no live map dependency.
- render-workspace.mjs: trusted TypeScript-to-static-HTML renderer using existing
  TypeScript, React, and Lucide. Only local relative modules and the listed packages
  are loadable. Next image/navigation are inert capture adapters.
- capture-config.mjs: shared dimensions, clock, locale, and quality contract.
- capture-workspace.mjs: ephemeral loopback server, isolated Chrome capture, Sharp
  encoding, metadata assertions, immutable historical Git-blob comparison, and
  coverage geometry/containment/fill assertions.

No client JavaScript is served. This source is never imported by an application
route. Tests import the capture configuration and static coverage adapter.
Capture artifacts are ignored under output/workspace-preview/. No dependencies
were added.
