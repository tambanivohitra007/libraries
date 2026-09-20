/**
 * `@rindra/desktop/print` — a standalone print-preview, in the shape of the
 * one a commercial component suite ships: paper sizes and orientation,
 * interactive margins, zoom, watermarks, editable header/footer bands with
 * `[Page]`/`[Pages]` tokens, a letterhead, a signature block, and export to
 * PDF, DOCX, XLSX, CSV, TSV and JSON.
 *
 * It is a separate entry point on purpose: nothing here is needed by the grid,
 * and an app that never prints should not carry a DOCX writer. Import the
 * stylesheet alongside it:
 *
 * ```ts
 * import { PrintPreview } from '@rindra/desktop/print';
 * import '@rindra/desktop/print.css';
 * ```
 *
 * Two injection points keep it host-agnostic. {@link PreviewDeps} covers what a
 * browser cannot do — export a PDF, print silently, write a spreadsheet — each
 * with a working default. {@link PreviewMessages} covers every label, French by
 * default, so the module runs with **no i18n library at all**; wire `messages`
 * to yours to make one translation file authoritative.
 */

// ── The component ──────────────────────────────────────────────────────────
export {
  DocumentPreview,
  PrintPreview,
  type PreviewAction,
  type PreviewSource,
  type PrintPreviewProps,
} from './DocumentPreview';

// ── Document model ─────────────────────────────────────────────────────────
// The data a document is built from, and the HTML builder behind the table
// source. Useful to a host preparing documents of its own.
export {
  BANDS_VIDES,
  JETONS,
  bandeNonVide,
  buildListePrintHtml,
  escapeHtml,
  modelesBandesPdf,
  resoudreJetons,
  sansJetonsDePage,
  styleTableauCss,
  toEnteteEtab,
  watermarkCss,
  type DocOptions,
  type JetonContexte,
  type PageBands,
  type PrintPreviewData,
  type StyleTableau,
  type Watermark,
} from './document';

// ── Page geometry ──────────────────────────────────────────────────────────
export {
  MARGES_DEFAUT,
  MARGE_MIN_MM,
  MM_TO_PX,
  MARGIN_MM,
  PAPER_LABEL,
  PAPER_MM,
  borner,
  margeVerticale,
  margesMm,
  pageMm,
  rowsPerPage,
  type Marges,
  type Margin,
  type Orientation,
  type Paper,
} from './paper';

// ── Document outputs ───────────────────────────────────────────────────────
// No React here: testable and usable on their own.
export {
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

// ── Letterhead ─────────────────────────────────────────────────────────────
export {
  enteteAvecDefauts,
  enteteCss,
  enteteParDefaut,
  renderEntete,
  renderPied,
  type EnteteConfig,
  type EnteteDesign,
  type EnteteEtab,
  type EnteteMode,
  type LogoPosition,
  type PoliceEntete,
  type RenderEnteteOptions,
} from './entete-config';

// ── Injection points ───────────────────────────────────────────────────────
export {
  defaultPreviewDeps,
  usePreviewMessages,
  type CodeType,
  type EtablissementInfo,
  type PreviewDeps,
  type XlsxExportInput,
} from './previewDeps';
export {
  defaultPreviewMessages,
  makePreviewTranslate,
  type PreviewMessages,
  type TranslateFn,
} from './previewMessages';

// ── Pieces worth reusing ───────────────────────────────────────────────────
export { MargesInteractives } from './MargesInteractives';
export { RbBtn, RbGroup, RbSep } from './ribbon-parts';
export { code128Svg, code39Svg, codeSvg, qrSvg, sanitizeCode39 } from './barcode';
export { colonnesNumeriques, formatExcel, lireNombre } from './tableau-nombres';
