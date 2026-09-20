# create-rindra-app

Scaffolds a React + antd project already wired to `@rindra/desktop` — providers
mounted, i18n seeded, theme set, an example grid screen, and a `CLAUDE.md` that
documents the conventions.

```bash
pnpm new                                  # from the repo root, interactive
pnpm new -- mon-app --target electron     # or straight through
```

Standalone:

```bash
node packages/create-app/dist/index.js mon-app --target next --yes
```

## Options

| Flag | |
| --- | --- |
| `--target <vite\|electron\|next>` | project shape |
| `--locale <fr\|en\|mg>` | starting language |
| `--accent <bleu\|vert\|orange\|rouge\|violet\|ardoise>` | brand accent |
| `--dep <spec>` | how to depend on `@rindra/desktop` |
| `--no-install` / `--no-git` | skip those steps |
| `-y, --yes` | accept defaults, no prompts |

Nothing is published to npm, so `--dep` defaults to a `link:` pointing at this
checkout: generated projects pick up library edits immediately. Pass a git tag
or version once that changes.

## Templates

Three layers, applied in order so each may override the last:

```
templates/common/    → project root      README, CLAUDE.md, .gitignore, .prettierrc
templates/base/      → <target srcRoot>  i18n, locales, example screen, app.css
templates/<target>/  → project root      entry points, build config, package.json
```

`srcRoot` differs per target (`src`, `src/renderer/src`, `src`), which is the
only reason the shared layer needs indirection at all. Files are plain sources
with `__TOKEN__` placeholders; an unknown token is left in place rather than
blanked, so a typo is visible in the output instead of silently vanishing.

## Things the templates encode, learned the hard way

Each of these was a real build failure while getting the three targets green:

- **Vite and Electron need `resolve.dedupe`.** The linked library carries its
  own `node_modules`, so React loads twice and every hook throws
  `Cannot read properties of null (reading 'useContext')`.
- **Next must NOT alias `react`/`react-dom`.** It looks like the same fix, but
  Next resolves React differently for the server graph (the `react-server`
  export condition); a blunt alias collapses that and prerendering dies with
  `Cannot read properties of null (reading 'useState')`. `transpilePackages`
  handles React on its own.
- **Next does need the alias for `i18next`/`react-i18next`.** Two instances
  otherwise: the app initialises one, the grid reads the other, and the toolbar
  renders raw keys like `table.groupHint`.
- **`dynamic(..., { ssr: false })` only works inside a Client Component**, so
  the generated page carries `'use client'`.
- **A `.d.ts` must not sit beside its `.ts`.** `preload/index.d.ts` shadowed
  `preload/index.ts`, so `import type { Api } from './index'` resolved to
  itself and `window.api` lost its typing. It is `preload/env.d.ts` now.

## Verifying a change

Generating is not enough — the templates have to build:

```bash
pnpm --filter @rindra/create-app build
cd /some/short/path
node <repo>/packages/create-app/dist/index.js t1 --target vite --yes
cd t1 && pnpm typecheck && pnpm build
```

Use a short path. Under a deep directory, pnpm's `.pnpm` layout crosses
Windows' 260-character limit and `electron-vite` fails with a misleading
`ERR_REQUIRE_CYCLE_MODULE`.
