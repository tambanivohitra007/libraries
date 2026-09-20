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
import { PrintPreview } from '@rindra/desktop/print';
import '@rindra/desktop/styles.css';
import '@rindra/desktop/print.css';

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

The grid flattens its rows and hands them to whatever renderer you configure —
see [Printing](#printing--rindradesktopprint) below. Configure none and the
print action disappears rather than opening an empty modal.

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

## Printing — `@rindra/desktop/print`

A standalone print preview, in the shape a commercial suite ships: paper sizes
and orientation, draggable margins, zoom, watermarks, editable header/footer
bands with `[Page]`/`[Pages]` tokens, a letterhead, a signature block, and
export to PDF, DOCX, XLSX, CSV, TSV and JSON.

It is a **separate entry point**, because nothing in it is needed by the grid
and an app that never prints should not carry a DOCX writer:

```tsx
import { PrintPreview } from '@rindra/desktop/print';
import '@rindra/desktop/print.css';

<DataTableConfigProvider config={{ PrintPreview }}>
```

That is the whole wiring — its props are exactly the grid's `TablePrintProps`.
Reach for `DocumentPreview` directly for a document that did not come from a
grid, or when you want your own labels or deps.

### What needs a host

Everything works in a browser except the four things a browser genuinely
cannot do. Those come from `PreviewDeps`, and without them the preview hides
those actions rather than offering a dead button:

| | |
| --- | --- |
| `exportPdf` | a real PDF, with page numbers in the bands |
| `printSilent` | print without the browser dialog |
| `exportXlsx` | a laid-out spreadsheet (CSV always works) |
| `getEtablissement` / `getLogo` / `getEnteteConfig` | the stored letterhead |

Saving, revealing and opening files are **not** in that list — they come from
the same `DesktopHost` you already configured, so an app implements one native
save dialog, not two.

```tsx
<DocumentPreview deps={{ exportPdf: (html, name) => window.api.exportPdf(html, name) }} … />
```

### Labels

`PreviewMessages` covers every string, French by default, and the module runs
with **no i18n library at all**. `PrintPreview` bridges them to i18next under
`print.preview.*`; pass `messages` to `DocumentPreview` to override.

## What is deliberately not here

`Ribbon`, `NavPane`, `TitleBar` and `StatusBar` are still in the apps: they had
diverged too far between copies to merge without guessing. Extracting them needs
a decision about what is framework and what is app — the `Ribbon` in particular
was 68% different between two copies, which usually means the *registry* is
library material and the layout is not.
