# Gallery

The showcase for `@rindra/desktop`: every component live, with its props and a
copy-paste snippet, plus step-by-step integration for the three project shapes.

```bash
pnpm gallery          # from the repo root
```

Then open the URL Vite prints.

## How it works

- It resolves `@rindra/desktop` to the library's **source**, not `dist`, so
  editing a component hot-reloads here. (`examples/smoke` covers the built
  package and its exports map instead — between them, both paths stay honest.)
- Each demo lives in its own file under `src/demos/`. The registry imports that
  file twice: once as a component, once as text via Vite's `?raw`. The snippet
  on screen is therefore *literally* the code that is running, so a copy-paste
  example cannot drift.
- The gallery's own chrome paints with the library's design tokens rather than
  its own colours, so a broken token shows up here before it reaches an app.
- It initialises i18next with nothing but `desktopLocales`, which doubles as a
  check that the bundled `table.*` keys are complete — a missing one renders as
  a raw key on screen.

## Adding a demo

1. Write `src/demos/my-thing.tsx` with a default-exported component.
2. Import it and its `?raw` text in `src/registry.ts`, and add an entry.

That is the whole step. Props tables are optional and live in the registry.
