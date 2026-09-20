import type { ComponentType } from 'react';

import TableBasic from './demos/table-basic';
import TableGrouping from './demos/table-grouping';
import TableFilters from './demos/table-filters';
import TableExport from './demos/table-export';
import TableMasterDetail from './demos/table-master-detail';
import CommandsDemo from './demos/commands';
import ThemingDemo from './demos/theming';
import EmptyStateDemo from './demos/empty-state';

// Vite hands us each demo's own text with `?raw`, so the snippet on screen is
// literally the file that is running. A copy-paste example cannot go stale.
import srcBasic from './demos/table-basic.tsx?raw';
import srcGrouping from './demos/table-grouping.tsx?raw';
import srcFilters from './demos/table-filters.tsx?raw';
import srcExport from './demos/table-export.tsx?raw';
import srcMasterDetail from './demos/table-master-detail.tsx?raw';
import srcCommands from './demos/commands.tsx?raw';
import srcTheming from './demos/theming.tsx?raw';
import srcEmptyState from './demos/empty-state.tsx?raw';

export interface PropRow {
  name: string;
  type: string;
  default: string;
  note: string;
}

export interface Demo {
  id: string;
  group: string;
  title: string;
  blurb: string;
  Component: ComponentType;
  source: string;
  props?: PropRow[];
}

const GRID_PROPS: PropRow[] = [
  {
    name: 'tableId',
    type: 'string',
    default: '— required',
    note: 'Persistence key for density, widths, sort, grouping and page size. Keep it stable; renaming it loses the user’s layout.',
  },
  {
    name: 'columns',
    type: 'DataColumn<T>[]',
    default: '— required',
    note: 'antd columns plus exportValue, aggregate, footer and groupable.',
  },
  { name: 'groupable', type: 'boolean', default: 'false', note: 'Drag-a-header-here grouping band.' },
  { name: 'resizable', type: 'boolean', default: 'false', note: 'Drag column borders; widths persist.' },
  {
    name: 'filterable',
    type: 'boolean',
    default: 'false',
    note: 'Filter builder plus per-column floating filters.',
  },
  {
    name: 'floatingFiltersDefault',
    type: 'boolean',
    default: 'false',
    note: 'Show the floating filter row from the start rather than behind a toggle.',
  },
  { name: 'searchable', type: 'boolean', default: 'false', note: 'Toolbar quick search across text columns.' },
  { name: 'multiSort', type: 'boolean', default: 'false', note: 'Shift-click headers to sort by several columns.' },
  { name: 'pinnable', type: 'boolean', default: 'false', note: 'Pin rows top or bottom through sort and scroll.' },
  { name: 'rowNumbers', type: 'boolean', default: 'false', note: 'Leading row-number column, absolute across pages.' },
  { name: 'columnControls', type: 'boolean', default: 'false', note: 'Show/hide and reorder columns from the toolbar.' },
  { name: 'exportName', type: 'string', default: 'undefined', note: 'Sets the CSV filename and enables export.' },
  {
    name: 'enablePrint',
    type: 'boolean',
    default: 'true',
    note: 'Print still needs a PrintPreview in DataTableConfigProvider, or the action hides itself.',
  },
  { name: 'emptyState', type: 'EmptyStateProps', default: 'undefined', note: 'Friendly placeholder instead of “no data”.' },
  {
    name: 'rowClickSelects',
    type: 'boolean',
    default: 'true',
    note: 'Set false when a click means “inspect”, e.g. master-detail.',
  },
  { name: 'keyboardNavigation', type: 'boolean', default: 'true', note: 'Arrow-key cell cursor.' },
  { name: 'onActiveRowChange', type: '(row: T) => void', default: 'undefined', note: 'Follows the cursor, mouse or keyboard.' },
  { name: 'onRowEnter', type: '(row: T) => void', default: 'undefined', note: 'Enter on the current row, when it differs from a click.' },
  {
    name: 'onFilteredRowsChange',
    type: '(rows: readonly T[]) => void',
    default: 'undefined',
    note: 'Everything surviving search and filters, before pagination.',
  },
  { name: 'rowContextItems', type: '(row: T) => MenuProps["items"]', default: 'undefined', note: 'Extra right-click entries above the grid’s own.' },
];

const COLUMN_PROPS: PropRow[] = [
  {
    name: 'exportValue',
    type: '(row: T) => string | number',
    default: 'dataIndex',
    note: 'Plain text for CSV, print, grouping and filtering. Give it whenever the column has a custom render.',
  },
  { name: 'aggregate', type: '(leaves: T[]) => ReactNode', default: 'undefined', note: 'Value shown on a group header row.' },
  { name: 'footer', type: '(rows: T[]) => ReactNode', default: 'undefined', note: 'Any column with this turns on the sticky totals row.' },
  { name: 'groupable', type: 'boolean', default: 'true', note: 'Set false to forbid grouping by this column.' },
];

export const DEMOS: Demo[] = [
  {
    id: 'table-basic',
    group: 'DataTable',
    title: 'Basic',
    blurb:
      'The smallest useful grid: columns, rows, a search box and row numbers. Everything antd’s Table accepts still passes through.',
    Component: TableBasic,
    source: srcBasic,
    props: GRID_PROPS,
  },
  {
    id: 'table-grouping',
    group: 'DataTable',
    title: 'Grouping',
    blurb:
      'Drag a header into the band to group, drag a second to nest. Group rows carry their own aggregates; a sticky totals row sums what survived filtering.',
    Component: TableGrouping,
    source: srcGrouping,
    props: COLUMN_PROPS,
  },
  {
    id: 'table-filters',
    group: 'DataTable',
    title: 'Filters & columns',
    blurb:
      'Three filtering surfaces at once — quick search, a floating per-column row, and an and/or rule builder — plus resizable, reorderable, hideable columns.',
    Component: TableFilters,
    source: srcFilters,
  },
  {
    id: 'table-export',
    group: 'DataTable',
    title: 'Export & print',
    blurb:
      'CSV export and print. With no host configured, as here in the browser, export falls back to a download instead of a native save dialog.',
    Component: TableExport,
    source: srcExport,
  },
  {
    id: 'table-master-detail',
    group: 'DataTable',
    title: 'Master-detail',
    blurb:
      'The cell cursor drives a detail pane, so the list is navigable entirely from the keyboard. Click a row, then use ↑ and ↓.',
    Component: TableMasterDetail,
    source: srcMasterDetail,
  },
  {
    id: 'theming',
    group: 'Theming',
    title: 'Accents & modes',
    blurb:
      'One accent and one display mode drive both the CSS variables and antd’s theme. Change them here, then look at any grid demo — and reload to see them persist.',
    Component: ThemingDemo,
    source: srcTheming,
  },
  {
    id: 'commands',
    group: 'Shell',
    title: 'Command bus',
    blurb:
      'A toolbar that invokes the active screen’s own handlers by id, and greys out what nothing handles. Unmount the screen and watch the buttons disable.',
    Component: CommandsDemo,
    source: srcCommands,
  },
  {
    id: 'empty-state',
    group: 'Components',
    title: 'EmptyState',
    blurb: 'Three shapes of “nothing here”: no data yet, nothing matched, something failed.',
    Component: EmptyStateDemo,
    source: srcEmptyState,
  },
];

export const GROUPS = [...new Set(DEMOS.map((d) => d.group))];
