/**
 * @rindra/desktop — the shared chrome behind the desktop apps.
 *
 * Extracted from three divergent copies of the same code rather than designed
 * up front, so everything here has already earned its place in a shipped app.
 * Styles are a separate import: `import '@rindra/desktop/styles.css'`.
 */

// ── Host adapter ───────────────────────────────────────────────────────────
// What the chrome needs from Electron (or the browser) to save, reveal and open
// files. Optional — browser fallbacks cover a web build.
export {
  DesktopHostProvider,
  useHost,
  type DesktopHost,
  type ResolvedHost,
  type FileFilter,
} from './host/host';

// ── Command bus ────────────────────────────────────────────────────────────
// Lets a ribbon or toolbar invoke the active screen's own handlers by id,
// greying out commands no mounted screen handles.
export { CommandsProvider, useCommands, useScreenCommands, type CommandMap } from './shell/commands';

// ── Theme ──────────────────────────────────────────────────────────────────
export {
  AccentProvider,
  useAccent,
  isCustomAccent,
  ACCENT_PRESETS,
  THEME_MODES,
  MODE_SWATCHES,
  type AccentPreset,
  type AccentProviderProps,
  type ThemeMode,
} from './theme/accent';
export { baseTheme } from './theme/base-theme';

// ── Components ─────────────────────────────────────────────────────────────
export { DataTable, type DataColumn } from './components/DataTable';
export {
  DataTableConfigProvider,
  useDataTableConfig,
  type DataTableConfig,
  type Density,
  type TablePrintData,
  type TablePrintProps,
} from './components/data-table-config';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';

// ── Locales ────────────────────────────────────────────────────────────────
// The grid's own `table.*` strings (fr / en / mg), to merge into your i18next
// resources. Without them the toolbar renders raw keys.
export { desktopLocales, type DesktopLocale } from './locales';
