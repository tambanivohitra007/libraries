import {
  escapeHtml,
  watermarkCss,
  type PrintPreviewData,
  type Watermark,
} from './document';

/**
 * Sorties de document : impression navigateur, téléchargement, et les formats
 * de données (CSV / JSON / TSV).
 *
 * Module interne de `print-preview`. Rien ici ne dépend de React : ce sont les
 * fonctions qu'on veut pouvoir tester — et réutiliser — seules.
 */

/** Nom de fichier débarrassé des caractères interdits par Windows. */
export const SAFE_NAME = /[\\/:*?"<>|]/g;

/** Inject a watermark element into an arbitrary html document (for export/PDF of
 *  html-mode documents, whose live watermark lives only in the on-screen iframe). */
export function withWatermark(html: string, wm: Watermark): string {
  if (!wm.on || !wm.text.trim()) return html;
  const div = `<div style="${watermarkCss(wm)}">${escapeHtml(wm.text)}</div>`;
  return html.includes('</body>') ? html.replace('</body>', `${div}</body>`) : html + div;
}

/** Inject a page background colour into an html document (export/print of html-mode
 *  documents). No-op for white. print-color-adjust forces it onto the page. */
export function withPageColor(html: string, color: string): string {
  if (!color || color.toLowerCase() === '#ffffff') return html;
  const style =
    `<style>html,body{background:${color} !important;` +
    `-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>`;
  return html.includes('</head>') ? html.replace('</head>', `${style}</head>`) : style + html;
}

/** Prints via a hidden iframe (browser print → printer / Save as PDF). */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  setTimeout(() => iframe.remove(), 1000);
}

export function downloadFile(name: string, content: string | Uint8Array, mime: string): void {
  const blob = new Blob([content as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** A PrintPreviewData with only the visible columns (for CSV/JSON/clipboard). */
export function filterCols(data: PrintPreviewData, idx: number[]): PrintPreviewData {
  return {
    title: data.title,
    headers: idx.map((i) => data.headers[i]),
    rows: data.rows.map((r) => idx.map((i) => r[i] ?? '')),
    totals: data.totals ? idx.map((i) => data.totals?.[i] ?? '') : undefined,
  };
}

export function buildCsv(data: PrintPreviewData): string {
  const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`;
  const lines = [data.headers, ...data.rows, ...(data.totals?.length ? [data.totals] : [])];
  // BOM so Excel (fr) reads UTF-8 accents.
  return '﻿' + lines.map((r) => r.map(esc).join(',')).join('\r\n');
}

/** One object per row, keyed by header — a clean machine-readable export. */
export function buildJson(data: PrintPreviewData): string {
  const objs = data.rows.map((r) =>
    Object.fromEntries(data.headers.map((h, i) => [h, r[i] ?? ''])),
  );
  return JSON.stringify(objs, null, 2);
}

/** Tab-separated text for the clipboard (pastes straight into a spreadsheet). */
export function buildTsv(data: PrintPreviewData): string {
  const lines = [data.headers, ...data.rows, ...(data.totals?.length ? [data.totals] : [])];
  return lines.map((r) => r.join('\t')).join('\n');
}
