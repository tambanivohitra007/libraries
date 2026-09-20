import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FocusEvent as ReactFocusEvent,
  type Key,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  CaretRightOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  ControlOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FilterOutlined,
  HolderOutlined,
  PlusOutlined,
  PrinterOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Popover,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type MenuProps,
  type TablePaginationConfig,
  type TableProps,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useScreenCommands } from '../shell/commands';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { porteeBandeGroupe } from './data-table-groupes';
import { useHost } from '../host/host';
import {
  useDataTableConfig,
  type Density,
  type TablePrintData as PrintPreviewData,
} from './data-table-config';

type SortState = { field?: string; order?: 'ascend' | 'descend' };
type Operateur =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'empty'
  | 'notEmpty'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';
interface Regle {
  id: number;
  col: string;
  op: Operateur;
  value: string;
}
const OPERATEURS: Operateur[] = [
  'contains',
  'notContains',
  'equals',
  'notEquals',
  'startsWith',
  'endsWith',
  'empty',
  'notEmpty',
  'gt',
  'gte',
  'lt',
  'lte',
];
const OPS_SANS_VALEUR: ReadonlySet<Operateur> = new Set<Operateur>(['empty', 'notEmpty']);

/** antd column augmented for the shared grid:
 *  - `exportValue`: plain-text accessor for CSV/print (and grouping/filtering)
 *     when the cell renders JSX rather than a raw dataIndex.
 *  - `aggregate`: value shown on a group row for this column.
 *  - `groupable`: set false to forbid grouping by this column. */
export type DataColumn<T> = NonNullable<TableProps<T>['columns']>[number] & {
  exportValue?: (record: T) => string | number;
  aggregate?: (leaves: T[]) => ReactNode;
  groupable?: boolean;
  /** When set on any column, a sticky totals row is shown; this returns the
   *  column's aggregate over the currently filtered rows. */
  footer?: (rows: T[]) => ReactNode;
};

interface DataTableProps<T> extends Omit<TableProps<T>, 'columns' | 'size' | 'title'> {
  /** Stable id used to persist density / page size / sort / grouping / widths. */
  tableId: string;
  columns: DataColumn<T>[];
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  exportName?: string;
  /** Show the print-preview action. Default `true`; pass `false` to hide it. */
  enablePrint?: boolean;
  /** Enable the AG-Grid-style "drag a header here to group" panel. */
  groupable?: boolean;
  /** Leading auto-incrementing row-number column (absolute across pages). */
  rowNumbers?: boolean;
  /** Drag column borders to resize; widths persist per `tableId`. */
  resizable?: boolean;
  /** Advanced filter builder + per-column floating quick-filters. */
  filterable?: boolean;
  /** Show the per-column floating filter row from the start, instead of
   *  requiring a trip through the filter popover's switch. Still a normal
   *  toggle after that — the user's choice persists per `tableId` like any
   *  other preference. Default `false`. */
  floatingFiltersDefault?: boolean;
  /** Pin rows to the top or bottom so they stay through sort/scroll. */
  pinnable?: boolean;
  /** Multi-column sort: shift-click headers to sort by several columns. */
  multiSort?: boolean;
  /** Toolbar quick-search box filtering across all text columns. */
  searchable?: boolean;
  /** Toolbar panel to show/hide and drag-reorder columns. */
  columnControls?: boolean;
  /** Friendly empty placeholder (icon + message + CTA) when there are no rows. */
  emptyState?: EmptyStateProps;
  /** Whether clicking a row's body selects it. Default `true`. Pass `false` when
   *  the screen gives the row click another meaning (e.g. driving a master-detail
   *  panel): checkbox selection then happens through the checkboxes only. */
  rowClickSelects?: boolean;
  /** Arrow-key cell cursor (on by default): the grid keeps a current row/cell,
   *  moves it with the keyboard and focuses it. Pass `false` to opt out. */
  keyboardNavigation?: boolean;
  /** The current row changed — through a click or the keyboard. Lets a screen
   *  follow the cursor (e.g. a master-detail pane). Group headers don't fire it. */
  onActiveRowChange?: (record: T) => void;
  /** Enter on the current row. Give this when "activate" differs from a click —
   *  e.g. a master-detail list where a click only moves the cursor, so Enter is
   *  the keyboard's double-click. Without it, Enter replays a click on the cell,
   *  which is right for grids where the click *is* the action. */
  onRowEnter?: (record: T) => void;
  /** The rows behind the current search/filter changed (search box, floating
   *  filters, filter builder) — everything that survives, before pagination
   *  slices it into a page. Lets a screen build its own summary (a count, a
   *  breakdown) that lives outside the grid, e.g. in `pagination.showTotal`,
   *  instead of a `footer` column glued to the table's own column grid. */
  onFilteredRowsChange?: (rows: readonly T[]) => void;
  /** Screen-specific entries for the right-click menu, shown above the grid's own
   *  (copy / pin / filter / export). Called with the row that was right-clicked;
   *  each item carries its own `onClick`. Keeps a row action off the actions
   *  column without hiding it in a toolbar. */
  rowContextItems?: (record: T) => MenuProps['items'];
}

interface GroupRow {
  __group: true;
  __key: string;
  __value: string;
  __count: number;
  __leaves: unknown[];
  __depth?: number;
  children?: unknown[];
}

function isGroupRow(r: unknown): r is GroupRow {
  return !!r && typeof r === 'object' && (r as { __group?: boolean }).__group === true;
}

/**
 * Flattens the group tree into an ordered, paginatable list: a header row per
 * group followed (when not collapsed) by its sub-groups or leaf rows. Children
 * are dropped from the emitted header rows so antd never tree-renders them — only
 * the current page's rows mount, so grouping a huge dataset never freezes.
 */
function flattenGroups(
  nodes: readonly unknown[],
  depth: number,
  collapsed: Record<string, boolean>,
  out: unknown[],
  /** Rempli au passage : ligne feuille → groupe qui la contient. Sert à n'animer
   *  que les lignes du groupe qu'on vient de déplier. */
  parGroupe?: Map<unknown, string>,
  parent?: string,
): void {
  for (const node of nodes) {
    if (isGroupRow(node)) {
      out.push({
        __group: true,
        __key: node.__key,
        __value: node.__value,
        __count: node.__count,
        __leaves: node.__leaves,
        __depth: depth,
      } satisfies GroupRow);
      if (!collapsed[node.__key]) {
        flattenGroups(node.children ?? [], depth + 1, collapsed, out, parGroupe, node.__key);
      }
    } else {
      out.push(node);
      if (parGroupe && parent !== undefined) parGroupe.set(node, parent);
    }
  }
}

function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function colKey<T>(c: DataColumn<T>): string {
  if (c.key != null) return String(c.key);
  if ('dataIndex' in c && typeof c.dataIndex === 'string') return c.dataIndex;
  return '';
}

function isColGroupable<T>(c: DataColumn<T>): boolean {
  if (c.groupable === false) return false;
  if (colKey(c) === 'actions') return false;
  return Boolean(c.exportValue) || ('dataIndex' in c && typeof c.dataIndex === 'string');
}

/** Plain text of a cell for grouping/filtering/export (reuses exportValue). */
function cellText<T>(c: DataColumn<T>, r: T): string {
  if (c.exportValue) {
    const v = c.exportValue(r);
    return v == null ? '' : String(v);
  }
  const di = (c as { dataIndex?: string }).dataIndex;
  if (typeof di === 'string') {
    const v = (r as Record<string, unknown>)[di];
    return v == null ? '' : String(v);
  }
  return '';
}

/** The group value of a record for a column (empty renders as an em dash). */
function columnGroupValue<T>(c: DataColumn<T>, r: T): string {
  const v = cellText(c, r);
  return v === '' ? '—' : v;
}

function colTitle<T>(c: DataColumn<T>): string {
  return typeof c.title === 'string' ? c.title : colKey(c);
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercase + strip accents, for accent-insensitive quick search. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

function matchOperator(cell: string, op: Operateur, value: string): boolean {
  const a = cell.toLowerCase();
  const b = value.toLowerCase();
  switch (op) {
    case 'contains':
      return a.includes(b);
    case 'notContains':
      return !a.includes(b);
    case 'equals':
      return a === b;
    case 'notEquals':
      return a !== b;
    case 'startsWith':
      return a.startsWith(b);
    case 'endsWith':
      return a.endsWith(b);
    case 'empty':
      return cell.trim() === '';
    case 'notEmpty':
      return cell.trim() !== '';
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const x = Number(cell.replace(/\s/g, '').replace(',', '.'));
      const y = Number(value.replace(/\s/g, '').replace(',', '.'));
      if (Number.isNaN(x) || Number.isNaN(y)) return false;
      return op === 'gt' ? x > y : op === 'gte' ? x >= y : op === 'lt' ? x < y : x <= y;
    }
  }
}

