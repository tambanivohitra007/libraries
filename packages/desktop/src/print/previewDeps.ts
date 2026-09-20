import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { enteteParDefaut, type EnteteConfig } from './entete-config';
import type { FileFilter } from '../host/host';
import { code39Svg, qrSvg } from './barcode';
import type { PreviewMessages } from './previewMessages';
import type { Marges, Orientation, Paper } from './paper';

/**
 * Everything the preview hands a spreadsheet exporter. The preview builds this
 * from its own state, so the shape belongs here rather than to any one app's
 * IPC contract — a host implements `exportXlsx` against it and writes the file
 * however it likes.
 */
export interface XlsxExportInput {
  data: { title: string; headers: string[]; rows: string[][]; totals?: string[] };
  options: {
    titreFeuille: string;
    visibleIdx: number[];
    tableStyle: string;
    paper: Paper;
    orientation: Orientation;
    marges: Marges;
    letterhead: boolean;
    signature: boolean;
    sigLabel: string;
    faitA: string;
    today: string;
    /** Header band, left / centre / right, tokens already resolved. */
    bandeHaut: [string, string, string];
    /** Footer band, left / centre / right, tokens already resolved. */
    bandeBas: [string, string, string];
    etab: EtablissementInfo | null;
  };
}

/**
 * Host-application bindings for {@link DocumentPreview}.
 *
 * The preview component is otherwise self-contained — it knows how to lay out,
 * paginate and decorate a document, but it must reach *out* to the host app for
 * four things: the letterhead identity/logo, the platform print/export I/O, and
 * the barcode encoder. Those are gathered here behind a small interface so the
 * component carries no hard dependency on Electron (`window.api`), the bundled
 * assets, or any app-specific module. To reuse the preview in another project,
 * supply your own `PreviewDeps` (see {@link defaultPreviewDeps} for the wiring
 * used here) via the component's `deps` prop.
 */

export type CodeType = 'code39' | 'qr';

/** The subset of the school identity the letterhead renders. */
export interface EtablissementInfo {
  nom: string;
  ministere?: string | null;
  bp?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  ville?: string | null;
  proviseur?: string | null;
}

export interface PreviewDeps {
  /** Fetch the letterhead identity (or null to render a bare logo + name). */
  getEtablissement: () => Promise<EtablissementInfo | null>;
  /** Fetch the configured logo as a data-URL (or null for none). */
  getLogo: () => Promise<string | null>;
  /** Fetch the saved document branding (header/footer) for the letterhead. */
  getEnteteConfig: () => Promise<EnteteConfig>;
  /** Resolve a (possibly empty) logo to an `<img src>`, e.g. a fallback brand. */
  resolveLogo: (logo: string | null) => string;
  /** Save the document HTML as a PDF; resolves to the saved path (or null).
   *  `bandes` carries Chromium header/footer templates when the document has
   *  page bands — the one export path that can number pages. */
  exportPdf: (
    html: string,
    filename: string,
    bandes?: { header: string; footer: string },
    pageRanges?: string,
  ) => Promise<string | null>;
  /**
   * Write an exported document to a file the user picks, resolving to the saved
   * path (null if cancelled). Optional: without it the preview falls back to a
   * plain browser download, which is all a web host can do — but then the file
   * lands wherever the browser puts it and {@link openFile} has nothing to open.
   */
  saveFile?: (
    nomFichier: string,
    contenu: string | Uint8Array,
    filtre: { name: string; extensions: string[] },
  ) => Promise<string | null>;
  /** Export the table as a laid-out spreadsheet; resolves to the saved path.
   *  Optional: without it the preview offers only the raw CSV. */
  exportXlsx?: (input: XlsxExportInput, nomFichier: string) => Promise<string | null>;
  /** Open a saved export with its default application; false if it couldn't. */
  openFile?: (chemin: string) => Promise<boolean>;
  /** Reveal a saved export in the system file manager. */
  revealFile?: (chemin: string) => Promise<boolean>;
  /** Print silently to the default printer; resolves true on success. */
  printSilent: (
    html: string,
    options?: { copies?: number; pageRanges?: { from: number; to: number }[] },
  ) => Promise<boolean>;
  /** Encoder factory for the chosen symbology (Code 39 / QR). */
  encodeBarcode: (type: CodeType) => (value: string) => string;
  /** Letterhead top line (country / organisation); '' to omit. */
  republique: string;
}

/**
 * Browser-only defaults: everything that works with no host at all.
 *
 * The four Electron-shaped capabilities — a real PDF, silent printing, a laid
 * out spreadsheet, and the stored letterhead — have no browser equivalent, so
 * they resolve to "not available" and the preview hides those actions rather
 * than offering a button that does nothing. File saving is not here: it comes
 * from the {@link DesktopHost} adapter, which already owns save / reveal /
 * open for the whole library.
 */
export const defaultPreviewDeps: PreviewDeps = {
  getEtablissement: async () => null,
  getLogo: async () => null,
  getEnteteConfig: async () => enteteParDefaut(),
  resolveLogo: (logo: string | null) => logo ?? '',
  exportPdf: async () => null,
  printSilent: async () => false,
  encodeBarcode: (type) => (type === 'qr' ? qrSvg : code39Svg),
  // A letterhead top line is branding; an app that wants one supplies it.
  republique: '',
};

/**
 * The save / reveal / open trio, taken from the library's host adapter so the
 * print module and the grid write files the same way — one native dialog
 * implementation per app, not two.
 */
export function hostPreviewDeps(host: {
  saveDocument: (n: string, c: string | Uint8Array, f?: FileFilter) => Promise<string | null>;
  revealFile: (p: string) => void;
  openFile: (p: string) => Promise<boolean>;
}): Pick<PreviewDeps, 'saveFile' | 'revealFile' | 'openFile'> {
  return {
    saveFile: (nomFichier, contenu, filtre) => host.saveDocument(nomFichier, contenu, filtre),
    revealFile: async (chemin) => {
      host.revealFile(chemin);
      return true;
    },
    openFile: (chemin) => host.openFile(chemin),
  };
}

/**
 * Pull the `print.preview.*` strings out of the app's i18next bundle so the
 * shared locale file stays the single source of truth — passed to the preview's
 * `messages` prop. Re-evaluates on language change; if the bundle is missing the
 * subtree, the component falls back to its built-in defaults.
 */
export function usePreviewMessages(): Partial<PreviewMessages> {
  const { i18n: inst } = useTranslation();
  const lang = inst.language;
  return useMemo(() => {
    const bundle = inst.getResourceBundle(lang, 'translation') as
      | Record<string, unknown>
      | undefined;
    const pp = (bundle?.print as Record<string, unknown> | undefined)?.preview;
    const out: PreviewMessages = {};
    const walk = (o: Record<string, unknown>, prefix: string): void => {
      for (const key of Object.keys(o)) {
        const v = o[key];
        if (v && typeof v === 'object') walk(v as Record<string, unknown>, `${prefix}${key}.`);
        else if (typeof v === 'string') out[`${prefix}${key}`] = v;
      }
    };
    if (pp && typeof pp === 'object') walk(pp as Record<string, unknown>, 'print.preview.');
    return out;
  }, [inst, lang]);
}
