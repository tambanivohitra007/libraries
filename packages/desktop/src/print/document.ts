/**
 * Printable table/list document — the builder behind the preview dialog's
 * « table » mode (registres, listes d'élèves, journaux de caisse…). Pure string
 * builder (no React/DOM): {@link PrintPreview} owns the on-screen chrome and calls
 * {@link buildListePrintHtml} for print / PDF / save. Fully offline: inline CSS,
 * system fonts, inline SVG codes, data-URL logo — no external assets.
 */
import { enteteCss, renderEntete, type EnteteConfig, type EnteteEtab } from './entete-config';
import { colonnesNumeriques } from './tableau-nombres';
// Type-only (erased at runtime): the preview's all-optional school identity.
import type { EtablissementInfo } from './previewDeps';

/**
 * Look of the printed table and of its title band.
 *
 * - `moderne` : pas de quadrillage, un filet sous l'en-tête et sous chaque
 *   ligne, titre aligné à gauche avec la date en regard. C'est le défaut.
 * - `quadrille` : le tableau encadré d'origine — une liste d'appel qu'on
 *   remplit au stylo a besoin de ses cases, et un registre archivé aussi.
 */
export type StyleTableau = 'moderne' | 'quadrille';

export type Orientation = 'portrait' | 'landscape';
export type Paper = 'A4' | 'A5' | 'letter' | 'legal';

export interface Watermark {
  on: boolean;
  text: string;
  /** Ink opacity, 0.04–0.30 (faint stamp). */
  opacity: number;
  /** Rotate −30° (diagonal) vs. horizontal. */
  diagonal: boolean;
}

/** The six editable page zones — a report viewer's header/footer bands. Each
 *  holds free text plus `[Tokens]` resolved per page (see {@link resoudreJetons}). */
export interface PageBands {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
}

export const BANDS_VIDES: PageBands = {
  headerLeft: '',
  headerCenter: '',
  headerRight: '',
  footerLeft: '',
  footerCenter: '',
  footerRight: '',
};

/** Placeholders offered by the header/footer editor, in insertion order. */
export const JETONS = [
  '[Page]',
  '[Pages]',
  '[Date]',
  '[Heure]',
  '[Utilisateur]',
  '[Titre]',
] as const;

/** Values a band's tokens resolve against. `page`/`pages` are omitted where the
 *  medium can't know them (a printed CSS band), leaving those tokens blank. */
export interface JetonContexte {
  page?: number;
  pages?: number;
  date: string;
  heure: string;
  utilisateur: string;
  titre: string;
}

/**
 * Substitute `[Token]` placeholders. A page counter the medium can't know
 * (`page`/`pages` left undefined) is **kept as its token** so the next stage can
 * deal with it — the PDF exporter swaps it for Chromium's counter spans, the CSS
 * band strips it. Unknown tokens are left untouched too, so a typo shows on the
 * page instead of vanishing.
 */
export function resoudreJetons(texte: string, ctx: JetonContexte): string {
  if (!texte) return '';
  const table: Record<string, string | undefined> = {
    '[Page]': ctx.page != null ? String(ctx.page) : undefined,
    '[Pages]': ctx.pages != null ? String(ctx.pages) : undefined,
    '[Date]': ctx.date,
    '[Heure]': ctx.heure,
    '[Utilisateur]': ctx.utilisateur,
    '[Titre]': ctx.titre,
  };
  return texte.replace(/\[(?:Page|Pages|Date|Heure|Utilisateur|Titre)\]/g, (m) => table[m] ?? m);
}

/** Drop page-counter tokens a medium can't resolve (the printed CSS bands). */
export function sansJetonsDePage(texte: string): string {
  return texte.replace(/\[Pages?\]/g, '');
}

/** True when at least one zone of the band carries something. */
export function bandeNonVide(zones: [string, string, string]): boolean {
  return zones.some((z) => z.trim() !== '');
}

export interface PrintPreviewData {
  title: string;
  headers: string[];
  rows: string[][];
  /** Optional totals row, aligned to `headers`, shown as a repeating footer. */
  totals?: string[];
  /** Optional value rendered as a Code 39 barcode in the document header. */
  barcode?: string;
  /** Optional extra column of Code 39 barcodes, appended to the table. Each
   *  row's barcode encodes that row's cell at `sourceIndex` (e.g. matricule). */
  barcodeColumn?: { title: string; sourceIndex: number };
}

