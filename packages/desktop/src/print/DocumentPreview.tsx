import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppstoreOutlined,
  BgColorsOutlined,
  BorderTopOutlined,
  FileTextOutlined,
  CloseOutlined,
  CheckOutlined,
  CodeOutlined,
  ColumnWidthOutlined,
  ControlOutlined,
  CopyOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  DownloadOutlined,
  DownOutlined,
  ExpandOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  HighlightOutlined,
  LeftOutlined,
  PrinterOutlined,
  ProfileOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  RotateRightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {
  App,
  Button,
  Checkbox,
  ColorPicker,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  type InputRef,
  type MenuProps,
  Modal,
  Popover,
  Radio,
  Segmented,
  Select,
  Slider,
  Space,
  Spin,
  Switch,
  Tooltip,
} from 'antd';
import {
  defaultPreviewDeps,
  hostPreviewDeps,
  usePreviewMessages,
  type CodeType,
  type EtablissementInfo,
  type PreviewDeps,
} from './previewDeps';
import { makePreviewTranslate, type PreviewMessages } from './previewMessages';
import { colonnesNumeriques } from './tableau-nombres';
import { enteteCss, enteteParDefaut, renderEntete, type EnteteConfig } from './entete-config';
import {
  BANDS_VIDES,
  JETONS,
  buildListePrintHtml,
  modelesBandesPdf,
  resoudreJetons,
  toEnteteEtab,
  watermarkCss,
  type DocOptions,
  type JetonContexte,
  type Orientation,
  type PageBands,
  type Paper,
  type PrintPreviewData,
  type StyleTableau,
  type Watermark,
} from './document';
import { useHost } from '../host/host';
import './print-preview.css';
import {
  MARGES_DEFAUT,
  MM_TO_PX,
  PAPER_LABEL,
  PAPER_MM,
  borner,
  margeVerticale,
  margesMm,
  pageMm,
  rowsPerPage,
  type Marges,
  type Margin,
} from './paper';
import {
  SAFE_NAME,
  buildCsv,
  buildJson,
  buildTsv,
  downloadFile,
  filterCols,
  printHtml,
  withPageColor,
  withWatermark,
} from './document-io';
import { DOCX_MIME, buildListeDocx } from './docx';
import { highlight } from './highlight';
import { RbBtn, RbGroup, RbSep } from './ribbon-parts';
import { MargesInteractives } from './MargesInteractives';

/**
 * Keyboard guard for the whole-number fields (copies, page numbers, margins in
 * mm). `onKeyDown` refuses the keystroke so nothing ever appears and vanishes;
 * `onPaste` is the net for what is not typed. Inlined here rather than shared —
 * it is four lines, and the print module owes the host nothing for it.
 */
const ENTIER_INPUT = {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  },
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>): void => {
    if (!/[0-9]/.test(e.clipboardData.getData('text'))) e.preventDefault();
  },
};

// The document data model + builder live in the templates/ reporting module; the
// type is re-exported here so existing screens keep importing it from this component.
export type { PrintPreviewData } from './document';

/** A toolbar action shown to the left of the built-in Print button (html mode). */
export interface PreviewAction {
  key: string;
  label: string;
  icon?: ReactNode;
  type?: 'primary' | 'default';
  loading?: boolean;
  onClick: () => void;
}

/**
 * What the single preview dialog renders. Either a pre-built HTML document (a
 * receipt, bulletin, payslip…) shown in an iframe, or structured table data the
 * dialog itself paginates onto sheets — each unlocking the controls that apply.
 */
export type PreviewSource =
  | { kind: 'table'; data: PrintPreviewData | null }
  | {
      kind: 'html';
      title: string;
      html: string | null;
      /** CSS width of the paper sheet (e.g. '210mm' for A4 bulletins). */
      paperWidth?: string;
      /** Split a single-flow document into discrete A4 sheets in the preview (the
       *  PDF/print paginate via the document's own @page rules either way). */
      paged?: boolean;
      /** Drop the white "paper" backdrop so the document shows bare on the neutral
       *  stage — for docs that supply their own sheets (e.g. ID cards). */
      bare?: boolean;
      loading?: boolean;
      actions?: PreviewAction[];
    };

const WM_PRESETS = ['COPIE', 'ORIGINAL', 'DUPLICATA', 'BROUILLON', 'CONFIDENTIEL'];
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2;
const clampZoom = (z: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
const ZOOMS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];
/** Zoom values offered in the status-bar preset list (report-viewer style). */
const ZOOM_PRESETS = [2, 1.5, 1, 0.75, 0.5, 0.25];
/** Rendered width of a page thumbnail, in CSS px. */
const THUMB_W = 104;
const SETTINGS_KEY = 'docPreview.v1';
interface PersistedSettings {
  paper: Paper;
  orientation: Orientation;
  margin: Margin;
  /** Marges libres, côté par côté (remplace l'ancien `customMargin`). */
  marges: Marges;
  multiCols: number;
  pageColor: string;
  letterhead: boolean;
  signature: boolean;
  codeType: CodeType;
  watermark: Watermark;
  bands: PageBands;
  scale: number;
  tableStyle: StyleTableau;
}
function loadSettings(): Partial<PersistedSettings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<PersistedSettings>;
  } catch {
    return {};
  }
}
function saveSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

/** Commands the quick access toolbar can hold. The toolbar always renders them
 *  in this order, so toggling one never reshuffles the others. */
const QAT_ALL = [
  'print',
  'quickPrint',
  'pdf',
  'save',
  'pageSetup',
  'fitWidth',
  'fitPage',
  'zoomOut',
  'zoomIn',
] as const;
type QatKey = (typeof QAT_ALL)[number];
/** What a fresh install shows: the four commands a user reaches for on nearly
 *  every document. */
const QAT_DEFAULT: QatKey[] = ['print', 'quickPrint', 'pdf', 'save'];
const QAT_KEY = 'docPreview.qat.v1';

/** The user's chosen set, filtered against the catalogue so a renamed or dropped
 *  command in a later version can't break the toolbar. An empty set is honoured
 *  (the chevron stays, so it's always recoverable); only a missing/garbled value
 *  falls back to the defaults. */
