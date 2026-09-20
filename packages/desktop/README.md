# @rindra/desktop

Desktop-application chrome for React + antd, extracted from three shipped copies
of the same code rather than designed up front.

The centrepiece is a data grid with grouping, column resizing, pinning,
multi-sort, a filter builder, floating per-column filters, keyboard cell
navigation, CSV export and print — the parts of a commercial grid suite that
actually got used, on top of antd's `Table` rather than instead of it.

## Install

```bash
pnpm add @rindra/desktop
```

Peers you already have: `react`, `react-dom`, `antd` 6, `@ant-design/icons` 6,
`react-i18next`.

## Setup

```tsx
import { App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import {
  AccentProvider,
  CommandsProvider,
  DataTableConfigProvider,
  DesktopHostProvider,
} from '@rindra/desktop';
import '@rindra/desktop/styles.css';

<DesktopHostProvider host={electronHost}>
  <AccentProvider locale={frFR}>
    <AntApp>
      <CommandsProvider>
        <DataTableConfigProvider config={{ PrintPreview }}>
          <Screen />
        </DataTableConfigProvider>
      </CommandsProvider>
    </AntApp>
  </AccentProvider>
</DesktopHostProvider>;
```

`AntApp` (antd's own) is required — the grid raises notifications through
`App.useApp()`.

### Translations

The grid looks up 54 keys under `table.*`. Merge the bundled strings into
i18next, yours last so they win:

```ts
import { desktopLocales } from '@rindra/desktop';

i18n.init({
  resources: { fr: { translation: { ...desktopLocales.fr, ...mine.fr } } },
});
```

French, English and Malagasy ship with the package.

## The host adapter

Saving, revealing and opening files are things a browser cannot do properly, so
the library asks its host instead of reaching for `window.api`. That indirection
is what lets the same package serve an Electron build and a web build.

```ts
const electronHost: DesktopHost = {
  saveDocument: (name, content) => window.api.enregistrerDocument(name, content),
  revealFile: (p) => window.api.montrerFichier(p),
  openFile: (p) => window.api.ouvrirFichier(p),
  setChromePrefs: (prefs) => void window.api.setChromePrefs(prefs),
};
```

Every member is optional. Omit the provider entirely and a web build still
exports CSV, through an anchor download; the "reveal / open" buttons on the
success notification simply don't appear, because there is no path to open.

## DataTable

```tsx
const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  {
    key: 'solde',
    title: 'Solde',
    dataIndex: 'solde',
    exportValue: (r) => r.solde,                       // plain text for CSV, print, grouping
    aggregate: (leaves) => sum(leaves),                // shown on a group row
    footer: (rows) => sum(rows),                       // sticky totals row
  },
];

<DataTable<Eleve>
  tableId="eleves"        // persists density, widths, sort, grouping, page size
  rowKey="id"
  columns={columns}
  dataSource={rows}
  exportName="eleves"     // enables CSV export
  groupable resizable filterable searchable
  rowNumbers multiSort pinnable columnControls
  emptyState={{ title: 'Aucun élève' }}
/>;
```

`tableId` is the persistence key — give each grid its own, and keep it stable,
or users lose their column widths on rename.

Everything `antd`'s `Table` accepts still passes through.

### Printing

Print needs letterheads, paper sizes and logos, which are app concerns. The grid
only flattens its rows and hands them over:

```tsx
function PrintPreview({ open, data, onClose }: TablePrintProps) { ... }

<DataTableConfigProvider config={{ PrintPreview }}>
```

Configure no renderer and the print action disappears rather than opening an
empty modal.

## Theming

`AccentProvider` owns a brand accent and a display mode (`clair` / `sombre` /
`noir`), writing both to CSS variables (`--chrome-accent`, `--accent-readable`,
`data-theme`) and to antd's theme, so hand-painted chrome and antd components
stay in sync. Both persist in `localStorage`.

```tsx
<AccentProvider
  presets={[{ key: 'brand', color: '#2b579a' }]}
  defaultAccent="brand"
  defaultMode="sombre"
  theme={myAntdTheme}              // layered under the accent
  storageKeys={{ accent: 'app:accent' }}   // namespace when apps share an origin
/>
```

## Command bus

Lets a ribbon or toolbar invoke the *active screen's* own handlers instead of
duplicating them, and grey out commands nothing handles:

```tsx
// in a screen
useScreenCommands({ 'eleve:new': () => setModal(true) });

// in the ribbon
const { run, available } = useCommands();
<Button disabled={!available.has('eleve:new')} onClick={() => run('eleve:new')} />;
```

A command dispatched while its screen is unmounted is queued once, so
"navigate, then act" works — the target screen flushes it on mount.

## What is deliberately not here

`Ribbon`, `NavPane`, `TitleBar`, `StatusBar` and `PrintPreview` are still in the
apps. The first four had diverged too far between copies to merge without
guessing; `PrintPreview` reaches into app auth, templates and barcodes. They are
phase two, and they need a decision about what is framework and what is app —
not a copy.