/** Recursively fold rows into a tree of group nodes by the ordered columns. */
function buildGroups<T>(
  rows: T[],
  cols: DataColumn<T>[],
  depth: number,
  prefix: string,
): unknown[] {
  if (depth >= cols.length) return rows as unknown[];
  const c = cols[depth];
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const v = columnGroupValue(c, r);
    if (!map.has(v)) {
      map.set(v, []);
      order.push(v);
    }
    map.get(v)?.push(r);
  }
  return order.map((v) => {
    const leaves = map.get(v) ?? [];
    const key = `${prefix}::${colKey(c)}=${v}`;
    return {
      __group: true,
      __key: key,
      __value: v,
      __count: leaves.length,
      __leaves: leaves,
      children: buildGroups(leaves, cols, depth + 1, key),
    } satisfies GroupRow;
  });
}

function resolveRowKey<T>(rowKey: TableProps<T>['rowKey'], record: T): Key {
  if (typeof rowKey === 'function') return rowKey(record);
  if (typeof rowKey === 'string') return (record as Record<string, unknown>)[rowKey] as Key;
  return (record as Record<string, unknown>)['key'] as Key;
}

function comparatorOf<T>(c: DataColumn<T> | undefined): ((a: T, b: T) => number) | undefined {
  if (!c?.sorter) return undefined;
  if (typeof c.sorter === 'function') return c.sorter as (a: T, b: T) => number;
  if (typeof c.sorter === 'object' && 'compare' in c.sorter && c.sorter.compare) {
    return c.sorter.compare as (a: T, b: T) => number;
  }
  return undefined;
}

function exportableCols<T>(columns: DataColumn<T>[]): DataColumn<T>[] {
  return columns.filter(
    (c) => c.exportValue || ('dataIndex' in c && typeof c.dataIndex === 'string'),
  );
}

function toMatrix<T>(columns: DataColumn<T>[], rows: readonly T[]): [string[], string[][]] {
  const cols = exportableCols(columns);
  const headers = cols.map((c) => colTitle(c));
  const matrix = rows.map((r) => cols.map((c) => cellText(c, r)));
  return [headers, matrix];
}

/** Best-effort plain text from a column footer's ReactNode (string/number, or a
 *  wrapping element like <strong>/<Tag> — we read its children). */
function reactNodeToText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return reactNodeToText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

/** A totals row (aligned to the exportable columns) when any column has a footer. */
function buildTotals<T>(columns: DataColumn<T>[], rows: readonly T[]): string[] | undefined {
  const cols = exportableCols(columns);
  if (!cols.some((c) => typeof c.footer === 'function')) return undefined;
  return cols.map((c) => (c.footer ? reactNodeToText(c.footer(rows as T[])) : ''));
}

