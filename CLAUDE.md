# libraries

Shared UI packages for my projects, so each new app starts from working code
instead of regenerating it.

## Layout

```
packages/desktop      @rindra/desktop — React + antd chrome (grid, theme, command bus)
packages/create-app   scaffolder for new projects        →  pnpm new
examples/gallery      live showcase + integration guide  →  pnpm gallery
examples/smoke        typecheck-only consumer; the contract test for the public API
```

pnpm workspace. `pnpm build`, `pnpm typecheck`, `pnpm test` run across packages;
`pnpm gallery` opens the showcase and `pnpm new` scaffolds a project.

The two examples check different things and both are load-bearing. The gallery
aliases `@rindra/desktop` to its **source** (so editing a component hot-reloads)
and proves the library renders with no Electron at all — the host fallbacks are
exercised for real. The smoke app imports the **built** package through its
exports map, which is the only way to catch a broken `exports` field, a missing
`.d.ts` or an un-exported type.

## The rule that governs this repo

**Extract on the third repetition. Never design a component up front.**

Everything in `packages/` was already written and shipped three times before it
moved here. If something exists in fewer than three projects, it stays in the
project. This repo is a consolidation of proven code, not a speculative
framework — that distinction is the only thing keeping it from becoming an
unmaintained second job.

Corollary: when a component has *diverged* between copies, the divergence is
information. Heavy drift usually means each app genuinely needs its own, and
what should be extracted is the mechanism underneath, not the component.
`Ribbon` is the example — 68% drift between two copies, so the registry is
library material and the ribbon layout is not.

## Design constraints

- **No host assumptions.** The library never touches `window.api`, Electron IPC,
  `next/*`, or `process`. Anything the platform must provide goes through an
  injected adapter (`DesktopHost`). This is what lets one package serve the
  Electron and web builds of the same product.
- **No app coupling.** No auth, no domain types, no app routes, no business
  rules. If a component needs one, it takes it as a prop or a config member.
- **Peer dependencies, not dependencies.** React, antd, the icon set and
  i18next stay peers so the app and library share one copy.
- **Defaults that work with nothing configured.** Every provider is optional;
  `useDataTableConfig` and `useHost` fall back rather than throw. An app should
  be able to render `<DataTable>` and get something reasonable.
- **Ship the strings.** A component that calls `t()` ships its own locale keys
  (`desktopLocales`), or every consumer transcribes 54 keys by hand.

## Working on this repo

Verify with all three, from the repo root:

```bash
pnpm -r typecheck && pnpm -r test && pnpm -r build
cd examples/smoke && npx tsc --noEmit    # the real consumer check
```

`examples/smoke` is not decoration. It imports the *built* package through its
exports map, so it catches a broken `exports` field, a missing `.d.ts` and an
un-exported type — none of which the package's own typecheck can see. Extend it
whenever you add a public export.

## Consuming in a new project

`pnpm new` scaffolds one — Vite SPA, Electron or Next.js — with the providers
mounted, i18n seeded and an example grid screen. The templates encode several
non-obvious fixes (React and i18next deduplication per bundler, `ssr: false`
placement, a `.d.ts` that must not shadow its `.ts`); `packages/create-app/README.md`
lists them with the failure each one prevents. Changing a template means
re-verifying by generating *and building* all three targets — from a short
filesystem path, or Windows' 260-character limit breaks `electron-vite` with a
misleading error.

## Consuming in an existing project

Not published to npm. Use a workspace link, or a git dependency pinned to a tag:

```json
"@rindra/desktop": "github:rindra/libraries#desktop-v0.1.0"
```

Pin the tag. An unpinned shared library that silently changes under four apps is
the failure mode this repo exists to avoid.

## State

`@rindra/desktop` v0.1.0 — extracted from `Gestion_ecole` (the most advanced of
three copies). Not yet adopted by any app; the migration of `Gestion_ecole` to
consume it is the next step and the real test.

Still in the apps, deliberately: `Ribbon`, `NavPane`, `TitleBar`, `StatusBar`
(too divergent), `PrintPreview` (couples to auth, templates, barcodes).
