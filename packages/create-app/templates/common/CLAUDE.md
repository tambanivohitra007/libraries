# __APP_NAME__

__TARGET_LABEL__ app built on `@rindra/desktop`.

## Before writing UI code

The chrome — data grid, theming, command bus, empty states — comes from
`@rindra/desktop`. **Check what it already provides before building anything**;
re-implementing a grid, a theme switcher or a toolbar here is the mistake this
setup exists to prevent.

Run the library's gallery to see every component live, with its props and a
copy-paste snippet:

```bash
pnpm --dir <path-to>/libraries gallery
```

## Layout

```
__SRC_ROOT__/i18n.ts              i18next, seeded with the library's table.* keys
__SRC_ROOT__/locales/fr.json      this app's own strings
__SRC_ROOT__/screens/             one file per screen
__SRC_ROOT__/styles/app.css       app styles, imported AFTER the library's
```

## Rules that keep this app working

- **Import the library's stylesheet before your own.** `@rindra/desktop/styles.css`
  defines the design tokens (`--app-bg`, `--hairline`, `--table-surface`, …)
  that `app.css` paints with.
- **Paint with tokens, not hex.** A hardcoded colour will be wrong in two of the
  three display modes (clair / sombre / noir).
- **`tableId` is a persistence key.** It stores column widths, density, sort and
  grouping per grid. Give each grid its own, and never rename one casually —
  users lose their layout.
- **A column with a custom `render` needs an `exportValue`.** Without it, CSV,
  print, grouping and filtering all see the ReactNode instead of the value.
- **`AntApp` (antd's own) must stay mounted.** The grid raises notifications
  through `App.useApp()`.
- **Screens register commands, toolbars dispatch them.** Use `useScreenCommands`
  rather than passing handlers down; a toolbar greys out what nothing handles.

## Target-specific

__TARGET_NOTES__

## Verify

```bash
pnpm typecheck
pnpm build
```
