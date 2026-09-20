# __APP_NAME__

__TARGET_LABEL__ application built on [`@rindra/desktop`](https://github.com/rindra/libraries).

```bash
pnpm install
__DEV_COMMAND__
```

## What is already wired

- **`@rindra/desktop`** — data grid, accent/theme system, command bus, tokens
- **i18next** — seeded with the library's `table.*` strings (fr / en / mg); this
  app's own strings live in `__SRC_ROOT__/locales/fr.json`
- **Theme** — accent `__ACCENT__`, three display modes, persisted across launches
- **An example screen** at `__SRC_ROOT__/screens/RecordsScreen.tsx`, showing a grid
  with grouping, filters, export and a totals row

## Scripts

| | |
| --- | --- |
| `__DEV_COMMAND__` | start in development |
| `pnpm build` | production build |
| `pnpm typecheck` | types only, no emit |

See [CLAUDE.md](CLAUDE.md) for the conventions that keep this app consistent.