function loadQat(): QatKey[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(QAT_KEY) ?? 'null');
    if (!Array.isArray(raw)) return QAT_DEFAULT;
    return raw.filter((k): k is QatKey => QAT_ALL.includes(k as QatKey));
  } catch {
    return QAT_DEFAULT;
  }
}
function saveQat(keys: QatKey[]): void {
  try {
    localStorage.setItem(QAT_KEY, JSON.stringify(keys));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * The single print-preview dialog for the whole app. One chrome — zoom, print,
 * true-PDF export, watermark, status bar and keyboard shortcuts — wrapping two
 * bodies that share it:
 *
 *  - `kind: 'html'` renders a pre-built document (receipt, bulletin, payslip) in
 *    a same-origin iframe, with caller-supplied actions.
 *  - `kind: 'table'` paginates structured `{ headers, rows, totals }` onto sheets
 *    and adds find, paper / orientation / margin, single/multi layout, per-row
 *    barcodes, column chooser, an official letterhead, a signature block, an
 *    audit footer and CSV / JSON / clipboard export.
 *
 * Controls that don't apply to the active source are hidden. Paper, orientation,
 * margins, header/signature and watermark choices persist across sessions.
 */
export function DocumentPreview({
  open,
  source,
  onClose,
  deps,
  messages,
  printedByName,
}: {
  open: boolean;
  source: PreviewSource | null;
  onClose: () => void;
  /**
   * Host bindings (letterhead, print/export I/O, barcode). Defaults to this
   * app's wiring; pass a **stable** (memoised) object to reuse the preview
   * elsewhere — see {@link PreviewDeps}.
   */
  deps?: Partial<PreviewDeps>;
  /** Label overrides (defaults to the built-in French strings). Stable object. */
  messages?: Partial<PreviewMessages>;
  /** Name for the « Imprimé par … » audit footer; omit/null to hide it. */
  printedByName?: string | null;
}): React.JSX.Element {
  const { notification } = App.useApp();
  const t = useMemo(() => makePreviewTranslate(messages), [messages]);
  const host = useHost();
  // Explicit `deps` win over the host adapter, which wins over the browser
  // defaults — so an app can override one capability without restating the rest.
  const D = useMemo<PreviewDeps>(
    () => ({ ...defaultPreviewDeps, ...hostPreviewDeps(host), ...deps }),
    [host, deps],
  );
  const saved = useMemo(loadSettings, []);
  const [zoom, setZoom] = useState(1);
  const [orientation, setOrientation] = useState<Orientation>(saved.orientation ?? 'portrait');
  const [paper, setPaper] = useState<Paper>(saved.paper ?? 'A4');
  const [margin, setMargin] = useState<Margin>(saved.margin ?? 'normal');
  // Reprise des réglages d'une version antérieure : une marge unique devient
  // quatre marges égales, personne ne perd son réglage à la mise à jour.
  const [marges, setMarges] = useState<Marges>(
    saved.marges ??
      (typeof (saved as { customMargin?: number }).customMargin === 'number'
        ? (() => {
            const v = borner((saved as { customMargin?: number }).customMargin ?? 10);
            return { haut: v, droite: v, bas: v, gauche: v };
          })()
        : MARGES_DEFAUT),
  );
  const [multi, setMulti] = useState(false);
  const [multiCols, setMultiCols] = useState(saved.multiCols ?? 2);
  const [pageColor, setPageColor] = useState(saved.pageColor ?? '#ffffff');
  // Print scale (DevExpress "Échelle"): shrinks/grows the document on the sheet.
  const [scale, setScale] = useState(saved.scale ?? 1);
  const [setupOpen, setSetupOpen] = useState(false);
  // Quick access toolbar: the commands pinned to the title bar, and persisted.
  const [qat, setQat] = useState<QatKey[]>(loadQat);
  // Export / quick-print options (page range, copies) — the dialog a report
  // viewer shows before it commits a job.
  const [jobOpen, setJobOpen] = useState<null | 'pdf' | 'print'>(null);
  const [jobEtendue, setJobEtendue] = useState<'all' | 'current' | 'range'>('all');
  const [jobRange, setJobRange] = useState('');
  const [jobCopies, setJobCopies] = useState(1);
  const [maximized, setMaximized] = useState(false);
  // Window-like behaviour: roll-up (minimize) and a free drag offset from centre.
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [showPages, setShowPages] = useState(false);
  // Page count/labels for `htmlSrc` documents in `paged` mode — the table-mode
  // equivalent (`pages`) doesn't apply since there's no `data` to chunk; these are
  // read off the live `.pp-sheet` elements once `paginate()` runs (see below).
  const [htmlPageCount, setHtmlPageCount] = useState(0);
  const [htmlPageLabels, setHtmlPageLabels] = useState<string[]>([]);
  const [etab, setEtab] = useState<EtablissementInfo | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [entete, setEntete] = useState<EnteteConfig>(enteteParDefaut);
  const [letterhead, setLetterhead] = useState(saved.letterhead ?? true);
  // Modern by default; the framed look stays one click away for the documents
  // that are filled in by hand (listes d'appel, registres).
  const [tableStyle, setTableStyle] = useState<StyleTableau>(saved.tableStyle ?? 'moderne');
  const [signature, setSignature] = useState(saved.signature ?? false);
  const [codeType, setCodeType] = useState<CodeType>(saved.codeType ?? 'code39');
  const [sigLabel, setSigLabel] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [hiddenCols, setHiddenCols] = useState<Set<number>>(new Set());
  const [watermark, setWatermark] = useState<Watermark>(
    saved.watermark ?? { on: false, text: 'COPIE', opacity: 0.1, diagonal: true },
  );
  // Editable page bands (header/footer × left/centre/right). An empty zone falls
  // back to what the document showed before the editor existed.
  const [bands, setBands] = useState<PageBands>(saved.bands ?? BANDS_VIDES);
  const [bandsOpen, setBandsOpen] = useState(false);
  const bandFieldRef = useRef<keyof PageBands | null>(null);
  const [find, setFind] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  /** Which panel the left dock shows (report-viewer style tabs). */
  const [dock, setDock] = useState<'thumbs' | 'search'>('thumbs');
  const [activeMatch, setActiveMatch] = useState(0);
  const [curPage, setCurPage] = useState(1);
  const [pageEdit, setPageEdit] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const activeHitRef = useRef<HTMLElement | null>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const findRef = useRef<InputRef>(null);
  const scrollRaf = useRef(0);
  // Latch that keeps the auto-fit ResizeObservers from overriding the zoom. Set on
  // open (every document defaults to 100%) and whenever the user zooms manually; the
  // fit functions still run when invoked explicitly (Fit buttons / Ctrl+0 on tables).
  const userZoomedRef = useRef(false);
  // Watches the html-mode iframe's body so late reflows (logo image / web-font
  // load) re-measure the iframe height — otherwise the doc overflows the height
  // fixed at onLoad and the iframe grows its own internal scrollbar.
  const frameRoRef = useRef<ResizeObserver | null>(null);
  // One sheet's pixel width, captured once by `paginate()` — the multi-page grid
  // needs it as a stable column size, and re-measuring `body.clientWidth` after
  // the grid is applied would read the *widened* body instead of one page.
  const sheetWidthPxRef = useRef(0);

  const isTable = source?.kind === 'table';
  const data = source?.kind === 'table' ? source.data : null;
  const htmlSrc = source?.kind === 'html' ? source : null;
  const paperWidth = htmlSrc?.paperWidth ?? '148mm';
  const modalTitle = htmlSrc ? htmlSrc.title : t('print.preview.title');
  const hasContent = htmlSrc ? !htmlSrc.loading && !!htmlSrc.html : !!data;

  const dims = pageMm(paper, orientation);
  const pageMarges = margesMm(margin, marges);
  /** Marge représentative pour les estimations de pagination. */
  const pageMargin = margeVerticale(margin, marges);
  const pages = useMemo(
    () => (data ? chunk(data.rows, rowsPerPage(paper, orientation, pageMargin, scale)) : []),
    [data, paper, orientation, pageMargin, scale],
  );
  // `htmlSrc` has no `pages` array — this lets the nav/status bar share one code
  // path for both modes instead of forking every reference.
  const totalPages = isTable ? pages.length : htmlPageCount;
  // Widened to fit several columns of sheets side by side in `paged` grid mode;
  // `paperWidth` itself stays the single-page reference `fitHtml`/`fitHtmlWidth`
  // (and everything else) measure against.
  const bpPaperWidth =
    multi && htmlSrc?.paged
      ? `calc(${paperWidth} * ${multiCols} + ${(multiCols - 1) * 14}px)`
      : paperWidth;
  const today = new Date().toLocaleDateString('fr-FR');
  const printedAt = new Date().toLocaleString('fr-FR');

  const visibleIdx = useMemo(
    () => (data ? data.headers.map((_, i) => i).filter((i) => !hiddenCols.has(i)) : []),
    [data, hiddenCols],
  );

  /** Every match in document order, with the page it sits on — the search
   *  panel's result list, and the source of the match counter. */
  const hits = useMemo(() => {
    const brut = find.trim();
    if (!brut || pages.length === 0) return [];
    const terme = matchCase ? brut : brut.toLowerCase();
    const out: { page: number; ligne: number; extrait: string }[] = [];
    pages.forEach((pageRows, pi) => {
      pageRows.forEach((row, ri) => {
        for (const texte of row) {
          const foin = matchCase ? texte : texte.toLowerCase();
          let idx = foin.indexOf(terme);
          while (idx >= 0) {
            out.push({ page: pi + 1, ligne: ri, extrait: row.join(' · ').slice(0, 60) });
            idx = foin.indexOf(terme, idx + terme.length);
          }
        }
      });
    });
    return out;
  }, [find, matchCase, pages]);
  const totalHits = hits.length;

  // Load the school identity once the preview opens (used by the letterhead).
  useEffect(() => {
    if (!open) return;
    D.getEtablissement()
      .then(setEtab)
      .catch(() => setEtab(null));
    D.getLogo()
      .then(setLogo)
      .catch(() => setLogo(null));
    D.getEnteteConfig()
      .then(setEntete)
      .catch(() => setEntete(enteteParDefaut()));
  }, [open, D]);

  // A fresh open starts centred and expanded.
  useEffect(() => {
    if (open) {
      setPos({ x: 0, y: 0 });
      setMinimized(false);
    }
  }, [open]);

  // Stop watching the iframe body once the preview closes / unmounts.
  useEffect(() => {
    if (open) return;
    frameRoRef.current?.disconnect();
    frameRoRef.current = null;
  }, [open]);

  // Reset per-document state when a new document opens.
  useEffect(() => {
    if (open) setHiddenCols(new Set());
  }, [open, data]);

  // Persist the document-layout choices for next time.
  useEffect(() => {
    saveSettings({
      paper,
      orientation,
      margin,
      marges,
      multiCols,
      pageColor,
      letterhead,
      signature,
      codeType,
      watermark,
      bands,
      scale,
      tableStyle,
    });
  }, [
    paper,
    orientation,
    margin,
    marges,
    multiCols,
    pageColor,
    letterhead,
    signature,
    codeType,
    watermark,
    bands,
    scale,
    tableStyle,
  ]);

  // Reset the active match whenever the query changes.
  useEffect(() => setActiveMatch(0), [find]);

  // Scroll the active match into view.
  useEffect(() => {
    if (totalHits > 0)
      activeHitRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeMatch, find, totalHits, zoom, multi]);

  function fitWidth(): void {
    const el = stageRef.current;
    if (!el) return;
    userZoomedRef.current = true;
    const avail = el.clientWidth - 48; // container padding
    setZoom(clampZoom(avail / (dims.w * MM_TO_PX)));
  }

  function fitPage(): void {
    const el = stageRef.current;
    if (!el) return;
    userZoomedRef.current = true;
    const z = Math.min(
      (el.clientWidth - 48) / (dims.w * MM_TO_PX),
      (el.clientHeight - 48) / (dims.h * MM_TO_PX),
    );
    setZoom(clampZoom(z));
  }

  /** Width-fit for an html document (its page width is a CSS length, not paper). */
  function fitHtmlWidth(): void {
    const stage = stageRef.current;
    if (!stage) return;
    const mm = /^(\d+(?:\.\d+)?)mm$/.exec(paperWidth);
    const pageW = mm ? parseFloat(mm[1]) * MM_TO_PX : (frameRef.current?.offsetWidth ?? 760);
    if (pageW <= 0) return;
    userZoomedRef.current = true;
    setZoom(clampZoom((stage.clientWidth - 48) / pageW));
  }

  /** Whole-page / page-width / fixed-% presets, over either body. */
  function applyZoomPreset(key: string): void {
    userZoomedRef.current = true;
    if (key === 'whole') {
      if (isTable) fitPage();
      else fitHtml();
    } else if (key === 'width') {
      if (isTable) fitWidth();
      else fitHtmlWidth();
    } else if (key === 'two') {
      // "Deux pages" needs real, separately-laid-out pages — the paginated table
      // body, or an `htmlSrc` document split into `.pp-sheet`s (`paged`).
      setMulti(true);
      setMultiCols(2);
      if (isTable) fitPage();
      else fitHtml();
    } else {
      setZoom(clampZoom(Number(key)));
    }
  }

  const zoomMenuItems: MenuProps['items'] = [
    { key: 'whole', label: t('print.preview.zoomWhole') },
    { key: 'width', label: t('print.preview.zoomWidth') },
    ...(isTable || htmlSrc?.paged ? [{ key: 'two', label: t('print.preview.zoomTwoPages') }] : []),
    { type: 'divider' as const },
    ...ZOOM_PRESETS.map((z) => ({ key: String(z), label: `${Math.round(z * 100)} %` })),
  ];

  // Open every document at 100% (actual size) by default, and latch it so the
  // auto-fit ResizeObservers never pull the zoom back to a fit. From there the user
  // zooms freely (slider / wheel / +−); tables also keep their Fit-width / Fit-page
  // buttons.
  useEffect(() => {
    if (!open) return;
    userZoomedRef.current = true;
    setZoom(1);
  }, [open, htmlSrc?.html, isTable]);

  // Ctrl/Cmd + wheel = zoom (native listener so preventDefault isn't passive).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      userZoomedRef.current = true;
      setZoom((z) => clampZoom(z - Math.sign(e.deltaY) * 0.1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, isTable, htmlSrc?.html]);

  // Refit an html document whenever the stage actually resizes — the initial fit
  // can land mid-open-animation (wrong size), and maximize/window-resize change
  // it too. Observe the stage's BORDER box, not its content box: a manual zoom that
  // overflows the stage toggles its scrollbar, which changes only the *content* box —
  // observing that would re-fire fitHtml and snap the user's zoom straight back. The
  // border box changes solely on real stage resizes (maximize, window), which is
  // exactly when we do want to refit.
  useEffect(() => {
    if (!open || isTable || typeof ResizeObserver === 'undefined') return;
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!userZoomedRef.current) fitHtml();
    });
    ro.observe(el, { box: 'border-box' });
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isTable, htmlSrc?.html, htmlSrc?.paged, paperWidth]);

  // Keyboard shortcuts wired to the toolbar actions. Ctrl/Cmd combos fire even
  // while a field is focused; bare navigation keys are ignored during typing so
  // they don't fight the find box / option inputs.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

      if (mod && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        void doQuickPrint();
      } else if (mod && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        doPrint();
      } else if (mod && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        void doExportPdf();
      } else if (mod && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        doSaveHtml();
      } else if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        findRef.current?.focus({ cursor: 'all' });
      } else if (mod && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        stepZoom(1);
      } else if (mod && e.key === '-') {
        e.preventDefault();
        stepZoom(-1);
      } else if (mod && e.key === '0') {
        e.preventDefault();
        if (isTable) fitWidth();
        else setZoom(1);
      } else if (e.key === 'F3') {
        e.preventDefault();
        gotoMatch(e.shiftKey ? -1 : 1);
      } else if (!typing && (isTable || htmlSrc?.paged) && totalPages > 1) {
        if (e.key === 'PageDown') {
          e.preventDefault();
          gotoPage(curPage + 1);
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          gotoPage(curPage - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          gotoPage(1);
        } else if (e.key === 'End') {
          e.preventDefault();
          gotoPage(totalPages);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    zoom,
    totalHits,
    isTable,
    data,
    htmlSrc,
    totalPages,
    etab,
    logo,
    watermark,
    visibleIdx,
    curPage,
    pages.length,
  ]);

  // Keep the injected html-mode watermark + page colour in sync with the controls.
  useEffect(() => {
    if (open && htmlSrc) {
      applyHtmlWatermark();
      applyHtmlPageColor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watermark, pageColor, htmlSrc?.html, open]);

  // Keep the html-mode multi-page grid ("Plusieurs pages") in sync with the
  // controls — a no-op until `paginate()` has actually split the document.
  useEffect(() => {
    if (open && htmlSrc?.paged) applyHtmlMultiPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multi, multiCols, htmlSrc?.paged, htmlSrc?.html, open]);

  // Mirror the current page into the editable status-bar field.
  useEffect(() => setPageEdit(String(curPage)), [curPage]);

  function stepZoom(dir: 1 | -1): void {
    userZoomedRef.current = true;
    if (dir === 1) setZoom(ZOOMS.find((z) => z > zoom + 0.001) ?? ZOOMS[ZOOMS.length - 1]);
    else setZoom([...ZOOMS].reverse().find((z) => z < zoom - 0.001) ?? ZOOMS[0]);
  }

  function gotoMatch(dir: 1 | -1): void {
    if (totalHits === 0) return;
    setActiveMatch((m) => (m + dir + totalHits) % totalHits);
  }

  // Drag the dialog by its title bar (disabled while maximized/minimized). Window
  // listeners track the move and update the centre offset; commit on release.
  function onTitleDown(e: React.MouseEvent): void {
    if (maximized || minimized || e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
    const move = (ev: MouseEvent): void =>
      setPos({ x: start.ox + (ev.clientX - start.x), y: start.oy + (ev.clientY - start.y) });
    const up = (): void => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // Size the html iframe to its content so the outer stage scrolls — never the
  // iframe itself. Take the larger of <body>/<html> scrollHeight (margins can
  // make them differ) plus 1px so sub-pixel rounding can't trip a scrollbar.
  function fitHeight(): void {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (frame && doc?.body) {
      const h = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0);
      frame.style.height = `${h + 1}px`;
    }
  }

  // Re-fit whenever the iframe's content reflows after onLoad (images and fonts
  // load asynchronously). Re-observed on every (re)load; torn down on close.
  function observeFrameBody(): void {
    if (typeof ResizeObserver === 'undefined') return;
    frameRoRef.current?.disconnect();
    const body = frameRef.current?.contentDocument?.body;
    if (!body) return;
    const ro = new ResizeObserver(() => {
      fitHeight();
      // fitHeight (iframe height) always runs; refitting the zoom must not fight a
      // manual zoom, so it's gated behind the latch.
      if (!userZoomedRef.current) fitHtml();
    });
    ro.observe(body);
    frameRoRef.current = ro;
  }

  // Zoom an html document so it fits the stage with no scrollbars: a single-flow
  // document fits all its content; a `paged` (multi-sheet) one fits one A-series
  // page so you scroll between pages.
  function fitHtml(): void {
    const stage = stageRef.current;
    if (!stage) return;
    const mm = /^(\d+(?:\.\d+)?)mm$/.exec(paperWidth);
    const pageW = mm ? parseFloat(mm[1]) * MM_TO_PX : (frameRef.current?.offsetWidth ?? 760);
    if (pageW <= 0) return;
    const mesure = htmlSrc?.paged
      ? pageW * Math.SQRT2 // one A-series portrait page
      : (frameRef.current?.contentDocument?.body?.scrollHeight ?? 0);
    const contentH = mesure > 0 ? mesure : pageW * Math.SQRT2; // fall back before load
    const z = Math.min((stage.clientWidth - 48) / pageW, (stage.clientHeight - 48) / contentH);
    setZoom(clampZoom(z));
  }

  // Opt-in (`paged`): split a single-flow document's top-level blocks into A4
  // sheets so the preview reads like a real print preview. Runs in the parent
  // (app code) on the same-origin iframe, so it isn't blocked by the doc's CSP.
  // The exported PDF is unaffected — it paginates via the document's @page rules.
  function paginate(): void {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || !htmlSrc?.paged || doc.body.dataset.paged === '1') return;

    const widthPx = doc.body.clientWidth;
    if (widthPx === 0) return;
    sheetWidthPxRef.current = widthPx;
    const sheetH = widthPx * (297 / 210); // ISO portrait ratio (√2), A4 = A5
    const padPx = (12 / 210) * widthPx; // 12mm page margin
    const footerReserve = Math.round(padPx * 0.9);

    // Administrative reports may carry a fixed footer in print CSS. In paged
    // screen preview we emulate that by cloning the footer into each generated
    // sheet and pinning it to the sheet bottom.
    const footerTemplate = doc.body.querySelector('.st-report-footer') as HTMLElement | null;
    footerTemplate?.remove();

    const style = doc.createElement('style');
    style.textContent =
      `body{background:#525659;margin:0;padding:0}` +
      // Fixed px width (not 100%): lets the multi-page grid widen `body` to fit
      // several columns without stretching each sheet past one page's size.
      `.pp-sheet{position:relative;box-sizing:border-box;width:${widthPx}px;height:${sheetH}px;padding:${padPx}px ${padPx}px ${padPx + footerReserve}px;` +
      `background:#fff;overflow:hidden;margin:0 auto 14px;box-shadow:0 1px 6px rgba(0,0,0,.4)}` +
      `.pp-sheet:last-child{margin-bottom:0}` +
      // Keep the report's own footer typography and layout (tokens from the
      // template). In paged preview we only pin each cloned footer to the
      // sheet bottom and neutralize flow margins.
      `.pp-sheet-footer{position:absolute;left:${padPx}px;right:${padPx}px;bottom:${Math.max(6, Math.round(padPx * 0.25))}px;` +
      `margin:0 !important}` +
      `.pp-sheet-footer .st-report-footer__left,.pp-sheet-footer .st-report-footer__center,.pp-sheet-footer .st-report-footer__page{white-space:nowrap}` +
      `.pp-sheet-footer .st-report-footer__page{text-align:right}`;
    doc.head.appendChild(style);

    const blocks = Array.from(doc.body.children).filter(
      (el) => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT' && el.id !== 'pp-wm',
    );
    doc.body.dataset.paged = '1';
    for (const b of blocks) b.remove();

    const newSheet = (): HTMLElement => {
      const s = doc.createElement('div');
      s.className = 'pp-sheet';
      if (footerTemplate) {
        const footer = footerTemplate.cloneNode(true) as HTMLElement;
        footer.classList.add('pp-sheet-footer');
        s.appendChild(footer);
      }
      doc.body.appendChild(s);
      return s;
    };
    let sheet = newSheet();
    for (const block of blocks) {
      sheet.appendChild(block);
      // Overflowed: push this block to a fresh sheet (unless it's alone & too tall).
      if (sheet.scrollHeight > sheet.clientHeight && sheet.childElementCount > 1) {
        block.remove();
        sheet = newSheet();
        sheet.appendChild(block);
      }
    }

    if (footerTemplate) {
      const sheets = Array.from(doc.body.querySelectorAll('.pp-sheet')) as HTMLElement[];
      const total = sheets.length;
      sheets.forEach((s, i) => {
        const pageCell = s.querySelector('.st-report-footer__page') as HTMLElement | null;
        if (pageCell) pageCell.textContent = `Page ${i + 1} / ${total}`;
      });
    }

    // Page count/labels for the nav bar and the Miniatures rail's named index —
    // the label rides on whichever source block carries a `data-pp-label`
    // attribute (e.g. a bulletin's student name), already reparented into its
    // sheet above; sheets built from unlabeled documents just show "Page N".
    const finalSheets = Array.from(doc.body.querySelectorAll('.pp-sheet')) as HTMLElement[];
    setHtmlPageCount(finalSheets.length);
    setHtmlPageLabels(
      finalSheets.map(
        (s) => s.querySelector('[data-pp-label]')?.getAttribute('data-pp-label') ?? '',
      ),
    );
  }

  // Opt-in multi-page grid ("Plusieurs pages") for `paged` html documents: lays
  // the already-split `.pp-sheet` elements out in a CSS grid instead of one
  // vertical stack. Table mode gets this by arranging separate React-rendered
  // page elements in the outer document (`.pp-pages--multi`); here the "pages"
  // are DOM nodes inside the iframe, so the grid has to be applied there instead.
  // `bpPaperWidth` (outer `.bp-paper`/iframe width) is sized to match exactly.
  function applyHtmlMultiPage(): void {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || !htmlSrc?.paged || doc.body.dataset.paged !== '1') return;

    let style = doc.getElementById('pp-multi-style') as HTMLStyleElement | null;
    if (!multi) {
      doc.body.classList.remove('pp-multi');
      style?.remove();
      return;
    }
    if (!style) {
      style = doc.createElement('style');
      style.id = 'pp-multi-style';
      doc.head.appendChild(style);
    }
    style.textContent =
      `body.pp-multi{display:grid;grid-template-columns:repeat(var(--pp-cols),${sheetWidthPxRef.current}px);gap:14px;justify-content:center}` +
      `.pp-multi .pp-sheet{margin:0}`;
    doc.body.classList.add('pp-multi');
    doc.body.style.setProperty('--pp-cols', String(multiCols));
  }

  // Inject (or update/remove) a watermark element inside the html document so it
  // shows on screen and on print, without the caller having to embed it. In
  // `paged` mode the document is really just one flow split into `.pp-sheet`
  // divs (see `paginate`) stacked in a single scrollable document — a single
  // `position:fixed` mark floats once over whichever sheet happens to sit under
  // it, instead of appearing on every one. One clone per sheet there instead.
  function applyHtmlWatermark(): void {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;

    if (htmlSrc?.paged && doc.body.dataset.paged === '1') {
      doc.getElementById('pp-wm')?.remove();
      const feuilles = Array.from(doc.body.querySelectorAll('.pp-sheet')) as HTMLElement[];
      for (const feuille of feuilles) {
        let el = feuille.querySelector('.pp-wm') as HTMLElement | null;
        if (!watermark.on || !watermark.text.trim()) {
          el?.remove();
          continue;
        }
        if (!el) {
          el = doc.createElement('div');
          el.className = 'pp-wm';
          feuille.appendChild(el);
        }
        el.textContent = watermark.text;
        el.setAttribute('style', watermarkCss(watermark, true));
      }
      return;
    }

    let el = doc.getElementById('pp-wm');
    if (!watermark.on || !watermark.text.trim()) {
      el?.remove();
      return;
    }
    if (!el) {
      el = doc.createElement('div');
      el.id = 'pp-wm';
      doc.body.appendChild(el);
    }
    el.textContent = watermark.text;
    el.setAttribute('style', watermarkCss(watermark));
  }

  // Tint the html document's background on screen to match the page-colour choice.
  function applyHtmlPageColor(): void {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const c = pageColor && pageColor.toLowerCase() !== '#ffffff' ? pageColor : '';
    doc.body.style.background = c;
    doc.documentElement.style.background = c;
  }

  /** Values the page bands' `[Tokens]` resolve against. `page`/`pages` are left
   *  out here: only a rendered sheet (or the PDF exporter) knows them. */
  function jetonCtx(page?: number): JetonContexte {
    return {
      page,
      pages: page != null ? pages.length : undefined,
      date: today,
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      utilisateur: printedByName ?? '',
      titre: (isTable ? data?.title : htmlSrc?.title) ?? '',
    };
  }

  /** The three zones of a band for one sheet, with the historical fallbacks. */
  function zonesBande(haut: boolean, pi: number): [string, string, string] {
    const ctx = jetonCtx(pi + 1);
    const r = (s: string): string => resoudreJetons(s, ctx).trim();
    return haut
      ? [r(bands.headerLeft), r(bands.headerCenter), r(bands.headerRight)]
      : [
          r(bands.footerLeft) || printedBy,
          r(bands.footerCenter) || footerNote,
          r(bands.footerRight) || t('print.preview.page', { n: pi + 1, total: pages.length }),
        ];
  }

  /** Figure columns, right-aligned like the printed document (same rule). */
  const colonnesChiffrees = useMemo(
    () =>
      data && tableStyle === 'moderne'
        ? colonnesNumeriques([...data.rows, ...(data.totals ? [data.totals] : [])], visibleIdx)
        : new Set<number>(),
    [data, tableStyle, visibleIdx],
  );
  const clsNum = (i: number): string | undefined => (colonnesChiffrees.has(i) ? 'pp-n' : undefined);

  /** The resolved decoration options for the current table document. */
  function docOptions(): DocOptions {
    return {
      etab,
      logo: D.resolveLogo(logo),
      republique: D.republique,
      orientation,
      paper,
      marginMm: pageMarges,
      pageColor,
      watermark,
      letterhead,
      signature,
      sigLabel: sigLabel.trim() || t('print.preview.signatureDefault'),
      faitA: etab?.ville
        ? t('print.preview.faitA', { ville: etab.ville, date: today })
        : t('print.preview.faitALe', { date: today }),
      footerNote,
      printedBy: printedByName
        ? t('print.preview.printedBy', { user: printedByName, date: printedAt })
        : '',
      bands,
      bandsCtx: jetonCtx(),
      scale,
      today,
      visibleIdx,
      code: D.encodeBarcode(codeType),
      entete,
      tableStyle,
    };
  }

  /** The print-ready HTML for the active document (table built, html injected). */
  function currentHtml(): string | null {
    if (data) return buildListePrintHtml(data, docOptions());
    if (htmlSrc?.html) return withPageColor(withWatermark(htmlSrc.html, watermark), pageColor);
    return null;
  }

  function docBaseName(): string {
    return ((isTable ? data?.title : htmlSrc?.title) || 'document').replace(SAFE_NAME, '-');
  }

  function doPrint(): void {
    if (htmlSrc) {
      const win = frameRef.current?.contentWindow;
      win?.focus();
      win?.print();
      return;
    }
    if (data) printHtml(buildListePrintHtml(data, docOptions()));
  }

  /**
   * Announce a finished export with the two things the user wants next: opening
   * the file, or finding it. Chasing it through the file manager is the part
   * that makes an export feel unfinished.
   */
  function annoncerFichier(chemin: string): void {
    const nom = chemin.split(/[\\/]/).pop() ?? chemin;
    const cle = `export-${chemin}`;
    notification.success({
      key: cle,
      message: t('print.preview.saved'),
      description: nom,
      duration: 8,
      btn: (
        <Space>
          <Button
            size="small"
            onClick={() => {
              notification.destroy(cle);
              void D.revealFile?.(chemin);
            }}
          >
            {t('print.preview.revealFile')}
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              notification.destroy(cle);
              void D.openFile?.(chemin).then((ok) => {
                if (!ok) notification.error({ message: t('print.preview.openFileFailed') });
              });
            }}
          >
            {t('print.preview.openFile')}
          </Button>
        </Space>
      ),
    });
  }

  /**
   * Save an export through the host (a real file the user placed, and can be
   * shown afterwards). Falls back to a browser download when the host provides
   * no save binding — the preview stays usable outside Electron.
   */
  async function enregistrerExport(
    nomFichier: string,
    contenu: string | Uint8Array,
    filtre: { name: string; extensions: string[] },
    mime: string,
  ): Promise<void> {
    if (!D.saveFile) {
      downloadFile(nomFichier, contenu, mime);
      notification.success({ message: t('print.preview.saved'), description: nomFichier });
      return;
    }
    const chemin = await D.saveFile(nomFichier, contenu, filtre);
    if (chemin) annoncerFichier(chemin); // null = l'utilisateur a annulé
  }

  function doSaveHtml(): void {
    const html = currentHtml();
    if (!html) return;
    void enregistrerExport(
      `${docBaseName()}.html`,
      html,
      { name: 'HTML', extensions: ['html'] },
      'text/html;charset=utf-8',
    );
  }

  /** The chosen range as Chromium's string form ('' = every page). */
  function etendueTexte(): string {
    if (jobEtendue === 'current') return String(curPage);
    if (jobEtendue === 'range') return jobRange.replace(/\s/g, '');
    return '';
  }

  /** …and as Electron's 0-based inclusive pairs, for the silent printer. */
  function etenduePaires(): { from: number; to: number }[] {
    const texte = etendueTexte();
    if (!texte) return [];
    return texte
      .split(',')
      .map((part) => {
        const [a, b] = part.split('-');
        const from = Number(a);
        const to = Number(b ?? a);
        return Number.isFinite(from) && Number.isFinite(to) && from >= 1
          ? { from: from - 1, to: Math.max(from, to) - 1 }
          : null;
      })
      .filter((r): r is { from: number; to: number } => r !== null);
  }

  async function doExportPdf(): Promise<void> {
    const html = currentHtml();
    if (!html) return;
    try {
      // Page counters can't come from CSS, so the bands go to Chromium's own
      // header/footer templates where `[Page]` / `[Pages]` resolve for real.
      const bandes = modelesBandesPdf(bands, jetonCtx()) ?? undefined;
      const path = await D.exportPdf(html, `${docBaseName()}.pdf`, bandes, etendueTexte());
      if (path) annoncerFichier(path);
    } catch {
      notification.error({ message: t('print.preview.pdfError') });
    }
  }

  function doExportWord(): void {
    // Table mode builds a genuine .docx package (see docx.ts). An injected html
    // document has no table model to convert, so it keeps the old .doc route —
    // HTML that Word opens — rather than pretending to be OOXML.
    if (data) {
      void enregistrerExport(
        `${docBaseName()}.docx`,
        buildListeDocx(data, docOptions()),
        { name: 'Word', extensions: ['docx'] },
        DOCX_MIME,
      );
      return;
    }
    const html = currentHtml();
    if (!html) return;
    void enregistrerExport(
      `${docBaseName()}.doc`,
      html,
      { name: 'Word', extensions: ['doc'] },
      'application/msword',
    );
  }

  // Quick Print: straight to the default printer with no dialog (main process).
  async function doQuickPrint(): Promise<void> {
    const html = currentHtml();
    if (!html) return;
    try {
      const ok = await D.printSilent(html, {
        copies: jobCopies,
        pageRanges: etenduePaires(),
      });
      if (ok)
        notification.success({ message: t('print.preview.quickPrintOk'), description: modalTitle });
      else notification.error({ message: t('print.preview.quickPrintFail') });
    } catch {
      notification.error({ message: t('print.preview.quickPrintFail') });
    }
  }

  /**
   * Excel export. The bands travel with their `[Page]` / `[Pages]` tokens intact
   * — Excel resolves its own counters (`&P` / `&N`), which is one thing the
   * printed CSS band never could.
   */
  async function doExportXlsx(): Promise<void> {
    if (!data || !D.exportXlsx) return;
    const brut = (texte: string, repli = ''): string =>
      resoudreJetons(texte, jetonCtx()).trim() || repli;
    const chemin = await D.exportXlsx(
      {
        data: {
          title: data.title,
          headers: data.headers,
          rows: data.rows,
          totals: data.totals,
        },
        options: {
          titreFeuille: docBaseName(),
          visibleIdx,
          tableStyle,
          paper,
          orientation,
          marges: pageMarges,
          letterhead,
          signature,
          sigLabel: sigLabel.trim() || t('print.preview.signatureDefault'),
          faitA,
          today,
          bandeHaut: [brut(bands.headerLeft), brut(bands.headerCenter), brut(bands.headerRight)],
          bandeBas: [
            brut(bands.footerLeft, printedBy),
            brut(bands.footerCenter, footerNote),
            brut(bands.footerRight, '[Page] / [Pages]'),
          ],
          etab,
        },
      },
      `${docBaseName()}.xlsx`,
    );
    if (chemin) annoncerFichier(chemin);
  }

  function doExportCsv(): void {
    if (!data) return;
    void enregistrerExport(
      `${docBaseName()}.csv`,
      buildCsv(filterCols(data, visibleIdx)),
      { name: 'CSV', extensions: ['csv'] },
      'text/csv;charset=utf-8',
    );
  }

  function doExportJson(): void {
    if (!data) return;
    void enregistrerExport(
      `${docBaseName()}.json`,
      buildJson(filterCols(data, visibleIdx)),
      { name: 'JSON', extensions: ['json'] },
      'application/json;charset=utf-8',
    );
  }

  function doCopyTable(): void {
    if (!data) return;
    navigator.clipboard
      .writeText(buildTsv(filterCols(data, visibleIdx)))
      .then(() =>
        notification.success({ message: t('print.preview.copied'), description: data.title }),
      )
      .catch(() => notification.error({ message: t('print.preview.copyFailed') }));
  }

  // Keyboard-shortcut reference shown in the « Raccourcis clavier » tooltip.
  const shortcutRows: [string, string][] = [
    [t('print.preview.print'), 'Ctrl+P'],
    [t('print.preview.quickPrint'), 'Ctrl+Maj+P'],
    [t('print.preview.save'), 'Ctrl+S'],
    [t('print.preview.pdf'), 'Ctrl+Maj+S'],
    [t('print.preview.find'), 'Ctrl+F'],
    [`${t('print.preview.findNext')} / ${t('print.preview.findPrev')}`, 'F3 / Maj+F3'],
    [`${t('print.preview.zoomIn')} / ${t('print.preview.zoomOut')}`, 'Ctrl + / Ctrl −'],
    [isTable ? t('print.preview.fitWidth') : '100 %', 'Ctrl+0'],
    ...(isTable
      ? ([
          [`${t('print.preview.prevPage')} / ${t('print.preview.nextPage')}`, 'Pg.Préc / Pg.Suiv'],
          [`${t('print.preview.firstPage')} / ${t('print.preview.lastPage')}`, 'Début / Fin'],
        ] as [string, string][])
      : []),
    [t('print.preview.close'), 'Échap'],
  ];
  const shortcutsHelp = (
    <div className="pp-kbd">
      {shortcutRows.map(([label, keys]) => (
        <div className="pp-kbd__row" key={keys}>
          <span className="pp-kbd__label">{label}</span>
          <kbd className="pp-kbd__keys">{keys}</kbd>
        </div>
      ))}
    </div>
  );

  const exportItems: MenuProps['items'] = [
    { key: 'pdf', icon: <FilePdfOutlined />, label: `${t('print.preview.pdf')} · Ctrl+Maj+S` },
    {
      key: 'word',
      icon: <FileWordOutlined />,
      // Table mode produces a real OOXML package; an injected html document
      // still leaves as .doc. The menu says which, rather than promising both.
      label: `${t('print.preview.word')} (${isTable ? '.docx' : '.doc'})`,
    },
    { key: 'html', icon: <SaveOutlined />, label: `${t('print.preview.save')} · Ctrl+S` },
    ...(isTable
      ? [
          ...(D.exportXlsx
            ? [
                {
                  key: 'xlsx',
                  icon: <FileExcelOutlined />,
                  label: t('print.preview.exportXlsx'),
                },
              ]
            : []),
          { key: 'csv', icon: <FileExcelOutlined />, label: t('print.preview.export') },
          { key: 'json', icon: <CodeOutlined />, label: t('print.preview.exportJson') },
          { type: 'divider' as const },
          { key: 'copy', icon: <CopyOutlined />, label: t('print.preview.copyTable') },
        ]
      : []),
  ];
  const onExport: MenuProps['onClick'] = ({ key }) => {
    if (key === 'pdf') setJobOpen('pdf');
    else if (key === 'word') doExportWord();
    else if (key === 'html') doSaveHtml();
    else if (key === 'xlsx') void doExportXlsx();
    else if (key === 'csv') doExportCsv();
    else if (key === 'json') doExportJson();
    else if (key === 'copy') doCopyTable();
  };

  // ── Quick access toolbar ───────────────────────────────────────────────────
  // The commands a user repeats on every document, lifted out of the ribbon and
  // pinned to the title bar so they stay one click away whatever the ribbon is
  // showing (or scrolled to). The set is user-chosen via the chevron and kept
  // across sessions; `tableOnly` entries drop out for html-mode documents.
  const qatCatalogue: {
    key: QatKey;
    icon: ReactNode;
    label: string;
    shortcut?: string;
    run: () => void;
    disabled?: boolean;
    tableOnly?: boolean;
  }[] = [
    {
      key: 'print',
      icon: <PrinterOutlined />,
      label: t('print.preview.print'),
      shortcut: 'Ctrl+P',
      run: doPrint,
      disabled: !hasContent,
    },
    {
      key: 'quickPrint',
      icon: <ThunderboltOutlined />,
      label: t('print.preview.quickPrint'),
      shortcut: 'Ctrl+Maj+P',
      run: () => void doQuickPrint(),
      disabled: !hasContent,
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: t('print.preview.pdf'),
      shortcut: 'Ctrl+Maj+S',
      run: () => void doExportPdf(),
      disabled: !hasContent,
    },
    {
      key: 'save',
      icon: <SaveOutlined />,
      label: t('print.preview.save'),
      shortcut: 'Ctrl+S',
      run: doSaveHtml,
      disabled: !hasContent,
    },
    {
      key: 'pageSetup',
      icon: <FileTextOutlined />,
      label: t('print.preview.pageSetup'),
      run: () => setSetupOpen(true),
      tableOnly: true,
    },
    {
      key: 'fitWidth',
      icon: <ColumnWidthOutlined />,
      label: t('print.preview.fitWidth'),
      run: fitWidth,
      tableOnly: true,
    },
    {
      key: 'fitPage',
      icon: <ExpandOutlined />,
      label: t('print.preview.fitPage'),
      run: fitPage,
      tableOnly: true,
    },
    {
      key: 'zoomOut',
      icon: <ZoomOutOutlined />,
      label: t('print.preview.zoomOut'),
      shortcut: 'Ctrl+-',
      run: () => stepZoom(-1),
    },
    {
      key: 'zoomIn',
      icon: <ZoomInOutlined />,
      label: t('print.preview.zoomIn'),
      shortcut: 'Ctrl++',
      run: () => stepZoom(1),
    },
  ];
  const qatOffered = qatCatalogue.filter((c) => isTable || !c.tableOnly);
  const qatShown = qatOffered.filter((c) => qat.includes(c.key));
  const qatTitle = (c: (typeof qatCatalogue)[number]): string =>
    c.shortcut ? `${c.label} · ${c.shortcut}` : c.label;

  const setQatKeys = (keys: QatKey[]): void => {
    setQat(keys);
    saveQat(keys);
  };
  const qatMenuItems: MenuProps['items'] = [
    {
      key: 'g-qat',
      type: 'group',
      label: t('print.preview.qat.customize'),
      children: qatOffered.map((c) => ({
        key: c.key,
        // A tick for the pinned ones; an empty slot keeps the labels aligned.
        icon: qat.includes(c.key) ? <CheckOutlined /> : <span className="pp-qat__tick" />,
        label: c.label,
      })),
    },
    { type: 'divider' },
    { key: 'qat-reset', label: t('print.preview.qat.reset') },
  ];
  const onQatMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'qat-reset') {
      setQatKeys(QAT_DEFAULT);
      return;
    }
    const k = key as QatKey;
    // Rebuild from the catalogue so the toolbar keeps its canonical order.
    setQatKeys(QAT_ALL.filter((a) => (a === k ? !qat.includes(k) : qat.includes(a))));
  };

  // Right-clicking the page area offers what a report viewer offers there: the
  // print/export commands and the zoom presets, without a trip to the ribbon.
  const pageMenuItems: MenuProps['items'] = [
    {
      key: 'print',
      icon: <PrinterOutlined />,
      label: t('print.preview.print'),
      disabled: !hasContent,
    },
    {
      key: 'quick',
      icon: <ThunderboltOutlined />,
      label: t('print.preview.quickPrint'),
      disabled: !hasContent,
    },
    { key: 'pdf', icon: <FilePdfOutlined />, label: t('print.preview.pdf'), disabled: !hasContent },
    { type: 'divider' },
    { key: 'whole', label: t('print.preview.zoomWhole') },
    { key: 'width', label: t('print.preview.zoomWidth') },
    { key: '1', label: '100 %' },
    ...(isTable || htmlSrc?.paged
      ? [
          { type: 'divider' as const },
          {
            key: 'thumbs',
            icon: <ProfileOutlined />,
            label: t('print.preview.thumbnails'),
          },
        ]
      : []),
  ];

  function onPageMenu(key: string): void {
    if (key === 'print') doPrint();
    else if (key === 'quick') void doQuickPrint();
    else if (key === 'pdf') void doExportPdf();
    else if (key === 'thumbs') setShowPages((s) => !s);
    else applyZoomPreset(key);
  }

  /** Scroll a given sheet to the top of the viewport (status-bar navigator). */
  function gotoPage(n: number): void {
    const clamped = Math.max(1, Math.min(totalPages, n));
    if (isTable) {
      pageEls.current[clamped - 1]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (htmlSrc?.paged) {
      // Same-origin `srcDoc` iframe (no `sandbox`): scrollIntoView on a node
      // inside it still scrolls the outer `.bp-stage`, same as `pageEls` above.
      const sheets = frameRef.current?.contentDocument?.body.querySelectorAll('.pp-sheet');
      (sheets?.[clamped - 1] as HTMLElement | undefined)?.scrollIntoView({
        block: 'start',
        behavior: 'smooth',
      });
    }
    setCurPage(clamped);
  }

  /** Track which sheet is currently in view (rAF-throttled scroll). */
  function onPagesScroll(): void {
    if (!isTable && !htmlSrc?.paged) return;
    cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const cont = stageRef.current;
      if (!cont) return;
      const anchor = cont.getBoundingClientRect().top + 24;
      let best = 1;
      let bestDist = Infinity;
      const consider = (top: number, i: number): void => {
        const d = Math.abs(top - anchor);
        if (d < bestDist) {
          bestDist = d;
          best = i + 1;
        }
      };
      if (isTable) {
        pageEls.current.forEach((el, i) => {
          if (el) consider(el.getBoundingClientRect().top, i);
        });
      } else {
        const frame = frameRef.current;
        const sheets = frame?.contentDocument?.body.querySelectorAll('.pp-sheet');
        if (frame && sheets) {
          const frameTop = frame.getBoundingClientRect().top;
          sheets.forEach((s, i) => consider(frameTop + s.getBoundingClientRect().top, i));
        }
      }
      setCurPage(best);
    });
  }

  // On-screen letterhead — the same renderer the printed/exported document uses,
  // so the preview is faithful. `enteteCss` is injected once into the pages stage.
  function Letterhead(): React.JSX.Element {
    return (
      <div
        dangerouslySetInnerHTML={{
          __html: renderEntete(entete, toEnteteEtab(etab), D.resolveLogo(logo), {
            compact: !letterhead,
          }),
        }}
      />
    );
  }

  // Render-time match counter (document order), reset before laying out pages.
  const hit = { n: 0 };
  const term = find.trim();
  const setActiveRef = (el: HTMLElement | null): void => {
    activeHitRef.current = el;
  };
  const cell = (c: string): ReactNode =>
    term ? highlight(c, term, hit, activeMatch, setActiveRef, matchCase) : c;
  const codeSvg = D.encodeBarcode(codeType);

  const faitA = etab?.ville
    ? t('print.preview.faitA', { ville: etab.ville, date: today })
    : t('print.preview.faitALe', { date: today });
  const printedBy = printedByName
    ? t('print.preview.printedBy', { user: printedByName, date: printedAt })
    : '';

  /** Everything inside one sheet. Extracted so the page and its thumbnail render
   *  the *same* markup — a thumbnail is the real page, just scaled down. */
  function sheetBody(pageRows: string[][], pi: number): ReactNode {
    if (!data) return null;
    const dernierePage = pi === pages.length - 1;
    return (
      <>
        {watermark.on && watermark.text.trim() && (
          <div
            className="pp-watermark"
            style={{
              color: `rgba(0,0,0,${watermark.opacity})`,
              transform: `rotate(${watermark.diagonal ? -30 : 0}deg)`,
            }}
          >
            {watermark.text}
          </div>
        )}
        {/* Page header band — only drawn when the user filled a zone. */}
        {zonesBande(true, pi).some((z) => z !== '') && (
          <div className="pp-page__band">
            {zonesBande(true, pi).map((z, i) => (
              <span key={i}>{z}</span>
            ))}
          </div>
        )}
        <Letterhead />
        <div className={`pp-dt${tableStyle === 'quadrille' ? ' pp-dt--quadrille' : ''}`}>
          <h3>{data.title}</h3>
          <div className="pp-dt__meta">{today}</div>
        </div>
        <table className={`pp-table${tableStyle === 'quadrille' ? ' pp-table--quadrille' : ''}`}>
          <thead>
            <tr>
              {visibleIdx.map((i) => (
                <th key={i} className={clsNum(i)}>
                  {data.headers[i]}
                </th>
              ))}
              {data.barcodeColumn && <th>{data.barcodeColumn.title}</th>}
            </tr>
          </thead>
          {data.totals && data.totals.length > 0 && dernierePage && (
            <tfoot>
              <tr>
                {visibleIdx.map((i) => (
                  <td key={i} className={clsNum(i)}>
                    {data.totals?.[i]}
                  </td>
                ))}
                {data.barcodeColumn && <td />}
              </tr>
            </tfoot>
          )}
          <tbody>
            {pageRows.map((r, ri) => (
              <tr key={ri}>
                {visibleIdx.map((i) => (
                  <td key={i} className={clsNum(i)}>
                    {cell(r[i] ?? '')}
                  </td>
                ))}
                {data.barcodeColumn && (
                  <td className="pp-bc">
                    <span
                      dangerouslySetInnerHTML={{
                        __html: codeSvg(r[data.barcodeColumn.sourceIndex] ?? ''),
                      }}
                    />
                    <div className="pp-bc-cap">{r[data.barcodeColumn.sourceIndex]}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data.barcode && dernierePage && (
          <div className="pp-doc-bc">
            <span dangerouslySetInnerHTML={{ __html: codeSvg(data.barcode) }} />
            <div className="pp-bc-cap">{data.barcode}</div>
          </div>
        )}
        {signature && dernierePage && (
          <div className="pp-sig">
            <div className="pp-sig__date">{faitA}</div>
            <div className="pp-sig__role">
              {sigLabel.trim() || t('print.preview.signatureDefault')}
            </div>
            <div className="pp-sig__name">{etab?.proviseur}</div>
          </div>
        )}
        <div className="pp-page__footer">
          {zonesBande(false, pi).map((z, i) => (
            <span key={i}>{z}</span>
          ))}
        </div>
      </>
    );
  }

  const docOptionsContent = (
    <div style={{ width: 260 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size={10}>
        <div className="pp-wm-line">
          <span>{t('print.preview.letterhead')}</span>
          <Switch checked={letterhead} onChange={setLetterhead} />
        </div>
        <div>
          <div className="pp-wm-cap">{t('print.preview.styleTableau')}</div>
          <Segmented<StyleTableau>
            block
            size="small"
            value={tableStyle}
            onChange={setTableStyle}
            options={[
              { value: 'moderne', label: t('print.preview.styleModerne') },
              { value: 'quadrille', label: t('print.preview.styleQuadrille') },
            ]}
          />
        </div>
        <div className="pp-wm-line">
          <span>{t('print.preview.signature')}</span>
          <Switch checked={signature} onChange={setSignature} />
        </div>
        {signature && (
          <Input
            size="small"
            value={sigLabel}
            maxLength={40}
            placeholder={t('print.preview.signatureDefault')}
            onChange={(e) => setSigLabel(e.target.value)}
          />
        )}
        {(data?.barcode || data?.barcodeColumn) && (
          <div>
            <div className="pp-wm-cap">{t('print.preview.codeType')}</div>
            <Segmented
              size="small"
              block
              value={codeType}
              onChange={(v) => setCodeType(v as CodeType)}
              options={[
                { value: 'code39', label: t('print.preview.codeCode39') },
                { value: 'qr', label: t('print.preview.codeQr') },
              ]}
            />
          </div>
        )}
        <div>
          <div className="pp-wm-cap">{t('print.preview.footerNote')}</div>
          <Input.TextArea
            value={footerNote}
            maxLength={120}
            autoSize={{ minRows: 1, maxRows: 3 }}
            placeholder={t('print.preview.footerNotePh')}
            onChange={(e) => setFooterNote(e.target.value)}
          />
        </div>
      </Space>
    </div>
  );

  const columnsContent = data ? (
    <div className="pp-cols">
      <div className="pp-cols__head">
        <Button size="small" type="link" onClick={() => setHiddenCols(new Set())}>
          {t('print.preview.columnsAll')}
        </Button>
      </div>
      {data.headers.map((h, i) => (
        <Checkbox
          key={i}
          checked={!hiddenCols.has(i)}
          onChange={(e) =>
            setHiddenCols((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.delete(i);
              else next.add(i);
              return next;
            })
          }
        >
          {h || `#${i + 1}`}
        </Checkbox>
      ))}
    </div>
  ) : null;

  /** Insert a `[Token]` at the caret of the band field last focused. */
  function insererJeton(jeton: string): void {
    const champ = bandFieldRef.current;
    if (!champ) return;
    setBands((b) => ({ ...b, [champ]: `${b[champ]}${jeton}` }));
  }

  const bandZones: [keyof PageBands, string][] = [
    ['headerLeft', t('print.preview.bandLeft')],
    ['headerCenter', t('print.preview.bandCenter')],
    ['headerRight', t('print.preview.bandRight')],
    ['footerLeft', t('print.preview.bandLeft')],
    ['footerCenter', t('print.preview.bandCenter')],
    ['footerRight', t('print.preview.bandRight')],
  ];

  const bandsDialog = (
    <Modal
      open={bandsOpen}
      title={t('print.preview.bandsTitle')}
      onCancel={() => setBandsOpen(false)}
      onOk={() => setBandsOpen(false)}
      okText={t('print.preview.close')}
      cancelButtonProps={{ style: { display: 'none' } }}
      width={620}
      destroyOnHidden
    >
      <div className="pp-bands">
        <div className="pp-bands__hint">{t('print.preview.bandsHint')}</div>
        <div className="pp-bands__tokens">
          {JETONS.map((j) => (
            <Button key={j} size="small" onClick={() => insererJeton(j)}>
              {j}
            </Button>
          ))}
          <Button size="small" type="link" onClick={() => setBands(BANDS_VIDES)}>
            {t('print.preview.bandsReset')}
          </Button>
        </div>
        {(['header', 'footer'] as const).map((partie, pi) => (
          <div key={partie} className="pp-bands__part">
            <div className="pp-bands__cap">
              {partie === 'header' ? t('print.preview.bandHeader') : t('print.preview.bandFooter')}
            </div>
            <div className="pp-bands__row">
              {bandZones.slice(pi * 3, pi * 3 + 3).map(([cle, libelle]) => (
                <Input
                  key={cle}
                  size="small"
                  value={bands[cle]}
                  placeholder={libelle}
                  maxLength={80}
                  onFocus={() => {
                    bandFieldRef.current = cle;
                  }}
                  onChange={(e) => setBands((b) => ({ ...b, [cle]: e.target.value }))}
                />
              ))}
            </div>
          </div>
        ))}
        {/* What the footer will actually print, defaults included. */}
        <div className="pp-bands__preview">
          <span className="pp-bands__cap">{t('print.preview.bandsPreview')}</span>
          <div className="pp-bands__demo">
            {zonesBande(false, 0).map((z, i) => (
              <span key={i}>{z}</span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );

  // ── Mise en page ────────────────────────────────────────────────────────────
  // The ribbon keeps its quick selects; this dialog is where the whole page is
  // set at once — with the miniature that shows what the choices do.
  const setupDialog = (
    <Modal
      open={setupOpen}
      title={t('print.preview.pageSetup')}
      onCancel={() => setSetupOpen(false)}
      onOk={() => setSetupOpen(false)}
      okText={t('print.preview.close')}
      cancelButtonProps={{ style: { display: 'none' } }}
      width={560}
      destroyOnHidden
    >
      <div className="pp-setup">
        <div className="pp-setup__fields">
          <label className="pp-setup__field">
            <span>{t('print.preview.paper')}</span>
            <Select
              size="small"
              value={paper}
              onChange={setPaper}
              options={(Object.keys(PAPER_MM) as Paper[]).map((p) => ({
                value: p,
                label: `${PAPER_LABEL[p]} — ${PAPER_MM[p][0]} × ${PAPER_MM[p][1]} mm`,
              }))}
            />
          </label>
          <label className="pp-setup__field">
            <span>{t('print.preview.orientation')}</span>
            <Segmented
              size="small"
              block
              value={orientation}
              onChange={(v) => setOrientation(v as Orientation)}
              options={[
                { value: 'portrait', label: t('print.preview.portrait') },
                { value: 'landscape', label: t('print.preview.landscape') },
              ]}
            />
          </label>
          <label className="pp-setup__field">
            <span>{t('print.preview.margins')}</span>
            <Select
              size="small"
              value={margin}
              onChange={setMargin}
              options={[
                { value: 'normal', label: `${t('print.preview.marginNormal')} — 12 mm` },
                { value: 'narrow', label: `${t('print.preview.marginNarrow')} — 6 mm` },
                { value: 'wide', label: `${t('print.preview.marginWide')} — 20 mm` },
                { value: 'custom', label: t('print.preview.marginCustom') },
              ]}
            />
          </label>
          {margin === 'custom' && (
            <div className="pp-setup__marges">
              {(['haut', 'droite', 'bas', 'gauche'] as const).map((cote) => (
                <label key={cote} className="pp-setup__field">
                  <span>{t(`print.preview.marge.${cote}`)}</span>
                  <InputNumber
                    size="small"
                    min={0}
                    max={100}
                    step={0.5}
                    value={marges[cote]}
                    onChange={(v) =>
                      setMarges((m) => ({ ...m, [cote]: borner(typeof v === 'number' ? v : 0) }))
                    }
                    addonAfter="mm"
                  />
                </label>
              ))}
            </div>
          )}
          <label className="pp-setup__field">
            <span>{t('print.preview.scale')}</span>
            <div className="pp-setup__scale">
              <Slider
                min={25}
                max={200}
                step={5}
                value={Math.round(scale * 100)}
                onChange={(v) => setScale(v / 100)}
                tooltip={{ formatter: (v) => `${v} %` }}
              />
              <InputNumber
                {...ENTIER_INPUT}
                size="small"
                min={25}
                max={200}
                value={Math.round(scale * 100)}
                onChange={(v) => setScale((typeof v === 'number' ? v : 100) / 100)}
                addonAfter="%"
              />
            </div>
          </label>
          <div className="pp-setup__hint">{t('print.preview.scaleHint')}</div>
        </div>

        {/* Live miniature: paper proportions with the margin box inside. */}
        <div className="pp-setup__preview">
          <MargesInteractives
            marges={pageMarges}
            dims={dims}
            largeurPx={dims.w > dims.h ? 160 : Math.round((160 * dims.w) / dims.h)}
            hauteurPx={dims.w > dims.h ? Math.round((160 * dims.h) / dims.w) : 160}
            echelleTexte={7 * scale}
            libelleTexte={t('print.preview.textSize')}
            // Tirer un guide fait basculer en marges libres : le geste EST le
            // choix, l'utilisateur n'a pas à sélectionner « personnalisées »
            // dans la liste avant de pouvoir bouger quoi que ce soit.
            onChange={(m) => {
              if (margin !== 'custom') setMargin('custom');
              setMarges(m);
            }}
          />
          <div className="pp-setup__dims">
            {dims.w} × {dims.h} mm · {t('print.preview.margeGlisser')}
          </div>
        </div>
      </div>
    </Modal>
  );

  const jobDialog = (
    <Modal
      open={jobOpen !== null}
      title={jobOpen === 'pdf' ? t('print.preview.pdfOptions') : t('print.preview.printOptions')}
      onCancel={() => setJobOpen(null)}
      onOk={() => {
        const quoi = jobOpen;
        setJobOpen(null);
        if (quoi === 'pdf') void doExportPdf();
        else void doQuickPrint();
      }}
      okText={jobOpen === 'pdf' ? t('print.preview.pdf') : t('print.preview.quickPrint')}
      cancelText={t('common.cancel') === 'common.cancel' ? 'Annuler' : t('common.cancel')}
      width={460}
      destroyOnHidden
    >
      <div className="pp-job">
        <div className="pp-bands__cap">{t('print.preview.range')}</div>
        <Radio.Group
          value={jobEtendue}
          onChange={(e) => setJobEtendue(e.target.value)}
          options={[
            { value: 'all', label: t('print.preview.rangeAll') },
            {
              value: 'current',
              label: t('print.preview.rangeCurrent', { n: curPage }),
              disabled: !isTable,
            },
            { value: 'range', label: t('print.preview.rangeCustom') },
          ]}
        />
        {jobEtendue === 'range' && (
          <Input
            size="small"
            value={jobRange}
            placeholder={t('print.preview.rangePh')}
            onChange={(e) => setJobRange(e.target.value.replace(/[^\d,\- ]/g, ''))}
          />
        )}
        {jobOpen === 'print' && (
          <label className="pp-setup__field">
            <span>{t('print.preview.copies')}</span>
            <InputNumber
              {...ENTIER_INPUT}
              size="small"
              min={1}
              max={99}
              value={jobCopies}
              onChange={(v) => setJobCopies(typeof v === 'number' ? v : 1)}
            />
          </label>
        )}
        <div className="pp-setup__hint">
          {jobOpen === 'pdf' ? t('print.preview.rangeHintPdf') : t('print.preview.rangeHintPrint')}
        </div>
      </div>
    </Modal>
  );

  const watermarkContent = (
    <div style={{ width: 244 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size={10}>
        <div className="pp-wm-line">
          <span>{t('print.preview.watermarkOn')}</span>
          <Switch checked={watermark.on} onChange={(on) => setWatermark((w) => ({ ...w, on }))} />
        </div>
        <Input
          value={watermark.text}
          maxLength={24}
          placeholder={t('print.preview.watermarkText')}
          onChange={(e) => setWatermark((w) => ({ ...w, text: e.target.value, on: true }))}
        />
        <div className="pp-wm-presets">
          {WM_PRESETS.map((p) => (
            <Button
              key={p}
              size="small"
              type={watermark.text === p ? 'primary' : 'default'}
              onClick={() => setWatermark((w) => ({ ...w, text: p, on: true }))}
            >
              {p}
            </Button>
          ))}
        </div>
        <div>
          <div className="pp-wm-cap">{t('print.preview.watermarkOpacity')}</div>
          <Slider
            min={4}
            max={30}
            value={Math.round(watermark.opacity * 100)}
            onChange={(v) => setWatermark((w) => ({ ...w, opacity: v / 100 }))}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </div>
        <div className="pp-wm-line">
          <span>{t('print.preview.watermarkDiagonal')}</span>
          <Switch
            checked={watermark.diagonal}
            onChange={(diagonal) => setWatermark((w) => ({ ...w, diagonal }))}
          />
        </div>
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      mask={{ enabled: !minimized, closable: false }}
      width={minimized ? 380 : maximized ? '98vw' : '86vw'}
      style={{
        top: maximized ? 8 : 16,
        transform: maximized || minimized ? undefined : `translate(${pos.x}px, ${pos.y}px)`,
      }}
      className={`pp-modal${maximized ? ' pp-modal--max' : ''}${minimized ? ' pp-modal--min' : ''}`}
      rootClassName={minimized ? 'pp-root--min' : undefined}
      title={
        <div
          className="pp-titlebar"
          onMouseDown={onTitleDown}
          onDoubleClick={() => !minimized && setMaximized((m) => !m)}
          onClick={() => minimized && setMinimized(false)}
          title={minimized ? t('print.preview.restore') : undefined}
        >
          {/* Quick access toolbar. Its own mouse handlers are stopped so clicking
              a command never drags (or maximises) the dialog. Hidden while rolled
              up, where only the title strip remains. */}
          {!minimized && (
            <div
              className="pp-qat"
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {qatShown.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="pp-qat__btn"
                  title={qatTitle(c)}
                  aria-label={c.label}
                  disabled={c.disabled}
                  onClick={c.run}
                >
                  {c.icon}
                </button>
              ))}
              <Dropdown
                trigger={['click']}
                placement="bottomLeft"
                menu={{ items: qatMenuItems, onClick: onQatMenu }}
              >
                <button
                  type="button"
                  className="pp-qat__more"
                  title={t('print.preview.qat.customize')}
                  aria-label={t('print.preview.qat.customize')}
                >
                  <DownOutlined />
                </button>
              </Dropdown>
            </div>
          )}
          <span className="pp-titlebar__text">{modalTitle}</span>
        </div>
      }
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      <div className="pp-ribbon">
        {/* Compressible commands: they shrink first (container queries below),
            then scroll as a last resort rather than being clipped. */}
        <div className="pp-ribbon__scroll">
          <RbGroup caption={t('print.preview.groups.impression')}>
            <RbBtn
              icon={<PrinterOutlined />}
              label={t('print.preview.print')}
              title={`${t('print.preview.print')} · Ctrl+P`}
              onClick={doPrint}
              disabled={!hasContent}
            />
            <RbBtn
              icon={<ThunderboltOutlined />}
              label={t('print.preview.quickPrint')}
              title={`${t('print.preview.quickPrint')} · Ctrl+Maj+P`}
              onClick={() => setJobOpen('print')}
              disabled={!hasContent}
            />
          </RbGroup>
          <RbSep />

          {isTable && (
            <>
              <RbGroup caption={t('print.preview.groups.pageSetup')}>
                <div className="pp-rb-fields">
                  <Select
                    size="small"
                    value={paper}
                    onChange={setPaper}
                    className="pp-rb-sel"
                    options={(Object.keys(PAPER_MM) as Paper[]).map((p) => ({
                      value: p,
                      label: PAPER_LABEL[p],
                    }))}
                  />
                  <Select
                    size="small"
                    value={margin}
                    onChange={setMargin}
                    className="pp-rb-sel"
                    options={[
                      { value: 'normal', label: t('print.preview.marginNormal') },
                      { value: 'narrow', label: t('print.preview.marginNarrow') },
                      { value: 'wide', label: t('print.preview.marginWide') },
                      { value: 'custom', label: t('print.preview.marginCustom') },
                    ]}
                  />
                  {margin === 'custom' && (
                    <Button
                      size="small"
                      className="pp-rb-sel"
                      onClick={() => setSetupOpen(true)}
                      title={t('print.preview.margeGlisser')}
                    >
                      {`${pageMarges.haut} · ${pageMarges.droite} · ${pageMarges.bas} · ${pageMarges.gauche} mm`}
                    </Button>
                  )}
                </div>
                <RbBtn
                  icon={<RotateRightOutlined />}
                  label={t('print.preview.orientation')}
                  title={
                    orientation === 'portrait'
                      ? t('print.preview.portrait')
                      : t('print.preview.landscape')
                  }
                  active={orientation === 'landscape'}
                  onClick={() =>
                    setOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))
                  }
                />
                <Popover content={docOptionsContent} trigger="click" placement="bottom">
                  <button type="button" className="pp-rb-btn" title={t('print.preview.docOptions')}>
                    <span className="pp-rb-btn__icon">
                      <SettingOutlined />
                    </span>
                    <span className="pp-rb-btn__label">{t('print.preview.docOptions')}</span>
                  </button>
                </Popover>
                <Popover content={columnsContent} trigger="click" placement="bottom">
                  <button
                    type="button"
                    className={`pp-rb-btn${hiddenCols.size > 0 ? ' is-active' : ''}`}
                    title={t('print.preview.columns')}
                  >
                    <span className="pp-rb-btn__icon">
                      <ControlOutlined />
                    </span>
                    <span className="pp-rb-btn__label">{t('print.preview.columns')}</span>
                  </button>
                </Popover>
                <RbBtn
                  icon={<FileTextOutlined />}
                  label={t('print.preview.pageSetup')}
                  title={`${t('print.preview.pageSetup')} · ${Math.round(scale * 100)} %`}
                  active={scale !== 1}
                  onClick={() => setSetupOpen(true)}
                />
                <RbBtn
                  icon={<BorderTopOutlined />}
                  label={t('print.preview.bands')}
                  title={t('print.preview.bandsTitle')}
                  active={Object.values(bands).some((z) => z.trim() !== '')}
                  onClick={() => setBandsOpen(true)}
                />
              </RbGroup>
              <RbSep />
            </>
          )}

          {(isTable || htmlSrc?.paged) && (
            <>
              <RbGroup caption={t('print.preview.groups.navigation')}>
                <div className="pp-rb-fields">
                  {/* Full-text search reads `data.rows` — meaningless for an
                      opaque pre-rendered `htmlSrc` document, so table-only. */}
                  {isTable && (
                    <Input
                      allowClear
                      ref={findRef}
                      size="small"
                      prefix={<SearchOutlined />}
                      placeholder={t('print.preview.find')}
                      value={find}
                      onChange={(e) => setFind(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          gotoMatch(e.shiftKey ? -1 : 1);
                        }
                      }}
                      className="pp-rb-find"
                      suffix={
                        term ? (
                          <span className="pp-find__count">
                            {totalHits ? activeMatch + 1 : 0}/{totalHits}
                          </span>
                        ) : null
                      }
                    />
                  )}
                  <div className="pp-rb-row">
                    <Tooltip title={`${t('print.preview.firstPage')} · Début`}>
                      <Button
                        size="small"
                        icon={<DoubleLeftOutlined />}
                        disabled={curPage <= 1}
                        onClick={() => gotoPage(1)}
                      />
                    </Tooltip>
                    <Tooltip title={`${t('print.preview.prevPage')} · Page préc.`}>
                      <Button
                        size="small"
                        icon={<LeftOutlined />}
                        disabled={curPage <= 1}
                        onClick={() => gotoPage(curPage - 1)}
                      />
                    </Tooltip>
                    <span className="pp-rb-page">
                      {curPage}/{totalPages}
                    </span>
                    <Tooltip title={`${t('print.preview.nextPage')} · Page suiv.`}>
                      <Button
                        size="small"
                        icon={<RightOutlined />}
                        disabled={curPage >= totalPages}
                        onClick={() => gotoPage(curPage + 1)}
                      />
                    </Tooltip>
                    <Tooltip title={`${t('print.preview.lastPage')} · Fin`}>
                      <Button
                        size="small"
                        icon={<DoubleRightOutlined />}
                        disabled={curPage >= totalPages}
                        onClick={() => gotoPage(totalPages)}
                      />
                    </Tooltip>
                  </div>
                </div>
                <RbBtn
                  icon={<ProfileOutlined />}
                  label={t('print.preview.thumbnails')}
                  active={showPages}
                  onClick={() => setShowPages((s) => !s)}
                />
              </RbGroup>
              <RbSep />
            </>
          )}

          <RbGroup caption={t('print.preview.groups.background')}>
            <Popover content={watermarkContent} trigger="click" placement="bottom">
              <button
                type="button"
                className={`pp-rb-btn${watermark.on ? ' is-active' : ''}`}
                disabled={!hasContent}
                title={t('print.preview.watermark')}
              >
                <span className="pp-rb-btn__icon">
                  <HighlightOutlined />
                </span>
                <span className="pp-rb-btn__label">{t('print.preview.watermark')}</span>
              </button>
            </Popover>
            <ColorPicker
              value={pageColor}
              disabledAlpha
              onChangeComplete={(c) => setPageColor(c.toHexString())}
              presets={[
                {
                  label: t('print.preview.pageColor'),
                  colors: ['#ffffff', '#fffef7', '#f5f7fb', '#fff7e6', '#f6ffed', '#e6f4ff'],
                },
              ]}
            >
              <button type="button" className="pp-rb-btn" title={t('print.preview.pageColor')}>
                <span className="pp-rb-btn__icon">
                  <BgColorsOutlined />
                </span>
                <span className="pp-rb-btn__label">{t('print.preview.pageColor')}</span>
              </button>
            </ColorPicker>
          </RbGroup>
          <RbSep />

          <RbGroup caption={t('print.preview.groups.export')}>
            {htmlSrc?.actions?.map((a) => (
              <RbBtn
                key={a.key}
                icon={a.icon}
                label={a.label}
                onClick={a.onClick}
                disabled={!hasContent || a.loading}
              />
            ))}
            <Dropdown
              disabled={!hasContent}
              trigger={['click']}
              menu={{ items: exportItems, onClick: onExport }}
            >
              <button
                type="button"
                className="pp-rb-btn"
                disabled={!hasContent}
                title={t('print.preview.exportMenu')}
              >
                <span className="pp-rb-btn__icon">
                  <DownloadOutlined />
                </span>
                <span className="pp-rb-btn__label">{t('print.preview.exportMenu')}</span>
              </button>
            </Dropdown>
          </RbGroup>

          {(isTable || htmlSrc?.paged) && (
            <>
              <RbSep />
              <RbGroup caption={t('print.preview.groups.view')}>
                <RbBtn
                  icon={<ColumnWidthOutlined />}
                  label={t('print.preview.fitWidth')}
                  onClick={() => applyZoomPreset('width')}
                />
                <RbBtn
                  icon={<ExpandOutlined />}
                  label={t('print.preview.fitPage')}
                  onClick={() => applyZoomPreset('whole')}
                />
                {/* Pages-per-row gallery, the report viewer's "Multiple Pages"
                    picker: each choice draws the layout it produces. */}
                <Popover
                  trigger="click"
                  placement="bottom"
                  content={
                    <div className="pp-nup">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`pp-nup__opt${(n === 1 ? !multi : multi && multiCols === n) ? ' is-active' : ''}`}
                          title={t('print.preview.pagesPerRow', { n })}
                          onClick={() => {
                            setMulti(n > 1);
                            if (n > 1) setMultiCols(n);
                          }}
                        >
                          <span className="pp-nup__grid">
                            {Array.from({ length: n }, (_, i) => (
                              <span key={i} className="pp-nup__page" />
                            ))}
                          </span>
                          <span className="pp-nup__cap">{n}</span>
                        </button>
                      ))}
                    </div>
                  }
                >
                  <button
                    type="button"
                    className={`pp-rb-btn${multi ? ' is-active' : ''}`}
                    title={t('print.preview.multiPage')}
                  >
                    <span className="pp-rb-btn__icon">
                      <AppstoreOutlined />
                    </span>
                    <span className="pp-rb-btn__label">{t('print.preview.multiPage')}</span>
                  </button>
                </Popover>
              </RbGroup>
            </>
          )}
        </div>

        {/* Pinned to the right: Aide & Fermer must never be the ones that
            overflow — Fermer is the way out of the preview. */}
        <div className="pp-ribbon__tail">
          <RbSep />

          <RbGroup caption={t('print.preview.groups.help')}>
            <RbBtn
              icon={<QuestionCircleOutlined />}
              label={t('print.preview.shortcuts')}
              title={shortcutsHelp}
            />
          </RbGroup>
          <RbSep />

          <RbGroup caption={t('print.preview.groups.close')}>
            <RbBtn icon={<CloseOutlined />} label={t('print.preview.close')} onClick={onClose} />
          </RbGroup>
        </div>
      </div>

      <Dropdown
        trigger={['contextMenu']}
        menu={{ items: pageMenuItems, onClick: ({ key }) => onPageMenu(key) }}
      >
        <div className="pp-viewer">
          <div className="pp-body">
            {showPages && (isTable || htmlSrc?.paged) && (
              <aside className="pp-rail">
                {/* Dock tabs, the way a report viewer stacks its side panels.
                    Search reads `data.rows` — meaningless for an opaque
                    `htmlSrc` document, so it's table-only; html mode gets a
                    single untabbed panel. */}
                {isTable && (
                  <div className="pp-rail__tabs">
                    <button
                      type="button"
                      className={`pp-rail__tab${dock === 'thumbs' ? ' is-active' : ''}`}
                      onClick={() => setDock('thumbs')}
                    >
                      {t('print.preview.thumbnails')}
                    </button>
                    <button
                      type="button"
                      className={`pp-rail__tab${dock === 'search' ? ' is-active' : ''}`}
                      onClick={() => setDock('search')}
                    >
                      {t('print.preview.searchTab')}
                    </button>
                  </div>
                )}

                {isTable && dock === 'search' && (
                  <div className="pp-search">
                    <Input
                      size="small"
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder={t('print.preview.find')}
                      value={find}
                      onChange={(e) => setFind(e.target.value)}
                    />
                    <Checkbox
                      className="pp-search__opt"
                      checked={matchCase}
                      onChange={(e) => setMatchCase(e.target.checked)}
                    >
                      {t('print.preview.matchCase')}
                    </Checkbox>
                    <div className="pp-search__count">
                      {term ? t('print.preview.hits', { n: totalHits }) : ''}
                    </div>
                    <div className="pp-search__list">
                      {hits.map((h, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`pp-search__hit${i === activeMatch ? ' is-active' : ''}`}
                          onClick={() => {
                            setActiveMatch(i);
                            gotoPage(h.page);
                          }}
                        >
                          <span className="pp-search__hitpage">p.{h.page}</span>
                          <span className="pp-search__hittext">{h.extrait}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isTable &&
                  dock === 'thumbs' &&
                  pages.map((pageRows, i) => (
                    <button
                      key={i}
                      className={`pp-thumb${curPage === i + 1 ? ' pp-thumb--active' : ''}`}
                      onClick={() => gotoPage(i + 1)}
                      title={t('print.preview.page', { n: i + 1, total: pages.length })}
                    >
                      {/* The real sheet, scaled: what you see in the rail is the page
                      itself, not a placeholder. Sized in px so the box keeps the
                      paper's aspect ratio whatever the current zoom. */}
                      <span
                        className="pp-thumb__paper"
                        style={{
                          width: THUMB_W,
                          height: Math.round((THUMB_W * dims.h) / dims.w),
                        }}
                      >
                        <span
                          className="pp-thumb__inner"
                          style={{
                            width: `${dims.w}mm`,
                            height: `${dims.h}mm`,
                            padding: `${pageMarges.haut}mm ${pageMarges.droite}mm ${pageMarges.bas}mm ${pageMarges.gauche}mm`,
                            background: pageColor,
                            transform: `scale(${THUMB_W / (dims.w * MM_TO_PX)})`,
                          }}
                        >
                          {sheetBody(pageRows, i)}
                        </span>
                      </span>
                      <span className="pp-thumb__cap">{i + 1}</span>
                    </button>
                  ))}

                {/* `htmlSrc` has no row data to render a faithful miniature
                    from — a named index (student name, when the document
                    supplies one via `data-pp-label`) is cheaper and, for a
                    dense document like a bulletin, more useful than an
                    illegible scaled-down page. */}
                {htmlSrc?.paged &&
                  Array.from({ length: htmlPageCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`pp-thumb-index${curPage === i + 1 ? ' pp-thumb-index--active' : ''}`}
                      onClick={() => gotoPage(i + 1)}
                    >
                      <span className="pp-thumb-index__n">{i + 1}</span>
                      <span className="pp-thumb-index__label">
                        {htmlPageLabels[i] ||
                          t('print.preview.page', { n: i + 1, total: htmlPageCount })}
                      </span>
                    </button>
                  ))}
              </aside>
            )}

            {htmlSrc ? (
              <div
                className={`bp-stage${htmlSrc.bare ? ' bp-stage--bare' : ''}`}
                ref={stageRef}
                onScroll={onPagesScroll}
              >
                {htmlSrc.loading ? (
                  <div className="bp-status">
                    <Spin description={t('print.preview.loading')}>
                      <div style={{ width: 1, height: 80 }} />
                    </Spin>
                  </div>
                ) : htmlSrc.html ? (
                  <div
                    className={`bp-paper${htmlSrc.paged || htmlSrc.bare ? ' bp-paper--paged' : ''}`}
                    style={{ zoom, width: bpPaperWidth }}
                  >
                    <iframe
                      ref={frameRef}
                      className="bp-frame"
                      title={htmlSrc.title}
                      scrolling="no"
                      style={{ width: bpPaperWidth }}
                      srcDoc={htmlSrc.html}
                      onLoad={() => {
                        paginate();
                        applyHtmlMultiPage();
                        applyHtmlWatermark();
                        applyHtmlPageColor();
                        fitHeight();
                        observeFrameBody();
                      }}
                    />
                  </div>
                ) : (
                  <div className="bp-status">
                    <Empty description={t('print.preview.empty')} />
                  </div>
                )}
              </div>
            ) : (
              <div
                className={multi ? 'pp-pages pp-pages--multi' : 'pp-pages'}
                ref={stageRef}
                onScroll={onPagesScroll}
                style={multi ? ({ '--pp-cols': multiCols } as React.CSSProperties) : undefined}
              >
                {/* The shared letterhead's CSS, injected once for the on-screen pages. */}
                <style dangerouslySetInnerHTML={{ __html: enteteCss(entete) }} />
                {data &&
                  pages.map((pageRows, pi) => (
                    <div
                      key={pi}
                      className="pp-sheetwrap"
                      ref={(el) => {
                        pageEls.current[pi] = el;
                      }}
                    >
                      <div
                        className="pp-page"
                        style={{
                          width: `${dims.w}mm`,
                          minHeight: `${dims.h}mm`,
                          padding: `${pageMarges.haut}mm ${pageMarges.droite}mm ${pageMarges.bas}mm ${pageMarges.gauche}mm`,
                          background: pageColor,
                          zoom,
                        }}
                      >
                        <div
                          className="pp-sheetbody"
                          style={scale !== 1 ? { zoom: scale } : undefined}
                        >
                          {sheetBody(pageRows, pi)}
                        </div>
                      </div>
                      {/* Page caption under the sheet, the way a report viewer labels
                      its pages (preview only — printing rebuilds its own HTML). */}
                      <div className="pp-sheetwrap__badge">
                        {t('print.preview.page', { n: pi + 1, total: pages.length })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </Dropdown>

      <div className="pp-statusbar">
        <div className="pp-status__seg">
          {isTable ? (
            <>
              <span>{t('print.preview.status.pages', { n: pages.length })}</span>
              <span className="pp-status__dot">·</span>
              <span>{t('print.preview.status.rows', { n: data?.rows.length ?? 0 })}</span>
              <span className="pp-status__dim">
                {' · '}
                {PAPER_LABEL[paper]} ·{' '}
                {orientation === 'portrait'
                  ? t('print.preview.portrait')
                  : t('print.preview.landscape')}
              </span>
            </>
          ) : htmlSrc?.paged ? (
            <>
              <span>{t('print.preview.status.pages', { n: totalPages })}</span>
              <span className="pp-status__dot">·</span>
              <span className="pp-status__dim">{htmlSrc.title}</span>
            </>
          ) : (
            <span className="pp-status__dim">{htmlSrc?.title}</span>
          )}
        </div>

        {(isTable || htmlSrc?.paged) && (
          <div className="pp-status__seg pp-status__nav">
            <Tooltip title={t('print.preview.prevPage')}>
              <Button
                size="small"
                type="text"
                icon={<LeftOutlined />}
                disabled={curPage <= 1}
                onClick={() => gotoPage(curPage - 1)}
              />
            </Tooltip>
            <span className="pp-status__page">
              <Input
                size="small"
                className="pp-status__pageinput"
                value={pageEdit}
                onChange={(e) => setPageEdit(e.target.value.replace(/[^\d]/g, ''))}
                onPressEnter={() => gotoPage(Number(pageEdit) || 1)}
                onBlur={() => gotoPage(Number(pageEdit) || 1)}
              />
              <span className="pp-status__pageof">/ {totalPages}</span>
            </span>
            <Tooltip title={t('print.preview.nextPage')}>
              <Button
                size="small"
                type="text"
                icon={<RightOutlined />}
                disabled={curPage >= totalPages}
                onClick={() => gotoPage(curPage + 1)}
              />
            </Tooltip>
          </div>
        )}

        <div className="pp-status__seg pp-status__zoom">
          <ZoomOutOutlined className="pp-status__zicon" onClick={() => stepZoom(-1)} />
          <Slider
            className="pp-status__slider"
            min={20}
            max={200}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(v) => {
              userZoomedRef.current = true;
              setZoom(v / 100);
            }}
            tooltip={{ open: false }}
          />
          <ZoomInOutlined className="pp-status__zicon" onClick={() => stepZoom(1)} />
          {/* The % doubles as the preset picker (Page entière, Largeur, 100 %…). */}
          <Dropdown
            trigger={['click']}
            placement="topRight"
            menu={{ items: zoomMenuItems, onClick: ({ key }) => applyZoomPreset(key) }}
          >
            <button type="button" className="pp-status__pct" title={t('print.preview.zoomPresets')}>
              {Math.round(zoom * 100)}%
            </button>
          </Dropdown>
        </div>
      </div>

      {bandsDialog}
      {setupDialog}
      {jobDialog}
    </Modal>
  );
}

/**
 * Table-data adapter over {@link DocumentPreview}: paginates `{ headers, rows,
 * totals }` onto sheets with find / export / barcode support. Kept as a named
 * entry point so the many `DataTable`-driven call sites stay unchanged.
 */
export interface PrintPreviewProps {
  open: boolean;
  data: PrintPreviewData | null;
  onClose: () => void;
  /** Name printed in the "printed by" footer token. Apps that have a signed-in
   *  user pass it here; the library has no notion of one. */
  printedByName?: string | null;
}

/**
 * The ready-made preview: {@link DocumentPreview} with the labels already
 * wired to i18next. Its props are exactly the grid's `TablePrintProps`, so it
 * drops straight into `DataTableConfigProvider`:
 *
 * ```tsx
 * import { PrintPreview } from '@rindra/desktop/print';
 *
 * <DataTableConfigProvider config={{ PrintPreview }}>
 * ```
 *
 * Reach for `DocumentPreview` directly when you need a non-table source, your
 * own label set, or custom {@link PreviewDeps}.
 */
export function PrintPreview({
  open,
  data,
  onClose,
  printedByName = null,
}: PrintPreviewProps): React.JSX.Element {
  const messages = usePreviewMessages();
  return (
    <DocumentPreview
      open={open}
      source={{ kind: 'table', data }}
      onClose={onClose}
      messages={messages}
      printedByName={printedByName}
    />
  );
}