/** Resolved document-decoration options passed into {@link buildListePrintHtml}. */
export interface DocOptions {
  etab: EtablissementInfo | null;
  /** Resolved logo `<img src>` (already passed through the preview's resolveLogo). */
  logo: string;
  /** Letterhead top line (country / organisation); '' to omit. */
  republique: string;
  orientation: Orientation;
  paper: Paper;
  /** Marge unique, ou les quatre côtés (haut, droite, bas, gauche) en mm. */
  marginMm: number | { haut: number; droite: number; bas: number; gauche: number };
  pageColor: string;
  watermark: Watermark;
  letterhead: boolean;
  signature: boolean;
  sigLabel: string;
  faitA: string;
  footerNote: string;
  printedBy: string;
  /** Editable page bands. Their `[Page]`/`[Pages]` tokens stay blank here —
   *  Chromium can't count pages from CSS — and are filled by the PDF exporter's
   *  own header/footer templates (see {@link modelesBandesPdf}). */
  bands: PageBands;
  /** Values the bands' tokens resolve against. */
  bandsCtx: JetonContexte;
  /** Print scale, 0.25–2. Applied as a CSS `zoom` on the body: Chromium reflows
   *  (unlike `transform`), so pagination stays correct while more — or less —
   *  content fits on a page. */
  scale: number;
  today: string;
  visibleIdx: number[];
  /** Encoder for the document/row barcodes (Code 39 or QR). */
  code: (value: string) => string;
  /** Saved document branding driving the letterhead. */
  entete: EnteteConfig;
  /** Look of the table and its title band. */
  tableStyle: StyleTableau;
}

/**
 * CSS of the title band and of the table, per style. Kept beside the on-screen
 * rules of `print-preview.css` (`.pp-dt--*` / `.pp-table--*`) — the preview and
 * the paper must show the same document, so the two move together.
 *
 * Ink is a real cost here: the modern style leans on rules and weight rather
 * than on filled cells, and its zebra stays faint enough to survive a tired
 * laser printer without banding.
 */