/** Plain CSV text, BOM-prefixed so Excel opens UTF-8 accents (é, à…) correctly. */
function csvText(headers: string[], rows: string[][]): string {
  const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`;
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
}

const stop = (e: ReactMouseEvent): void => e.stopPropagation();

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'button,a,input,textarea,select,label,[role="button"],[role="menuitem"],[contenteditable="true"],.ant-btn,.ant-dropdown,.ant-select,.ant-checkbox-wrapper,.ant-radio-wrapper,.dt-resize-handle',
    ),
  );
}

/** Resizable header cell — a drag handle on the right edge (no extra deps). */
function ResizableTitle(
  props: React.ThHTMLAttributes<HTMLTableCellElement> & {
    onResize?: (width: number) => void;
    width?: number;
  },
): React.JSX.Element {
  const { onResize, width, children, style, ...rest } = props;
  if (typeof width !== 'number' || !onResize) {
    return (
      <th {...rest} style={style}>
        {children}
      </th>
    );
  }
  const startDrag = (e: ReactMouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;
    const move = (ev: globalThis.MouseEvent): void =>
      onResize(Math.max(60, startW + ev.clientX - startX));
    const up = (): void => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('dt-resizing');
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.classList.add('dt-resizing');
  };
  // `position: relative` anchors the absolute resize handle — but it must NOT
  // clobber the `position: sticky` antd sets on fixed-left/right columns (else
  // their headers unstick and collide at the fixed/scroll boundary). So let any
  // incoming sticky position win; a sticky cell is still a positioning context
  // for the handle.
  return (
    <th {...rest} style={{ position: 'relative', ...style }}>
      {children}
      <span className="dt-resize-handle" onMouseDown={startDrag} onClick={stop} />
    </th>
  );
}

/**
 * Shared list grid built on antd Table (plan §9.3 / D-010): a toolbar with
 * density control and CSV/print export, sticky header, zebra rows, and density /
 * page size / sort / grouping / column widths persisted per `tableId`. Opt-in
 * extras bring AG-Grid-style behaviour without the Enterprise dependency:
 * row grouping (`groupable`), an advanced filter builder + floating per-column
 * filters (`filterable`), column resizing (`resizable`), an auto row-number
 * column (`rowNumbers`), and row pinning to top/bottom (`pinnable`).
 */
export function DataTable<T extends object>({
  tableId,
  columns,
  toolbarLeft,
  toolbarRight,
  exportName,
  enablePrint = true,
  groupable,
  rowNumbers,
  resizable,
  filterable,
  floatingFiltersDefault,
  pinnable,
  multiSort,
  searchable,
  columnControls,
  emptyState,
  rowClickSelects = true,
  keyboardNavigation = true,
  onActiveRowChange,
  onRowEnter,
  onFilteredRowsChange,
  rowContextItems,
  dataSource,
  pagination,
  onChange,
  onRow,
  className,
  scroll,
  rowKey,
  rowSelection,
  rowClassName,
  ...rest
}: DataTableProps<T>): React.JSX.Element {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const host = useHost();
  const { defaultDensity, PrintPreview } = useDataTableConfig();
  // Printing needs a renderer from the host app (letterhead, paper, logos). With
  // none configured the action would open an empty modal, so it simply isn't offered.
  const canPrint = enablePrint && PrintPreview != null;

  const [density, setDensity] = useState<Density>(() =>
    loadPref<Density>(`dt:${tableId}:density`, defaultDensity()),
  );
  const [pageSize, setPageSize] = useState<number>(() =>
    loadPref<number>(
      `dt:${tableId}:pageSize`,
      typeof pagination === 'object' && pagination?.pageSize ? pagination.pageSize : 10,
    ),
  );
  const [page, setPage] = useState(1);
  const [sorts, setSorts] = useState<SortState[]>(() => {
    const legacy = loadPref<SortState>(`dt:${tableId}:sort`, {});
    return loadPref<SortState[]>(`dt:${tableId}:sorts`, legacy.field ? [legacy] : []);
  });
  const [groupKeys, setGroupKeys] = useState<string[]>(() =>
    groupable ? loadPref<string[]>(`dt:${tableId}:groups`, []) : [],
  );
  // Per-group collapsed state (grouped mode renders a flat, paginated list).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dragOver, setDragOver] = useState(false);
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    resizable ? loadPref<Record<string, number>>(`dt:${tableId}:widths`, {}) : {},
  );
  const [showFloating, setShowFloating] = useState<boolean>(() =>
    filterable
      ? loadPref<boolean>(`dt:${tableId}:floating`, floatingFiltersDefault ?? false)
      : false,
  );
  const [floatVals, setFloatVals] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<Regle[]>([]);
  const [logique, setLogique] = useState<'AND' | 'OR'>('AND');
  const [pinsTop, setPinsTop] = useState<string[]>(() =>
    pinnable ? loadPref<string[]>(`dt:${tableId}:pinsTop`, []) : [],
  );
  const [pinsBottom, setPinsBottom] = useState<string[]>(() =>
    pinnable ? loadPref<string[]>(`dt:${tableId}:pinsBottom`, []) : [],
  );
  const [ctx, setCtx] = useState<{ rowKey?: string; col?: string } | null>(null);
  const [preview, setPreview] = useState<PrintPreviewData | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<InputRef>(null);

  // Ctrl/Cmd+F focuses the search box (there is no browser find bar in the
  // app, so the shortcut users reach for should land here): the built-in quick
  // search when `searchable`, else a search input the CALLER placed in the
  // toolbar (e.g. the élèves screen's server-side Input.Search). With several
  // tables mounted at once: a hidden table (inactive view) never claims the
  // key, a table behind an open modal/drawer yields to the one inside it, and
  // `defaultPrevented` stops a second visible table from double-handling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'f' || e.defaultPrevented) return;
      const root = rootRef.current;
      if (!root || root.offsetParent === null) return; // not visible
      const overlays = Array.from(
        document.querySelectorAll<HTMLElement>('.ant-modal-wrap, .ant-drawer-open'),
      ).filter((el) => el.style.display !== 'none');
      if (overlays.length > 0 && !overlays.some((el) => el.contains(root))) return;
      const cible =
        (searchable ? searchRef.current?.input : null) ??
        root.querySelector<HTMLInputElement>(
          '.data-table__toolbar .ant-input-search input.ant-input',
        ) ??
        root.querySelector<HTMLInputElement>('.data-table__toolbar input.ant-input');
      if (!cible) return; // no search box anywhere — leave the key alone
      e.preventDefault();
      cible.focus();
      cible.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchable]);
  const [clickSelectedRowKey, setClickSelectedRowKey] = useState<string>();
  const [colOrder, setColOrder] = useState<string[]>(() =>
    columnControls ? loadPref<string[]>(`dt:${tableId}:colOrder`, []) : [],
  );
  const [hiddenCols, setHiddenCols] = useState<string[]>(() =>
    columnControls ? loadPref<string[]>(`dt:${tableId}:hidden`, []) : [],
  );

  function persist(suffix: string, value: unknown): void {
    localStorage.setItem(`dt:${tableId}:${suffix}`, JSON.stringify(value));
  }

  function changeGroups(next: string[]): void {
    setGroupKeys(next);
    setPage(1);
    persist('groups', next);
  }
  /** Ligne feuille → groupe qui la contient, refait à chaque aplatissement. */
  const groupeDeLaLigne = useRef<Map<unknown, string>>(new Map());
  /** Le groupe qu'on vient de déplier : ses lignes s'animent à l'apparition, le
   *  temps d'un rendu. Un repli, lui, ne s'anime pas — ses lignes quittent le
   *  jeu de données, il n'y a plus rien à faire sortir. */
  const [groupeDeplie, setGroupeDeplie] = useState<string | null>(null);
  const toggleGroup = useCallback(
    (key: string): void => {
      // L'état suivant se lit ici, pas dans l'actualiseur : y appeler un second
      // `setState` le rendrait impur, et React rejoue les actualiseurs.
      const replie = !collapsed[key];
      setCollapsed((prev) => ({ ...prev, [key]: replie }));
      setGroupeDeplie(replie ? null : key);
    },
    [collapsed],
  );
  // L'animation ne dure qu'un instant : sans cet oubli, changer de page ou de
  // tri la rejouerait sur les mêmes lignes.
  useEffect(() => {
    if (groupeDeplie === null) return;
    const id = setTimeout(() => setGroupeDeplie(null), 400);
    return () => clearTimeout(id);
  }, [groupeDeplie]);
  function setWidth(key: string, w: number): void {
    setWidths((prev) => {
      const next = { ...prev, [key]: w };
      persist('widths', next);
      return next;
    });
  }
  function setFloat(key: string, v: string): void {
    setFloatVals((prev) => ({ ...prev, [key]: v }));
  }
  function setPin(key: string, where: 'top' | 'bottom' | null): void {
    const top = pinsTop.filter((k) => k !== key);
    const bottom = pinsBottom.filter((k) => k !== key);
    if (where === 'top') top.push(key);
    if (where === 'bottom') bottom.push(key);
    setPinsTop(top);
    setPinsBottom(bottom);
    persist('pinsTop', top);
    persist('pinsBottom', bottom);
  }
  function changeColOrder(next: string[]): void {
    setColOrder(next);
    persist('colOrder', next);
  }
  function toggleHidden(key: string): void {
    const next = hiddenCols.includes(key)
      ? hiddenCols.filter((k) => k !== key)
      : [...hiddenCols, key];
    setHiddenCols(next);
    persist('hidden', next);
  }
  function resetColumns(): void {
    setColOrder([]);
    setHiddenCols([]);
    persist('colOrder', []);
    persist('hidden', []);
  }

  const grouped = groupKeys.length > 0;
  const groupCols = useMemo(
    () =>
      groupKeys
        .map((k) => columns.find((c) => colKey(c) === k))
        .filter((c): c is DataColumn<T> => Boolean(c)),
    [groupKeys, columns],
  );
  const filterableCols = useMemo(() => columns.filter((c) => isColGroupable(c)), [columns]);

  // ── Client-side filter pipeline (advanced rules + floating quick-filters) ───
  const allRows = (dataSource ?? []) as readonly T[];
  const activeRules = rules.filter((r) => r.value !== '' || OPS_SANS_VALEUR.has(r.op));
  const activeFloats = Object.entries(floatVals).filter(([, v]) => v.trim() !== '');
  const qs = searchable ? quickSearch.trim() : '';
  const filtreActif =
    (filterable && (activeRules.length > 0 || activeFloats.length > 0)) || qs !== '';

  // Stable string keys for the memo dependency arrays (cheaper than deep compare,
  // and keeps react-hooks/exhaustive-deps happy without inline expressions).
  const activeRulesKey = JSON.stringify(activeRules);
  const activeFloatsKey = JSON.stringify(activeFloats);
  const pinsTopKey = JSON.stringify(pinsTop);
  const pinsBottomKey = JSON.stringify(pinsBottom);
  const widthsKey = JSON.stringify(widths);
  const collapsedKey = JSON.stringify(collapsed);
  const floatValsKey = JSON.stringify(floatVals);
  const colOrderKey = JSON.stringify(colOrder);
  const hiddenKey = JSON.stringify(hiddenCols);
  const sortsKey = JSON.stringify(sorts);

  // We take over sorting (no-op antd comparators + a manual sort below) when
  // pinning rows or when multi-column sort is on, so both behave predictably.
  const manualSort = Boolean(pinnable || multiSort);
  function compareSorts(a: T, b: T): number {
    for (const s of sorts) {
      const cmp = comparatorOf(columns.find((c) => colKey(c) === s.field));
      if (!cmp) continue;
      const r = cmp(a, b) * (s.order === 'descend' ? -1 : 1);
      if (r !== 0) return r;
    }
    return 0;
  }

  const filtered = useMemo(() => {
    if (!filtreActif) return allRows;
    const byKey = new Map(columns.map((c) => [colKey(c), c]));
    const nq = qs ? normalize(qs) : '';
    return allRows.filter((r) => {
      if (nq && !filterableCols.some((c) => normalize(cellText(c, r)).includes(nq))) return false;
      for (const [k, v] of activeFloats) {
        const c = byKey.get(k);
        if (c && !cellText(c, r).toLowerCase().includes(v.toLowerCase())) return false;
      }
      if (activeRules.length === 0) return true;
      const test = (rule: Regle): boolean => {
        const c = byKey.get(rule.col);
        return c ? matchOperator(cellText(c, r), rule.op, rule.value) : true;
      };
      return logique === 'AND' ? activeRules.every(test) : activeRules.some(test);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, columns, filterableCols, filtreActif, logique, qs, activeRulesKey, activeFloatsKey]);

  const exportRows = filterable || searchable ? filtered : allRows;

  // Fires after render (not during) — `onFilteredRowsChange` typically feeds a
  // screen's own `setState`, which render-phase calls aren't allowed to do.
  useEffect(() => {
    onFilteredRowsChange?.(exportRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportRows]);

  // ── Row ordering: pinned rows float to the extremes (pinnable mode) ─────────
  const keyOf = (r: T): string => String(resolveRowKey(rowKey, r));

  const orderedData = useMemo(() => {
    if (grouped) {
      const tree = buildGroups(filtered as T[], groupCols, 0, 'g');
      const out: unknown[] = [];
      const parGroupe = new Map<unknown, string>();
      flattenGroups(tree, 0, collapsed, out, parGroupe);
      groupeDeLaLigne.current = parGroupe;
      return out as unknown as readonly T[];
    }
    if (!manualSort) return filterable || searchable ? filtered : dataSource;
    const base = [...(filtered as T[])];
    if (sorts.length > 0) base.sort(compareSorts);
    if (!pinnable) return base as readonly T[];
    const top = new Set(pinsTop);
    const bottom = new Set(pinsBottom);
    const t0: T[] = [];
    const mid: T[] = [];
    const b0: T[] = [];
    for (const r of base) {
      const k = keyOf(r);
      if (top.has(k)) t0.push(r);
      else if (bottom.has(k)) b0.push(r);
      else mid.push(r);
    }
    return [...t0, ...mid, ...b0] as readonly T[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filtered,
    grouped,
    groupCols,
    collapsedKey,
    manualSort,
    pinnable,
    filterable,
    searchable,
    dataSource,
    pinsTopKey,
    pinsBottomKey,
    sortsKey,
    columns,
  ]);

  /**
   * La bande d'en-tête d'un groupe : le chevron, **le nom du niveau** puis sa
   * valeur, et le compte.
   *
   * Nommer le niveau (« Parcours : Droit ») lève l'ambiguïté dès qu'on groupe sur
   * deux colonnes : l'indentation seule ne disait pas de quoi « Droit » était la
   * valeur, et le nom des colonnes ne vivait que dans les étiquettes de la barre.
   */
  const renduBandeGroupe = useCallback(
    (record: GroupRow): ReactNode => {
      const depth = record.__depth ?? 0;
      const replie = Boolean(collapsed[record.__key]);
      const colonne = groupCols[depth];
      const nomNiveau = typeof colonne?.title === 'string' ? colonne.title : null;
      return (
        <span className="data-table__group-label" style={{ paddingLeft: depth * 16 }}>
          <CaretRightOutlined className={`data-table__group-caret${replie ? '' : ' is-open'}`} />
          {nomNiveau && <span className="data-table__group-field">{nomNiveau}</span>}
          <span className="data-table__group-value">{record.__value}</span>
          <Tag>{record.__count}</Tag>
        </span>
      );
    },
    [collapsed, groupCols],
  );

  // ── Build the runtime columns ───────────────────────────────────────────────
  const dataCols = useMemo(() => {
    return columns.map((c, idx) => {
      let col: DataColumn<T> = c;
      const key = colKey(c);

      // In manual-sort mode (pinning / multi-sort) we own the ordering: a no-op
      // antd comparator keeps our order stable while the header still shows the
      // sort affordance. `multiple` enables shift-click multi-sort.
      if (c.sorter) {
        const order = sorts.find((s) => s.field === key)?.order ?? null;
        col = {
          ...col,
          sortOrder: order,
          ...(manualSort
            ? { sorter: multiSort ? { compare: () => 0, multiple: columns.length - idx } : () => 0 }
            : {}),
        };
      }

      // Floating quick-filter input embedded in the header.
      if (filterable && showFloating && isColGroupable(c)) {
        const label = c.title;
        col = {
          ...col,
          title: (
            <div className="dt-th">
              <div className="dt-th-label">{label as ReactNode}</div>
              <Input
                size="small"
                allowClear
                value={floatVals[key] ?? ''}
                placeholder={t('table.advanced.quick')}
                onChange={(e) => setFloat(key, e.target.value)}
                onClick={stop}
                onMouseDown={stop}
              />
            </div>
          ),
        };
      }

      // Sur une ligne de groupe, une colonne ordinaire n'affiche que son
      // agrégat. Le libellé, lui, est posé plus bas (voir `cols`) : il doit
      // couvrir plusieurs colonnes, ce qui ne se décide qu'une fois l'ordre et
      // la visibilité des colonnes connus.
      if (grouped) {
        const inner = col.render;
        col = {
          ...col,
          render: (value: unknown, record: T, index: number) =>
            isGroupRow(record)
              ? c.aggregate
                ? c.aggregate(record.__leaves as T[])
                : null
              : inner
                ? inner(value, record, index)
                : (value as ReactNode),
        };
      }

      // Compose the header cell: groupable drag + resizable handle/width, and
      // (when key is set) `data-dt-col` so a header right-click can tell which
      // column was targeted, same as the body cells below.
      const wantDrag = groupable && isColGroupable(c) && !grouped;
      const wantResize = resizable && key !== 'actions';
      if (wantResize) {
        const w = widths[key] ?? (typeof c.width === 'number' ? c.width : undefined);
        if (w != null) col = { ...col, width: w };
      }
      if (key) {
        const w = widths[key] ?? (typeof c.width === 'number' ? c.width : undefined);
        col = {
          ...col,
          onHeaderCell: () =>
            ({
              'data-dt-col': key,
              ...(wantDrag
                ? {
                    draggable: true,
                    onDragStart: (e: DragEvent<HTMLElement>) =>
                      e.dataTransfer.setData('text/plain', key),
                    className: 'data-table__th-draggable',
                  }
                : {}),
              ...(wantResize && w != null
                ? { width: w, onResize: (nw: number) => setWidth(key, nw) }
                : {}),
            }) as React.HTMLAttributes<HTMLElement>,
        };
      }

      // Tag body cells with their column key so the right-click menu knows which
      // column (and value) was clicked.
      const prevOnCell = col.onCell;
      col = {
        ...col,
        onCell: (record: T, index?: number) =>
          ({
            ...(prevOnCell ? (prevOnCell(record, index) as object) : {}),
            'data-dt-col': key,
          }) as React.TdHTMLAttributes<HTMLElement>,
      };
      return col;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    columns,
    sortsKey,
    manualSort,
    multiSort,
    grouped,
    groupable,
    resizable,
    filterable,
    showFloating,
    pinnable,
    widthsKey,
    floatValsKey,
    // Ni `collapsedKey` ni `toggleGroup` : depuis que la bande de groupe se rend
    // dans `cols`, ce memo ne lit plus l'état de repli. Les y laisser rebattait
    // **toutes** les colonnes à chaque bascule — antd recréait alors ses cellules
    // au milieu du clic, et re-mesurait la mise en page pour rien.
    t,
  ]);

  // Apply the user's column order + visibility (columnControls).
  const visibleDataCols = useMemo(() => {
    let list = dataCols;
    if (colOrder.length) {
      const rank = (k: string): number => {
        const i = colOrder.indexOf(k);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      list = [...dataCols].sort((a, b) => rank(colKey(a)) - rank(colKey(b)));
    }
    if (hiddenCols.length) list = list.filter((c) => !hiddenCols.includes(colKey(c)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataCols, colOrderKey, hiddenKey]);

  const cols = useMemo(() => {
    const leading: DataColumn<T>[] = [];
    if (rowNumbers) {
      const offset = pagination === false ? 0 : (page - 1) * pageSize;
      leading.push({
        key: '__rownum',
        title: t('table.advanced.rowNumber'),
        width: 56,
        align: 'center',
        fixed: 'left',
        render: (_: unknown, record: T, index: number) =>
          isGroupRow(record) ? '' : offset + index + 1,
      } as DataColumn<T>);
    }
    if (pinnable && !grouped) {
      const top = new Set(pinsTop);
      const bottom = new Set(pinsBottom);
      leading.push({
        key: '__pin',
        title: '',
        width: 40,
        align: 'center',
        fixed: 'left',
        render: (_: unknown, record: T) => {
          if (isGroupRow(record)) return null;
          const k = keyOf(record);
          const isTop = top.has(k);
          const isBottom = bottom.has(k);
          const menu: MenuProps = {
            items: [
              { key: 'top', label: t('table.advanced.pinTop') },
              { key: 'bottom', label: t('table.advanced.pinBottom') },
              ...(isTop || isBottom ? [{ key: 'none', label: t('table.advanced.unpin') }] : []),
            ],
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              setPin(k, key === 'none' ? null : (key as 'top' | 'bottom'));
            },
          };
          return (
            <Dropdown menu={menu} trigger={['click']}>
              <Button
                type="text"
                size="small"
                onClick={stop}
                icon={
                  isTop || isBottom ? (
                    <PushpinFilled className="dt-pin-on" rotate={isBottom ? 180 : 0} />
                  ) : (
                    <PushpinOutlined className="dt-pin-off" />
                  )
                }
              />
            </Dropdown>
          );
        },
      } as DataColumn<T>);
    }
    if (!grouped) return [...leading, ...visibleDataCols];

    // ── La bande d'en-tête d'un groupe ──────────────────────────────────
    // Le libellé tenait dans la première colonne de données et en héritait la
    // largeur : 56 px pour une colonne photo, où « Licence Informatique » se
    // réduisait à trois lettres. Il couvre désormais les colonnes jusqu'à la
    // première qui agrège — celles-là gardent leur cellule, leur total étant le
    // sujet même de la ligne.
    //
    // La portée s'arrête avant les colonnes de tête (N°, épingle) : elles sont
    // `fixed: 'left'` et antd ne fusionne pas au travers de cette frontière —
    // une portee qui l'enjamberait se désalignerait au défilement horizontal.
    const portee = porteeBandeGroupe(visibleDataCols);

    const donnees = visibleDataCols.map((c, i): DataColumn<T> => {
      if (i >= portee) return c;
      const precedentOnCell = c.onCell;
      const cellule = (record: T, index?: number): React.TdHTMLAttributes<HTMLElement> => ({
        ...((precedentOnCell ? precedentOnCell(record, index) : {}) as object),
        ...(isGroupRow(record) ? { colSpan: i === 0 ? portee : 0 } : {}),
      });
      if (i > 0) return { ...c, onCell: cellule };
      // La colonne du libellé : elle rend la bande, et garde son rendu d'origine
      // pour les lignes ordinaires.
      const precedentRender = c.render;
      return {
        ...c,
        onCell: cellule,
        render: (value: unknown, record: T, index: number) =>
          isGroupRow(record)
            ? renduBandeGroupe(record)
            : precedentRender
              ? precedentRender(value, record, index)
              : (value as ReactNode),
      };
    });
    return [...leading, ...donnees];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleDataCols,
    rowNumbers,
    pinnable,
    grouped,
    page,
    pageSize,
    pagination,
    pinsTopKey,
    pinsBottomKey,
    renduBandeGroupe,
    t,
  ]);

  // antd requires the selection column to be fixed-left when any data column is
  // fixed left (otherwise the fixed header layer misaligns and the first column's
  // header — e.g. the row-number "N°" — renders blank). Mirror our leading fixed
  // columns onto the selection column whenever one is present.
  const hasLeadingFixed =
    rowNumbers || pinnable || cols.some((c) => (c as { fixed?: unknown }).fixed === 'left');
  const mergedRowSelection =
    rowSelection && hasLeadingFixed ? { ...rowSelection, fixed: true } : rowSelection;
  const useClickOnlySelection = !grouped && !mergedRowSelection;

  const keyedRows = useMemo(() => {
    const map = new Map<string, T>();
    for (const r of allRows) map.set(keyOf(r), r);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows, rowKey]);

  /* ── Keyboard navigation (cell cursor) ─────────────────────────────────────
     The grid keeps a *current* row/cell — the AG-Grid / DevExpress "focused
     cell" — which is distinct from the checkbox selection: moving the cursor
     never ticks a box (Space does that, Enter activates the row like a click).
     The cursor is React state, but the focus/tabindex it implies is applied to
     the DOM in a layout effect: putting `tabIndex` in `onCell` would rebuild
     every column on each key press, forcing antd to re-measure the layout. */
  const [activeRowKey, setActiveRowKey] = useState<string>();
  const [activeColKey, setActiveColKey] = useState<string>();
  // Focus follows the cursor only when a click or a key asked for it, never as a
  // side effect of an unrelated re-render (which would steal focus mid-typing).
  const focusVouluRef = useRef(false);
  const defilementVouluRef = useRef(false);
  const celluleActiveRef = useRef<HTMLElement | null>(null);
  const celluleTabbableRef = useRef<HTMLElement | null>(null);
  const onActiveRowChangeRef = useRef(onActiveRowChange);
  onActiveRowChangeRef.current = onActiveRowChange;
  const onRowEnterRef = useRef(onRowEnter);
  onRowEnterRef.current = onRowEnter;

  // Rows in display order, unpaginated: navigating past a page boundary just
  // walks this list and moves the page under the cursor.
  const navRows = (orderedData ?? []) as readonly unknown[];
  const navKeyOf = (r: unknown): string => (isGroupRow(r) ? r.__key : keyOf(r as T));
  // Only data columns take the cursor: the row-number, pin and checkbox columns
  // carry no value to read (they're the ones without a `data-dt-col` tag).
  const navColKeys = useMemo(
    () => visibleDataCols.map((c) => colKey(c)).filter((k) => k !== ''),
    [visibleDataCols],
  );
  const paginee = pagination !== false;
  const offsetPage = paginee ? (page - 1) * pageSize : 0;

  /** Move the cursor to a row (by index in `navRows`) and a column, flipping the
   *  page when the target row lives on another one. */
  const allerA = useCallback(
    (indexCible: number, colCible: string | undefined): void => {
      if (navRows.length === 0) return;
      const i = Math.max(0, Math.min(navRows.length - 1, indexCible));
      const record = navRows[i];
      if (!record) return;
      if (paginee) {
        const pageCible = Math.floor(i / pageSize) + 1;
        if (pageCible !== page) setPage(pageCible);
      }
      setActiveRowKey(navKeyOf(record));
      if (colCible) setActiveColKey(colCible);
      focusVouluRef.current = true;
      defilementVouluRef.current = true; // keep the cursor in view as it moves
      if (!isGroupRow(record)) onActiveRowChangeRef.current?.(record as T);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navRows, paginee, page, pageSize, rowKey],
  );

  /** Row element of the cursor, for the actions that need the real DOM node. */
  function ligneActiveEl(): HTMLElement | null {
    const root = rootRef.current;
    if (!root || !activeRowKey) return null;
    return root.querySelector<HTMLElement>(
      `.ant-table-tbody tr[data-row-key="${CSS.escape(activeRowKey)}"]`,
    );
  }

  /** Enter: the screen's own activation when it gave one, otherwise a real click
   *  on the cell — which replays the whole path (its `onRow` handler, then our
   *  selection) without duplicating any of it here. */
  function activerLigneCourante(): void {
    const record = navRows.find((r) => navKeyOf(r) === activeRowKey);
    if (isGroupRow(record)) {
      toggleGroup(record.__key);
      return;
    }
    if (record !== undefined && onRowEnterRef.current) {
      onRowEnterRef.current(record as T);
      return;
    }
    celluleActiveRef.current?.click();
  }

  function onGridKeyDown(e: ReactKeyboardEvent<HTMLDivElement>): void {
    if (!keyboardNavigation || e.defaultPrevented) return;
    // Never fight a field: the floating header filters, the quick search and any
    // in-cell editor keep their own arrow/Home/End behaviour.
    const cible = e.target as HTMLElement;
    if (cible.closest('input,textarea,select,[contenteditable="true"],.ant-select')) return;
    if (navRows.length === 0 || navColKeys.length === 0) return;

    const iLigne = activeRowKey ? navRows.findIndex((r) => navKeyOf(r) === activeRowKey) : -1;
    const depart = iLigne < 0 ? offsetPage : iLigne;
    const iCol = activeColKey ? navColKeys.indexOf(activeColKey) : -1;
    const col = (i: number): string => navColKeys[Math.max(0, Math.min(navColKeys.length - 1, i))];
    const colCourante = col(Math.max(0, iCol));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        allerA(iLigne < 0 ? depart : depart + 1, colCourante);
        break;
      case 'ArrowUp':
        e.preventDefault();
        allerA(iLigne < 0 ? depart : depart - 1, colCourante);
        break;
      case 'ArrowRight':
        e.preventDefault();
        allerA(depart, col(iCol + 1));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        allerA(depart, col(iCol - 1));
        break;
      case 'PageDown':
        e.preventDefault();
        allerA(depart + (paginee ? pageSize : 10), colCourante);
        break;
      case 'PageUp':
        e.preventDefault();
        allerA(depart - (paginee ? pageSize : 10), colCourante);
        break;
      case 'Home':
        e.preventDefault();
        allerA(e.ctrlKey ? 0 : depart, col(0));
        break;
      case 'End':
        e.preventDefault();
        allerA(e.ctrlKey ? navRows.length - 1 : depart, col(navColKeys.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        activerLigneCourante();
        break;
      case ' ': {
        // Space ticks the row's checkbox when there is one (and only then), so
        // building a multi-row selection never needs the mouse.
        e.preventDefault();
        const case_ = ligneActiveEl()?.querySelector<HTMLElement>(
          '.ant-table-selection-column input',
        );
        if (case_) case_.click();
        else activerLigneCourante();
        break;
      }
      case 'Escape':
        celluleActiveRef.current?.blur();
        break;
      default:
        break;
    }
  }

  /** Tabbing (or clicking) into a cell adopts it as the cursor, so the arrows
   *  continue from where the user actually is. */
  function onGridFocus(e: ReactFocusEvent<HTMLDivElement>): void {
    if (!keyboardNavigation) return;
    const td = (e.target as HTMLElement).closest?.('td[data-dt-col]');
    const tr = td?.closest('tr[data-row-key]');
    const rk = tr?.getAttribute('data-row-key');
    const ck = td?.getAttribute('data-dt-col');
    if (!rk || !ck) return;
    if (rk !== activeRowKey) setActiveRowKey(rk);
    if (ck !== activeColKey) setActiveColKey(ck);
  }

  // Reflect the cursor into the DOM: the active cell owns the grid's single tab
  // stop (roving tabindex) and gets focus when a click/key asked for it. Runs
  // after every render because antd re-creates the cells it re-renders.
  useLayoutEffect(() => {
    if (!keyboardNavigation) return;
    const corps = rootRef.current?.querySelector('.ant-table-tbody');
    if (!corps) return;
    const active =
      activeRowKey && activeColKey
        ? corps.querySelector<HTMLElement>(
            `tr[data-row-key="${CSS.escape(activeRowKey)}"] td[data-dt-col="${CSS.escape(activeColKey)}"]`,
          )
        : null;
    const precedente = celluleActiveRef.current;
    if (precedente && precedente !== active) precedente.classList.remove('dt-cell-active');
    if (active) active.classList.add('dt-cell-active');
    celluleActiveRef.current = active;

    // Keep the grid reachable with Tab even before it has a cursor.
    const tabbable = active ?? corps.querySelector<HTMLElement>('tr[data-row-key] td[data-dt-col]');
    const precTab = celluleTabbableRef.current;
    if (precTab && precTab !== tabbable) precTab.removeAttribute('tabindex');
    if (tabbable) tabbable.tabIndex = 0;
    celluleTabbableRef.current = tabbable;

    if (active && focusVouluRef.current) {
      focusVouluRef.current = false;
      active.focus({ preventScroll: true });
      if (defilementVouluRef.current)
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      defilementVouluRef.current = false;
    }
  });

  /** Click: adopt the clicked cell as the cursor (mouse-down, so it lands in the
   *  same frame as the press). Clicks on a control inside the cell are its own. */
  const majCurseurDepuisClic = (e: ReactMouseEvent, record: T): void => {
    if (!keyboardNavigation || e.button !== 0 || isInteractiveTarget(e.target)) return;
    const td = (e.target as HTMLElement).closest<HTMLElement>('td[data-dt-col]');
    const ck = td?.getAttribute('data-dt-col') ?? navColKeys[0];
    setActiveRowKey(navKeyOf(record));
    if (ck) setActiveColKey(ck);
    focusVouluRef.current = true;
    defilementVouluRef.current = false; // the row is already under the pointer
    if (!isGroupRow(record)) onActiveRowChangeRef.current?.(record);
  };

  // Paint the selection highlight synchronously on mouse-down — in the same
  // frame as the press, the way a native datagrid does — so the row lights up
  // instantly instead of waiting for React's re-render. The authoritative state
  // change still happens in onClick below; antd re-applies the row className on
  // the next render, so this optimistic class self-heals if it ever mismatches.
  const paintSelectionNow = (e: ReactMouseEvent, record: T): void => {
    if (!rowClickSelects) return;
    if (e.button !== 0 || grouped || isGroupRow(record) || isInteractiveTarget(e.target)) return;
    if (mergedRowSelection?.getCheckboxProps?.(record).disabled) return;
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-row-key]');
    const root = tr?.closest('.data-table');
    if (!tr || !root) return;
    const SEL = 'ant-table-row-selected';
    // antd renders a separate <tr> per fixed-column block, so toggle them all.
    const rows = root.querySelectorAll<HTMLElement>(
      `tr[data-row-key="${CSS.escape(keyOf(record))}"]`,
    );
    const single = useClickOnlySelection || mergedRowSelection?.type === 'radio';
    if (single) {
      root.querySelectorAll(`tr.${SEL}`).forEach((el) => el.classList.remove(SEL));
      rows.forEach((el) => el.classList.add(SEL));
    } else if (mergedRowSelection) {
      const willSelect = !tr.classList.contains(SEL);
      rows.forEach((el) => el.classList.toggle(SEL, willSelect));
    }
  };

  const mergedOnRow: TableProps<T>['onRow'] = (record, index) => {
    const base = onRow?.(record, index) ?? {};
    return {
      ...base,
      // Une ligne de groupe **est** l'interrupteur : c'est elle qui porte l'état
      // pour les lecteurs d'écran, et son clic qui bascule (voir `onClick`).
      ...(isGroupRow(record)
        ? { 'aria-expanded': !collapsed[(record as unknown as GroupRow).__key] }
        : {}),
      onMouseDown: (e) => {
        base.onMouseDown?.(e);
        majCurseurDepuisClic(e, record);
        paintSelectionNow(e, record);
      },
      onClick: (e) => {
        base.onClick?.(e);
        // Une ligne de groupe est un interrupteur sur toute sa largeur, et c'est
        // le SEUL chemin de bascule : le libellé portait aussi son propre
        // `onClick` et un `role="button"`, ce qui le faisait passer pour une
        // commande aux yeux d'`isInteractiveTarget` — le clic sur la bande était
        // donc écarté ici, et le curseur clavier ne montait jamais sur la ligne.
        // Le garde-fou reste utile : une colonne agrégée peut porter un bouton.
        if (isGroupRow(record)) {
          if (!isInteractiveTarget(e.target)) toggleGroup(record.__key);
          return;
        }
        if (grouped) return;
        if (isInteractiveTarget(e.target)) return;
        // The screen owns the row click (master-detail): leave the checkbox
        // selection to the checkboxes.
        if (!rowClickSelects) return;

        e.stopPropagation();

        if (useClickOnlySelection) {
          setClickSelectedRowKey(keyOf(record));
          return;
        }

        if (!mergedRowSelection) return;

        const disabled = Boolean(mergedRowSelection.getCheckboxProps?.(record).disabled);
        if (disabled) return;

        const selected = new Set(
          ((mergedRowSelection.selectedRowKeys as Key[] | undefined) ?? []).map((k) => String(k)),
        );
        const k = keyOf(record);
        const wasSelected = selected.has(k);

        let nextKeys: Key[];
        if (mergedRowSelection.type === 'radio') {
          nextKeys = [resolveRowKey(rowKey, record)];
        } else {
          if (wasSelected) selected.delete(k);
          else selected.add(k);
          nextKeys = Array.from(selected);
        }

        const nextRows = nextKeys
          .map((key) => keyedRows.get(String(key)))
          .filter((row): row is T => Boolean(row));

        mergedRowSelection.onSelect?.(record, !wasSelected, nextRows, e.nativeEvent);
        mergedRowSelection.onChange?.(nextKeys, nextRows, { type: 'single' });
      },
    };
  };

  const handleChange: TableProps<T>['onChange'] = (pag, filters, sorter, extra) => {
    if (pag.current && pag.current !== page) setPage(pag.current);
    if (extra.action === 'sort') {
      const list = Array.isArray(sorter) ? sorter : [sorter];
      const next: SortState[] = list
        .filter((s) => s?.order)
        .map((s) => ({
          field: s.field ? String(s.field) : s.columnKey ? String(s.columnKey) : undefined,
          order: s.order ?? undefined,
        }));
      setSorts(next);
      persist('sorts', next);
    }
    onChange?.(pag, filters, sorter, extra);
  };

  function onDropGroup(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragOver(false);
    const key = e.dataTransfer.getData('text/plain');
    const col = columns.find((c) => colKey(c) === key);
    if (col && isColGroupable(col) && !groupKeys.includes(key)) changeGroups([...groupKeys, key]);
  }

  const densityMenu: MenuProps = {
    selectable: true,
    selectedKeys: [density],
    onClick: ({ key }) => {
      setDensity(key as Density);
      persist('density', key);
    },
    items: [
      { key: 'small', label: t('table.compact') },
      { key: 'middle', label: t('table.standard') },
      { key: 'large', label: t('table.comfortable') },
    ],
  };

  const paginationConfig: TablePaginationConfig | false =
    pagination === false
      ? false
      : {
          showSizeChanger: true,
          // The caller's pagination only supplies defaults (e.g. initial
          // pageSize, showTotal). The controlled pageSize/current/onChange must
          // win — otherwise a static `pageSize` prop clobbers the size changer
          // and the table is stuck at that size.
          ...(typeof pagination === 'object' ? pagination : {}),
          pageSize,
          current: page,
          onChange: (p) => setPage(p),
          onShowSizeChange: (_, size) => {
            setPageSize(size);
            persist('pageSize', size);
          },
        };

  const mergedRowClassName: TableProps<T>['rowClassName'] = (record, index, indent) => {
    const classes: string[] = [];
    if (isGroupRow(record)) classes.push('data-table__group-row');
    else if (groupeDeplie !== null && groupeDeLaLigne.current.get(record) === groupeDeplie) {
      classes.push('data-table__row--revelee');
    } else if (pinnable && !grouped) {
      const k = keyOf(record as T);
      if (pinsTop.includes(k)) classes.push('data-table__pinned');
      else if (pinsBottom.includes(k)) classes.push('data-table__pinned');
    }
    if (
      !isGroupRow(record) &&
      useClickOnlySelection &&
      keyOf(record as T) === clickSelectedRowKey
    ) {
      classes.push('ant-table-row-selected');
    }
    // The cursor's row — a lighter mark than the selection, like a datagrid's
    // focused row.
    if (keyboardNavigation && navKeyOf(record) === activeRowKey) classes.push('dt-row-active');
    const extra =
      typeof rowClassName === 'function'
        ? rowClassName(record, index, indent)
        : (rowClassName ?? '');
    if (extra) classes.push(extra);
    return classes.join(' ');
  };

  // Opens the print-preview modal with the currently filtered rows.
  function openPreview(): void {
    const [h, m] = toMatrix(columns, exportRows);
    setPreview({
      title: exportName ?? t('table.print'),
      headers: h,
      rows: m,
      totals: buildTotals(columns, exportRows),
    });
  }

  // Saves the CSV (currently filtered rows) through a native dialog rather than
  // a silent browser download to a fixed folder — that path leaves the file
  // path in hand, so the notification can offer to open it back up.
  async function exporterCsv(): Promise<void> {
    if (!exportName) return;
    const [h, m] = toMatrix(columns, exportRows);
    try {
      const chemin = await host.saveDocument(`${exportName}.csv`, csvText(h, m), {
        name: 'CSV',
        extensions: ['csv'],
      });
      if (chemin) annoncerExport(chemin); // null = l'utilisateur a annulé
    } catch {
      notification.error({ message: t('table.exportFailed') });
    }
  }

  /** Sparing a trip to the file explorer: lets the user open the export back up
   *  (or reveal it in the explorer) right from the success notification. */
  function annoncerExport(chemin: string): void {
    const cle = `dt-export-${chemin}`;
    notification.success({
      key: cle,
      message: t('table.exportSaved'),
      description: chemin.split(/[\\/]/).pop(),
      duration: 8,
      btn: (
        <Space>
          <Button
            size="small"
            onClick={() => {
              notification.destroy(cle);
              host.revealFile(chemin);
            }}
          >
            {t('table.revealFile')}
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              notification.destroy(cle);
              void host.openFile(chemin).then((ok) => {
                if (!ok) notification.error({ message: t('table.openFileFailed') });
              });
            }}
          >
            {t('table.openFile')}
          </Button>
        </Space>
      ),
    });
  }

  /* ── Commandes exposées au ruban ───────────────────────────────────────────
     Le ruban ne connaît pas les tableaux : il diffuse des identifiants et grise
     ce que personne ne traite. C'est ce qui rend l'onglet contextuel « Outils de
     tableau » honnête — un tableau sans sélection n'annonce pas « copier la
     sélection », il ne l'enregistre simplement pas, et le bouton s'éteint.

     Toutes réutilisent ce que le menu contextuel et la barre d'outils font déjà :
     une seule implémentation par geste, atteignable de trois endroits. */

  /** L'enregistrement de la ligne sous le curseur du clavier, s'il y en a un. */
  const enregistrementActif = (): T | undefined => {
    if (!activeRowKey) return undefined;
    const r = navRows.find((x) => navKeyOf(x) === activeRowKey);
    return isGroupRow(r) ? undefined : (r as T | undefined);
  };

  /** Les lignes cochées, dans l'ordre où le tableau les présente. */
  const lignesCochees = (): T[] => {
    const cles = new Set(
      ((mergedRowSelection?.selectedRowKeys as Key[] | undefined) ?? []).map((k) => String(k)),
    );
    return cles.size === 0 ? [] : exportRows.filter((r) => cles.has(keyOf(r)));
  };

  const copierTsv = (lignes: T[]): void => {
    if (lignes.length === 0) return;
    const [, m] = toMatrix(columns, lignes);
    void navigator.clipboard?.writeText(m.map((l) => l.join('\t')).join('\n'));
  };

  const recordActif = enregistrementActif();
  const cochees = lignesCochees();

  useScreenCommands({
    'table:export': exportName ? () => void exporterCsv() : undefined,
    'table:print': canPrint ? openPreview : undefined,
    // La valeur d'une seule cellule : demande un curseur *et* une colonne.
    'table:copy-cell':
      recordActif && activeColKey
        ? () => {
            const col = columns.find((c) => colKey(c) === activeColKey);
            if (col && recordActif) void navigator.clipboard?.writeText(cellText(col, recordActif));
          }
        : undefined,
    'table:copy-row': recordActif ? () => copierTsv([recordActif]) : undefined,
    // N'existe que s'il y a une sélection : sans cela le bouton promettrait un
    // geste qui ne copierait rien.
    'table:copy-selection': cochees.length > 0 ? () => copierTsv(cochees) : undefined,
    'table:density': (arg) => {
      const valeurs: Density[] = ['small', 'middle', 'large'];
      // Sans argument (raccourci, appel direct), on fait défiler : c'est le
      // comportement attendu d'un bouton unique.
      const cible =
        typeof arg === 'string' && (valeurs as string[]).includes(arg)
          ? (arg as Density)
          : valeurs[(valeurs.indexOf(density) + 1) % valeurs.length];
      setDensity(cible);
      persist('density', cible);
    },
  });

  const filterCount = activeRules.length + activeFloats.length;
  const tableComponents = resizable ? { header: { cell: ResizableTitle } } : undefined;

  // Empty placeholder: when filters hide everything, offer to clear them;
  // otherwise use the screen's custom empty state (icon + message + CTA).
  const emptyNode: ReactNode = filtreActif ? (
    <EmptyState
      icon={<FilterOutlined />}
      title={t('table.advanced.noResults')}
      description={t('table.advanced.noResultsSub')}
      action={
        <Button
          size="small"
          onClick={() => {
            setRules([]);
            setFloatVals({});
            setQuickSearch('');
          }}
        >
          {t('table.advanced.clear')}
        </Button>
      }
    />
  ) : emptyState ? (
    <EmptyState {...emptyState} />
  ) : undefined;
  const mergedLocale = emptyNode ? { ...(rest.locale ?? {}), emptyText: emptyNode } : rest.locale;

  // Sticky totals row: shown when any column defines a `footer` aggregate. It
  // sums over the currently filtered rows (what you see), not just the page.
  const hasFooter = !grouped && columns.some((c) => typeof c.footer === 'function');
  const summaryFn: TableProps<T>['summary'] = hasFooter
    ? () => (
        <Table.Summary fixed>
          <Table.Summary.Row className="dt-summary-row">
            {(cols as DataColumn<T>[]).map((c, i) => {
              const orig = columns.find((oc) => colKey(oc) === colKey(c));
              const content: ReactNode = orig?.footer
                ? orig.footer(exportRows as T[])
                : i === 0
                  ? t('table.advanced.total')
                  : null;
              return (
                <Table.Summary.Cell
                  key={colKey(c) || i}
                  index={i}
                  align={(c as { align?: 'left' | 'right' | 'center' }).align}
                >
                  {content}
                </Table.Summary.Cell>
              );
            })}
          </Table.Summary.Row>
        </Table.Summary>
      )
    : undefined;

  // ── Right-click context menu (AG-Grid-style) ────────────────────────────────
  const ctxEnabled = Boolean(
    groupable ||
    filterable ||
    resizable ||
    pinnable ||
    exportName ||
    canPrint ||
    rowContextItems,
  );
  const ctxRecord =
    ctx?.rowKey != null ? exportRows.find((r) => keyOf(r) === ctx.rowKey) : undefined;
  const ctxCol = ctx?.col ? columns.find((c) => colKey(c) === ctx.col) : undefined;
  const ctxValue = ctxRecord && ctxCol ? cellText(ctxCol, ctxRecord) : '';

  // Capture the right-clicked row/cell before antd's contextMenu trigger opens
  // the menu (which it positions at the cursor automatically).
  function onCtxCapture(e: ReactMouseEvent): void {
    const target = e.target as HTMLElement;
    const tr = target.closest('tr[data-row-key]');
    const th = target.closest('th');
    const td = target.closest('td');
    const rowKey = tr?.getAttribute('data-row-key') ?? undefined;
    const col = (th ?? td)?.getAttribute('data-dt-col') ?? undefined;
    setCtx(tr || th ? { rowKey, col } : {});
    // Move the cursor onto the right-clicked cell so it's visible which row the
    // menu applies to. Deliberately without notifying `onActiveRowChange`: a
    // right-click aims at the menu, it shouldn't trigger the screen's row load.
    if (keyboardNavigation && rowKey) {
      setActiveRowKey(rowKey);
      if (col) setActiveColKey(col);
    }
  }

  const ctxItems: MenuProps['items'] = (() => {
    const items: NonNullable<MenuProps['items']> = [];
    // The screen's own row actions come first — they're the reason to right-click.
    const propres = ctxRecord ? (rowContextItems?.(ctxRecord) ?? []) : [];
    if (propres.length > 0) {
      items.push(...propres);
      items.push({ type: 'divider' });
    }
    if (ctxRecord && ctxCol)
      items.push({
        key: 'copyCell',
        icon: <CopyOutlined />,
        label: t('table.advanced.ctx.copyCell'),
      });
    if (ctxRecord)
      items.push({
        key: 'copyRow',
        icon: <CopyOutlined />,
        label: t('table.advanced.ctx.copyRow'),
      });
    if (pinnable && ctxRecord && !grouped) {
      const k = keyOf(ctxRecord);
      const pinned = pinsTop.includes(k) || pinsBottom.includes(k);
      items.push({ type: 'divider' });
      items.push({ key: 'pinTop', icon: <PushpinOutlined />, label: t('table.advanced.pinTop') });
      items.push({
        key: 'pinBottom',
        icon: <PushpinOutlined />,
        label: t('table.advanced.pinBottom'),
      });
      if (pinned) items.push({ key: 'unpin', label: t('table.advanced.unpin') });
    }
    if (filterable && ctxCol && ctxValue !== '') {
      items.push({ type: 'divider' });
      items.push({
        key: 'filter',
        icon: <FilterOutlined />,
        label: t('table.advanced.ctx.filterBy', {
          value: ctxValue.length > 24 ? `${ctxValue.slice(0, 24)}…` : ctxValue,
        }),
      });
    }
    if (filterable) {
      if (!(ctxCol && ctxValue !== '')) items.push({ type: 'divider' });
      items.push({
        key: 'toggleFloating',
        icon: <FilterOutlined />,
        label: showFloating
          ? t('table.advanced.ctx.hideFilterRow')
          : t('table.advanced.ctx.showFilterRow'),
      });
    }
    if (groupable && ctxCol && isColGroupable(ctxCol)) {
      const k = colKey(ctxCol);
      items.push(
        groupKeys.includes(k)
          ? { key: 'ungroup', label: t('table.advanced.ctx.ungroup') }
          : { key: 'group', label: t('table.advanced.ctx.groupBy') },
      );
    }
    if (filtreActif)
      items.push({ key: 'clearFilters', label: t('table.advanced.ctx.clearFilters') });
    if (resizable && Object.keys(widths).length > 0)
      items.push({
        key: 'resetWidths',
        icon: <ColumnWidthOutlined />,
        label: t('table.advanced.ctx.resetWidths'),
      });
    if (exportName || canPrint) {
      items.push({ type: 'divider' });
      if (exportName)
        items.push({ key: 'export', icon: <DownloadOutlined />, label: t('table.export') });
      if (canPrint)
        items.push({ key: 'print', icon: <PrinterOutlined />, label: t('table.print') });
    }
    return items;
  })();

  function onCtxClick(key: string): void {
    switch (key) {
      case 'copyCell':
        void navigator.clipboard?.writeText(ctxValue);
        break;
      case 'copyRow':
        if (ctxRecord) {
          const [, m] = toMatrix(columns, [ctxRecord]);
          void navigator.clipboard?.writeText(m[0].join('\t'));
        }
        break;
      case 'pinTop':
        if (ctxRecord) setPin(keyOf(ctxRecord), 'top');
        break;
      case 'pinBottom':
        if (ctxRecord) setPin(keyOf(ctxRecord), 'bottom');
        break;
      case 'unpin':
        if (ctxRecord) setPin(keyOf(ctxRecord), null);
        break;
      case 'filter':
        if (ctxCol)
          setRules([
            ...rules,
            { id: Date.now(), col: colKey(ctxCol), op: 'contains', value: ctxValue },
          ]);
        break;
      case 'toggleFloating':
        setShowFloating(!showFloating);
        persist('floating', !showFloating);
        break;
      case 'group':
        if (ctxCol) changeGroups([...groupKeys, colKey(ctxCol)]);
        break;
      case 'ungroup':
        if (ctxCol) changeGroups(groupKeys.filter((g) => g !== colKey(ctxCol)));
        break;
      case 'clearFilters':
        setRules([]);
        setFloatVals({});
        break;
      case 'resetWidths':
        setWidths({});
        persist('widths', {});
        break;
      case 'export':
        if (exportName) void exporterCsv();
        break;
      case 'print':
        openPreview();
        break;
    }
    setCtx(null);
  }

  return (
    <div className="data-table" ref={rootRef}>
      <div className="data-table__toolbar">
        <Space wrap>{toolbarLeft}</Space>
        <Space>
          {toolbarRight}
          {searchable && (
            <Input
              ref={searchRef}
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('table.advanced.search')}
              title={t('table.advanced.search') + ' (Ctrl+F)'}
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              style={{ width: 200 }}
            />
          )}
          {filterable && (
            <Popover
              trigger="click"
              placement="bottomRight"
              content={
                <FilterBuilder
                  columns={filterableCols}
                  rules={rules}
                  logique={logique}
                  showFloating={showFloating}
                  onRules={setRules}
                  onLogique={setLogique}
                  onToggleFloating={(v) => {
                    setShowFloating(v);
                    persist('floating', v);
                  }}
                  onClear={() => {
                    setRules([]);
                    setFloatVals({});
                  }}
                />
              }
            >
              <Badge count={filterCount} size="small">
                <Tooltip title={t('table.advanced.filters')}>
                  <Button
                    icon={<FilterOutlined />}
                    type={filterCount > 0 ? 'primary' : 'default'}
                  />
                </Tooltip>
              </Badge>
            </Popover>
          )}
          {exportName && (
            <Tooltip title={t('table.export')}>
              <Button icon={<DownloadOutlined />} onClick={() => void exporterCsv()} />
            </Tooltip>
          )}
          {canPrint && (
            <Tooltip title={t('table.print')}>
              <Button icon={<PrinterOutlined />} onClick={openPreview} />
            </Tooltip>
          )}
          {columnControls && (
            <Popover
              trigger="click"
              placement="bottomRight"
              content={
                <ColumnPanel
                  columns={columns}
                  order={colOrder}
                  hidden={hiddenCols}
                  onOrder={changeColOrder}
                  onToggle={toggleHidden}
                  onReset={resetColumns}
                />
              }
            >
              <Tooltip title={t('table.advanced.columns')}>
                <Button icon={<ControlOutlined />} />
              </Tooltip>
            </Popover>
          )}
          <Tooltip title={t('table.density')}>
            <Dropdown menu={densityMenu} trigger={['click']}>
              <Button icon={<ColumnHeightOutlined />} />
            </Dropdown>
          </Tooltip>
        </Space>
      </div>

      {groupable && (
        <div
          className={
            dragOver ? 'data-table__groupbar data-table__groupbar--over' : 'data-table__groupbar'
          }
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
          }}
          onDrop={onDropGroup}
        >
          {groupKeys.length === 0 ? (
            <span className="data-table__groupbar-hint">
              <HolderOutlined />
              {t('table.groupHint')}
            </span>
          ) : (
            <Space size={4} wrap>
              <span className="data-table__groupbar-label">{t('table.groupedBy')}</span>
              {groupKeys.map((k) => {
                const c = columns.find((cc) => colKey(cc) === k);
                const label = c && typeof c.title === 'string' ? c.title : k;
                return (
                  <Tag
                    key={k}
                    closable
                    onClose={() => changeGroups(groupKeys.filter((g) => g !== k))}
                  >
                    {label}
                  </Tag>
                );
              })}
              <Button type="link" size="small" onClick={() => changeGroups([])}>
                {t('table.clearGroups')}
              </Button>
            </Space>
          )}
        </div>
      )}

      <Dropdown
        trigger={ctxEnabled ? ['contextMenu'] : []}
        disabled={!ctxEnabled}
        menu={{ items: ctxItems, onClick: ({ key }) => onCtxClick(key) }}
      >
        <div
          onContextMenuCapture={ctxEnabled ? onCtxCapture : undefined}
          onKeyDown={keyboardNavigation ? onGridKeyDown : undefined}
          onFocus={keyboardNavigation ? onGridFocus : undefined}
        >
          <Table<T>
            {...rest}
            key={grouped ? `g:${groupKeys.join(',')}` : 'flat'}
            className={className}
            bordered
            components={tableComponents}
            columns={cols as TableProps<T>['columns']}
            dataSource={orderedData}
            rowKey={
              grouped
                ? (record) => (isGroupRow(record) ? record.__key : resolveRowKey(rowKey, record))
                : rowKey
            }
            rowClassName={mergedRowClassName}
            onRow={mergedOnRow}
            rowSelection={grouped ? undefined : mergedRowSelection}
            size={density}
            sticky
            scroll={scroll ?? { x: 'max-content' }}
            pagination={paginationConfig}
            expandable={grouped ? undefined : rest.expandable}
            summary={summaryFn}
            locale={mergedLocale}
            onChange={handleChange}
          />
        </div>
      </Dropdown>

      {PrintPreview && (
        <PrintPreview open={preview != null} data={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

/** The advanced filter builder shown in the toolbar popover. */
function FilterBuilder<T>({
  columns,
  rules,
  logique,
  showFloating,
  onRules,
  onLogique,
  onToggleFloating,
  onClear,
}: {
  columns: DataColumn<T>[];
  rules: Regle[];
  logique: 'AND' | 'OR';
  showFloating: boolean;
  onRules: (r: Regle[]) => void;
  onLogique: (l: 'AND' | 'OR') => void;
  onToggleFloating: (v: boolean) => void;
  onClear: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const colOptions = columns.map((c) => ({ value: colKey(c), label: colTitle(c) }));
  const opOptions = OPERATEURS.map((op) => ({ value: op, label: t(`table.advanced.op.${op}`) }));

  function update(id: number, patch: Partial<Regle>): void {
    onRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function add(): void {
    onRules([
      ...rules,
      { id: Date.now(), col: colKey(columns[0]) ?? '', op: 'contains', value: '' },
    ]);
  }

  const labelStyle: CSSProperties = { width: 360, maxWidth: '80vw' };

  return (
    <div style={labelStyle}>
      <Space style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }}>
        <span>{t('table.advanced.floatingFilters')}</span>
        <Switch size="small" checked={showFloating} onChange={onToggleFloating} />
      </Space>

      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
        <Space style={{ marginBottom: 8 }}>
          <span>{t('table.advanced.match')}</span>
          <Radio.Group
            size="small"
            optionType="button"
            value={logique}
            onChange={(e) => onLogique(e.target.value)}
            options={[
              { value: 'AND', label: t('table.advanced.all') },
              { value: 'OR', label: t('table.advanced.any') },
            ]}
          />
        </Space>

        {rules.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('table.advanced.noRule')}
            style={{ margin: '8px 0' }}
          />
        )}

        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          {rules.map((r) => (
            <Space key={r.id} align="start" wrap>
              <Select
                size="small"
                style={{ width: 110 }}
                value={r.col}
                options={colOptions}
                onChange={(v) => update(r.id, { col: v })}
              />
              <Select
                size="small"
                style={{ width: 110 }}
                value={r.op}
                options={opOptions}
                onChange={(v) => update(r.id, { op: v })}
              />
              {!OPS_SANS_VALEUR.has(r.op) && (
                <Input
                  size="small"
                  style={{ width: 90 }}
                  value={r.value}
                  onChange={(e) => update(r.id, { value: e.target.value })}
                />
              )}
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onRules(rules.filter((x) => x.id !== r.id))}
              />
            </Space>
          ))}
        </Space>

        <Space style={{ marginTop: 8 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={add}>
            {t('table.advanced.addRule')}
          </Button>
          {(rules.length > 0 || showFloating) && (
            <Button size="small" type="link" onClick={onClear}>
              {t('table.advanced.clear')}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
}

/** Show/hide + drag-reorder columns (the toolbar "Colonnes" panel). */
function ColumnPanel<T>({
  columns,
  order,
  hidden,
  onOrder,
  onToggle,
  onReset,
}: {
  columns: DataColumn<T>[];
  order: string[];
  hidden: string[];
  onOrder: (next: string[]) => void;
  onToggle: (key: string) => void;
  onReset: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [dragKey, setDragKey] = useState<string | null>(null);

  const manageable = columns.filter((c) => colKey(c) !== '');
  const rank = (k: string): number => {
    const i = order.indexOf(k);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ordered = [...manageable].sort((a, b) => rank(colKey(a)) - rank(colKey(b)));

  function drop(targetKey: string): void {
    if (!dragKey || dragKey === targetKey) return;
    const keys = ordered.map((c) => colKey(c));
    const from = keys.indexOf(dragKey);
    const to = keys.indexOf(targetKey);
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    onOrder(keys);
    setDragKey(null);
  }

  return (
    <div style={{ width: 230 }}>
      <div style={{ maxHeight: 300, overflow: 'auto' }}>
        {ordered.map((c) => {
          const k = colKey(c);
          return (
            <div
              key={k}
              className="dt-col-item"
              draggable
              onDragStart={() => setDragKey(k)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(k)}
            >
              <HolderOutlined className="dt-col-drag" />
              <Checkbox checked={!hidden.includes(k)} onChange={() => onToggle(k)}>
                {colTitle(c)}
              </Checkbox>
            </div>
          );
        })}
      </div>
      <Button size="small" type="link" onClick={onReset} style={{ marginTop: 6, paddingLeft: 0 }}>
        {t('table.advanced.resetColumns')}
      </Button>
    </div>
  );
}