export function styleTableauCss(style: StyleTableau): string {
  if (style === 'quadrille') {
    return (
      `.dt{text-align:center;border-top:2px solid #333;border-bottom:2px solid #333;padding:4px 0;margin-bottom:8px}` +
      `.dt h3{margin:0;font-size:14px}.dt .meta{color:#555;font-size:10px}` +
      `table{border-collapse:collapse;width:100%;position:relative;z-index:1}` +
      `th,td{border:1px solid #bbb;padding:5px 7px;font-size:11px;text-align:left}` +
      `th{background:#eee}tfoot td{background:#f3f3f3;font-weight:700}`
    );
  }
  // Palette ardoise plutôt que noir pur : c'est ce qui distingue un état
  // financier lisible d'un tableau de traitement de texte. Le titre porte la
  // page (grand, léger), la date le sous-titre, et la bande d'en-tête sépare —
  // il n'y a donc pas de filet sous le titre.
  return (
    `.dt{margin:0 0 8px}` +
    `.dt h3{margin:0;font-size:24px;font-weight:400;letter-spacing:-0.02em;` +
    `line-height:1.15;color:#17263d}` +
    `.dt .meta{color:#6b7c96;font-size:10px;margin-top:3px}` +
    `table{border-collapse:collapse;width:100%;position:relative;z-index:1}` +
    `th,td{border:0;padding:6px 8px;font-size:10.5px;text-align:left}` +
    `th{background:#eef2f7;color:#17263d;font-weight:700;` +
    `border-bottom:2px solid #5b6b84;white-space:nowrap}` +
    `td{color:#46566e}` +
    `tbody tr:nth-child(even) td{background:#f7f9fc}` +
    // Les chiffres s'alignent sur leur virgule, en chasse fixe : deux montants
    // superposés doivent se comparer d'un coup d'œil.
    `th.n,td.n{text-align:right;font-variant-numeric:tabular-nums}` +
    `tfoot td{border-top:1px solid #5b6b84;border-bottom:2px solid #17263d;` +
    `color:#17263d;font-weight:700;background:none}`
  );
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

/** Adapt the preview's (all-optional) school identity to the header renderer's
 *  required-string shape. */
export function toEnteteEtab(e: EtablissementInfo | null): EnteteEtab {
  return {
    nom: e?.nom ?? '',
    ministere: e?.ministere ?? '',
    bp: e?.bp ?? '',
    telephone: e?.telephone ?? '',
    adresse: e?.adresse ?? '',
    ville: e?.ville ?? '',
  };
}

/**
 * Inline CSS for the watermark, shared by the printed table and injected html.
 * `fixed` (the default) is what real pagination — Chromium print/PDF, or the
 * browser rendering a normal single-page document — repeats on every physical
 * page on its own. `perSheet` is for the print-preview's own `paged` mode
 * (see `PrintPreview.applyHtmlWatermark`): there the "pages" are just stacked
 * `.pp-sheet` divs in one scrollable document, so a `fixed` mark would only
 * float once over whichever sheet is under it; `absolute` anchors it inside
 * its own sheet (already `position: relative`) instead.
 */
export function watermarkCss(wm: Watermark, perSheet = false): string {
  return (
    `position:${perSheet ? 'absolute' : 'fixed'};top:50%;left:50%;transform:translate(-50%,-50%) rotate(${
      wm.diagonal ? -30 : 0
    }deg);` +
    `font-size:90px;font-weight:800;letter-spacing:6px;color:rgba(0,0,0,${wm.opacity});` +
    `text-transform:uppercase;z-index:0;pointer-events:none`
  );
}

/** The letterhead: the full identity band, or a compact logo + name when the
 *  letterhead toggle is off. Driven by the shared document branding. */
function letterheadHtml(o: DocOptions): string {
  return renderEntete(o.entete, toEnteteEtab(o.etab), o.logo, { compact: !o.letterhead });
}

/**
 * Chromium header/footer templates for the PDF exporter. This is the one medium
 * that *can* number pages: `printToPDF` substitutes its own `.pageNumber` and
 * `.totalPages` spans, so `[Page]` / `[Pages]` become real numbers there. Returns
 * `null` when both bands are empty, so the exporter keeps its plain layout.
 */
export function modelesBandesPdf(
  bands: PageBands,
  ctx: JetonContexte,
): { header: string; footer: string } | null {
  // Resolve every token but the page counters, then hand those to Chromium's own
  // spans. escapeHtml leaves the brackets intact, so the tokens survive to here.
  const sansPages: JetonContexte = { ...ctx, page: undefined, pages: undefined };
  const zoneAvecPages = (texte: string): string =>
    escapeHtml(resoudreJetons(texte, sansPages))
      .replace(/\[Page\]/g, '<span class="pageNumber"></span>')
      .replace(/\[Pages\]/g, '<span class="totalPages"></span>');
  const bande = (zones: [string, string, string]): string =>
    `<div style="font-size:9px;color:#666;width:100%;padding:0 10mm;` +
    `display:flex;justify-content:space-between;gap:12px">` +
    zones.map((z) => `<span style="flex:1">${z}</span>`).join('') +
    `</div>`;
  const h: [string, string, string] = [
    zoneAvecPages(bands.headerLeft),
    zoneAvecPages(bands.headerCenter),
    zoneAvecPages(bands.headerRight),
  ];
  const f: [string, string, string] = [
    zoneAvecPages(bands.footerLeft),
    zoneAvecPages(bands.footerCenter),
    zoneAvecPages(bands.footerRight),
  ];
  if (!bandeNonVide(h) && !bandeNonVide(f)) return null;
  // Chromium needs both templates; an empty one is an empty div.
  return {
    header: bandeNonVide(h) ? bande(h) : '<div></div>',
    footer: bandeNonVide(f) ? bande(f) : '<div></div>',
  };
}

/** Build the full printable HTML document (shared by print, save and PDF). */
/** Marges CSS : une valeur, ou les quatre côtés dans l'ordre CSS. */
function margeCss(m: DocOptions['marginMm']): string {
  return typeof m === 'number' ? `${m}mm` : `${m.haut}mm ${m.droite}mm ${m.bas}mm ${m.gauche}mm`;
}

export function buildListePrintHtml(data: PrintPreviewData, o: DocOptions): string {
  const idx = o.visibleIdx;
  const bc = data.barcodeColumn;
  const bcCell = (value: string): string =>
    `<td class="bc">${o.code(value)}<div class="bccap">${escapeHtml(value)}</div></td>`;
  // Le quadrillé garde l'alignement à gauche d'origine ; seul le style moderne
  // aligne les chiffres à droite.
  const num =
    o.tableStyle === 'moderne'
      ? colonnesNumeriques([...data.rows, ...(data.totals ? [data.totals] : [])], idx)
      : new Set<number>();
  const cls = (i: number): string => (num.has(i) ? ' class="n"' : '');
  const head =
    idx.map((i) => `<th${cls(i)}>${escapeHtml(data.headers[i])}</th>`).join('') +
    (bc ? `<th>${escapeHtml(bc.title)}</th>` : '');
  const body = data.rows
    .map((r) => {
      const cells = idx.map((i) => `<td${cls(i)}>${escapeHtml(r[i] ?? '')}</td>`).join('');
      return `<tr>${cells}${bc ? bcCell(r[bc.sourceIndex] ?? '') : ''}</tr>`;
    })
    .join('');
  const foot =
    data.totals && data.totals.length
      ? `<tfoot><tr>${idx
          .map((i) => `<td${cls(i)}>${escapeHtml(data.totals?.[i] ?? '')}</td>`)
          .join('')}${bc ? '<td></td>' : ''}</tr></tfoot>`
      : '';
  const docBc = data.barcode
    ? `<div class="docbc">${o.code(data.barcode)}` +
      `<div class="bccap">${escapeHtml(data.barcode)}</div></div>`
    : '';
  const titleBand = `<div class="dt"><h3>${escapeHtml(data.title)}</h3><div class="meta">${escapeHtml(
    o.today,
  )}</div></div>`;
  const sig = o.signature
    ? `<div class="sig"><div class="sig-date">${escapeHtml(o.faitA)}</div>` +
      `<div class="sig-role">${escapeHtml(o.sigLabel)}</div>` +
      `<div class="sig-name">${escapeHtml(o.etab?.proviseur ?? '')}</div></div>`
    : '';
  // Page bands. An empty zone falls back to what the document showed before the
  // editor existed (audit line · note · nothing), so defaults print unchanged.
  const zone = (texte: string, repli = ''): string =>
    escapeHtml(sansJetonsDePage(resoudreJetons(texte, o.bandsCtx)).trim() || repli);
  const hz: [string, string, string] = [
    zone(o.bands.headerLeft),
    zone(o.bands.headerCenter),
    zone(o.bands.headerRight),
  ];
  const fz: [string, string, string] = [
    zone(o.bands.footerLeft, o.printedBy),
    zone(o.bands.footerCenter, o.footerNote),
    zone(o.bands.footerRight),
  ];
  const header = bandeNonVide(hz)
    ? `<div class="ph">${hz.map((z) => `<span>${z}</span>`).join('')}</div>`
    : '';
  const footer = bandeNonVide(fz)
    ? `<div class="pf">${fz.map((z) => `<span>${z}</span>`).join('')}</div>`
    : '';
  const wm =
    o.watermark.on && o.watermark.text.trim()
      ? `<div class="wm">${escapeHtml(o.watermark.text)}</div>`
      : '';
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title>` +
    `<style>` +
    `@page{size:${o.paper} ${o.orientation};margin:${margeCss(o.marginMm)}}` +
    `body{font-family:'Segoe UI',sans-serif;color:#000;margin:0;` +
    (o.scale !== 1 ? `zoom:${o.scale};` : '') +
    `background:${o.pageColor};-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    enteteCss(o.entete) +
    styleTableauCss(o.tableStyle) +
    `.docbc{text-align:center;margin-top:12px}.docbc svg{height:34px;width:auto;display:inline-block}` +
    `td.bc{text-align:center;white-space:nowrap}td.bc svg{height:34px;width:auto;display:block;margin:0 auto}` +
    `.bccap{font-size:8px;letter-spacing:1px;margin-top:1px;text-align:center}` +
    `thead{display:table-header-group}tfoot{display:table-footer-group}` +
    `tr{page-break-inside:avoid}` +
    `.sig{margin-top:26px;width:60%;margin-left:auto;text-align:center}` +
    `.sig-date{font-size:11px;text-align:right;margin-bottom:34px}` +
    `.sig-role{font-size:11px;font-weight:700}.sig-name{font-size:11px;margin-top:2px}` +
    // position:fixed repeats these bands on every printed page in Chromium.
    `.pf{position:fixed;bottom:4mm;left:8mm;right:8mm;display:flex;justify-content:space-between;` +
    `gap:12px;font-size:9px;color:#666;border-top:1px solid #ccc;padding-top:2px}` +
    `.ph{position:fixed;top:2mm;left:8mm;right:8mm;display:flex;justify-content:space-between;` +
    `gap:12px;font-size:9px;color:#666;border-bottom:1px solid #ccc;padding-bottom:2px}` +
    `.pf span,.ph span{flex:1}.pf span:nth-child(2),.ph span:nth-child(2){text-align:center}` +
    `.pf span:last-child,.ph span:last-child{text-align:right}` +
    // position:fixed repeats the watermark on every printed page in Chromium.
    `.wm{${watermarkCss(o.watermark)}}` +
    `</style></head><body>` +
    wm +
    header +
    letterheadHtml(o) +
    titleBand +
    `<table><thead><tr>${head}</tr></thead>${foot}<tbody>${body}</tbody></table>` +
    docBc +
    sig +
    footer +
    `</body></html>`
  );
}
