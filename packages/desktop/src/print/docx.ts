/**
 * Word export — a real `.docx` (Office Open XML), not HTML wearing a Word MIME
 * type.
 *
 * The old export shipped the print HTML as `.doc`: Word sniffs it and opens it,
 * but the file is not a Word document — LibreOffice, Google Docs and Word's own
 * newer paths treat it with suspicion, and it can't be renamed `.docx` because
 * that extension promises a ZIP package. So we build the package: a small OOXML
 * document with a real Word table, which opens and stays editable everywhere.
 *
 * No new dependency: a `.docx` is a ZIP of XML parts, and {@link zipStore}
 * writes one with stored (uncompressed) entries — a hundred lines, deterministic
 * and testable, against megabytes of library.
 *
 * Module interne de `print-preview`, sans React ni DOM.
 */
import {
  escapeHtml,
  toEnteteEtab,
  type DocOptions,
  type PrintPreviewData,
} from './document';
import { colonnesNumeriques } from './tableau-nombres';
import { PAPER_MM } from './paper';

/** MIME type of the produced file (what the download must be labelled with). */
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ── ZIP (stored entries) ─────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/**
 * Minimal ZIP writer, stored (method 0) — no compression, so no deflate
 * dependency. Timestamps are fixed, which makes the same document produce the
 * same bytes twice: handy for tests, and harmless for Word.
 */
export function zipStore(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number): number[] => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number): number[] => [
    v & 0xff,
    (v >>> 8) & 0xff,
    (v >>> 16) & 0xff,
    (v >>> 24) & 0xff,
  ];

  for (const e of entries) {
    const nom = enc.encode(e.name);
    const crc = crc32(e.data);
    // Flag bit 11 = names and comments are UTF-8.
    const commun = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0)];
    const tailles = [...u32(crc), ...u32(e.data.length), ...u32(e.data.length)];
    const local = new Uint8Array([
      ...u32(0x04034b50),
      ...commun,
      ...tailles,
      ...u16(nom.length),
      ...u16(0),
      ...nom,
    ]);
    chunks.push(local, e.data);
    central.push(
      new Uint8Array([
        ...u32(0x02014b50),
        ...u16(20),
        ...commun,
        ...tailles,
        ...u16(nom.length),
        ...u16(0), // extra
        ...u16(0), // comment
        ...u16(0), // disk
        ...u16(0), // internal attrs
        ...u32(0), // external attrs
        ...u32(offset),
        ...nom,
      ]),
    );
    offset += local.length + e.data.length;
  }

  const annuaire = concat(central);
  const eocd = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(annuaire.length),
    ...u32(offset),
    ...u16(0),
  ]);
  return concat([...chunks, annuaire, eocd]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

// ── WordprocessingML ─────────────────────────────────────────────────────────

/** 1 inch = 1440 twips = 25.4 mm. Word measures pages and tables in twips. */
const TWIPS_PAR_MM = 1440 / 25.4;
const tw = (mm: number): number => Math.round(mm * TWIPS_PAR_MM);

/** Palette du style « moderne », alignée sur `styleTableauCss()`. */
const ARDOISE = '17263D';
const ARDOISE_CLAIR = '46566E';
const FILET = '5B6B84';
const BANDE = 'EEF2F7';
const ZEBRE = 'F7F9FC';

const esc = escapeHtml;

/** Un passage de texte (`<w:r>`), avec ses attributs de police. */
function run(
  texte: string,
  style: { gras?: boolean; taille?: number; couleur?: string } = {},
): string {
  const props =
    (style.gras ? '<w:b/>' : '') +
    (style.taille ? `<w:sz w:val="${style.taille}"/><w:szCs w:val="${style.taille}"/>` : '') +
    (style.couleur ? `<w:color w:val="${style.couleur}"/>` : '');
  return (
    `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}` +
    `<w:t xml:space="preserve">${esc(texte)}</w:t></w:r>`
  );
}

interface StyleParagraphe {
  gras?: boolean;
  /** Demi-points (Word) : 18 pt → 36. */
  taille?: number;
  couleur?: string;
  align?: 'left' | 'center' | 'right';
  /** Espace après, en twips. */
  apres?: number;
}

function paragraphe(texte: string, style: StyleParagraphe = {}): string {
  const pPr =
    `<w:pPr>` +
    (style.align && style.align !== 'left' ? `<w:jc w:val="${style.align}"/>` : '') +
    `<w:spacing w:after="${style.apres ?? 0}" w:line="240" w:lineRule="auto"/>` +
    `</w:pPr>`;
  return `<w:p>${pPr}${texte ? run(texte, style) : ''}</w:p>`;
}

/** Une cellule : ombrage, filets et alignement décidés par le style du tableau. */
function cellule(
  texte: string,
  o: {
    largeur: number;
    droite: boolean;
    gras?: boolean;
    fond?: string;
    couleur?: string;
    bordures?: string;
  },
): string {
  const tcPr =
    `<w:tcPr><w:tcW w:w="${o.largeur}" w:type="dxa"/>` +
    (o.fond ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fond}"/>` : '') +
    (o.bordures ? `<w:tcBorders>${o.bordures}</w:tcBorders>` : '') +
    `<w:vAlign w:val="center"/></w:tcPr>`;
  const p = paragraphe(texte, {
    gras: o.gras,
    taille: 18,
    couleur: o.couleur,
    align: o.droite ? 'right' : 'left',
  });
  return `<w:tc>${tcPr}${p}</w:tc>`;
}

const filet = (cote: string, epaisseur: number, couleur: string): string =>
  `<w:${cote} w:val="single" w:sz="${epaisseur}" w:space="0" w:color="${couleur}"/>`;

const AUCUN_FILET = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
  .map((c) => `<w:${c} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`)
  .join('');

const FILETS_QUADRILLE = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
  .map((c) => filet(c, 4, 'BBBBBB'))
  .join('');

/**
 * Build the `.docx` bytes for a table document. Carries what a Word file can
 * carry and a user would expect to edit: the letterhead's text lines, the title
 * and its date, the table (styled like the printed one, figures right-aligned),
 * the signature block and the footer note — plus the real page geometry, so
 * printing from Word gives the same paper.
 *
 * The letterhead **logo** is not embedded: an image means a media part and a
 * DrawingML frame sized from the file's own header, which is a lot of machinery
 * for a decoration. The identity lines are there.
 */
export function buildListeDocx(data: PrintPreviewData, o: DocOptions): Uint8Array {
  const idx = o.visibleIdx;
  const moderne = o.tableStyle === 'moderne';
  const num = moderne
    ? colonnesNumeriques([...data.rows, ...(data.totals ? [data.totals] : [])], idx)
    : new Set<number>();

  const [pw, ph] = PAPER_MM[o.paper];
  const page = o.orientation === 'portrait' ? { w: pw, h: ph } : { w: ph, h: pw };
  const m =
    typeof o.marginMm === 'number'
      ? { haut: o.marginMm, droite: o.marginMm, bas: o.marginMm, gauche: o.marginMm }
      : o.marginMm;
  const largeurUtile = tw(page.w - m.gauche - m.droite);
  const colW = Math.floor(largeurUtile / Math.max(1, idx.length));

  // ── Corps ──
  const blocs: string[] = [];

  if (o.letterhead) {
    const e = toEnteteEtab(o.etab);
    const contact = [e.bp ? `BP ${e.bp}` : '', e.adresse, e.ville, e.telephone]
      .filter(Boolean)
      .join(' · ');
    if (e.ministere) blocs.push(paragraphe(e.ministere, { align: 'center', taille: 16 }));
    if (e.nom) blocs.push(paragraphe(e.nom, { align: 'center', taille: 26, gras: true }));
    if (contact) blocs.push(paragraphe(contact, { align: 'center', taille: 15, apres: 160 }));
  }

  blocs.push(
    paragraphe(data.title, {
      taille: moderne ? 36 : 28,
      gras: !moderne,
      couleur: moderne ? ARDOISE : undefined,
      align: moderne ? 'left' : 'center',
    }),
    paragraphe(o.today, {
      taille: 16,
      couleur: '6B7C96',
      align: moderne ? 'left' : 'center',
      apres: 160,
    }),
  );

  // ── Tableau ──
  const grille = idx.map(() => `<w:gridCol w:w="${colW}"/>`).join('');
  const bordureEntete = moderne ? filet('bottom', 12, FILET) : '';
  const enTete =
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>` +
    idx
      .map((i) =>
        cellule(data.headers[i] ?? '', {
          largeur: colW,
          droite: num.has(i),
          gras: true,
          fond: moderne ? BANDE : 'EEEEEE',
          couleur: moderne ? ARDOISE : undefined,
          bordures: bordureEntete,
        }),
      )
      .join('') +
    `</w:tr>`;

  const lignes = data.rows
    .map((r, ri) => {
      const fond = moderne && ri % 2 === 1 ? ZEBRE : undefined;
      return (
        `<w:tr>` +
        idx
          .map((i) =>
            cellule(r[i] ?? '', {
              largeur: colW,
              droite: num.has(i),
              fond,
              couleur: moderne ? ARDOISE_CLAIR : undefined,
            }),
          )
          .join('') +
        `</w:tr>`
      );
    })
    .join('');

  const totaux =
    data.totals && data.totals.length
      ? `<w:tr>` +
        idx
          .map((i) =>
            cellule(data.totals?.[i] ?? '', {
              largeur: colW,
              droite: num.has(i),
              gras: true,
              couleur: moderne ? ARDOISE : undefined,
              fond: moderne ? undefined : 'F3F3F3',
              bordures: moderne ? filet('top', 6, FILET) + filet('bottom', 12, ARDOISE) : '',
            }),
          )
          .join('') +
        `</w:tr>`
      : '';

  blocs.push(
    `<w:tbl><w:tblPr><w:tblW w:w="${largeurUtile}" w:type="dxa"/>` +
      `<w:tblBorders>${moderne ? AUCUN_FILET : FILETS_QUADRILLE}</w:tblBorders>` +
      `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>` +
      `<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>` +
      `</w:tblPr><w:tblGrid>${grille}</w:tblGrid>${enTete}${lignes}${totaux}</w:tbl>`,
    // Word needs a paragraph after a table, otherwise the next block glues to it.
    paragraphe('', { apres: 160 }),
  );

  if (o.signature) {
    blocs.push(
      paragraphe(o.faitA, { align: 'right', taille: 18, apres: 480 }),
      paragraphe(o.sigLabel, { align: 'right', taille: 18, gras: true }),
      paragraphe(o.etab?.proviseur ?? '', { align: 'right', taille: 18, apres: 160 }),
    );
  }
  const pied = [o.printedBy, o.footerNote].filter((z) => z.trim() !== '');
  for (const z of pied) blocs.push(paragraphe(z, { taille: 15, couleur: '767676' }));

  const sectPr =
    `<w:sectPr><w:pgSz w:w="${tw(page.w)}" w:h="${tw(page.h)}"` +
    (o.orientation === 'landscape' ? ' w:orient="landscape"' : '') +
    `/><w:pgMar w:top="${tw(m.haut)}" w:right="${tw(m.droite)}" w:bottom="${tw(m.bas)}"` +
    ` w:left="${tw(m.gauche)}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${blocs.join('')}${sectPr}</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`;

  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:title>${esc(data.title)}</dc:title>` +
    `<dc:creator>${esc(o.etab?.nom ?? '')}</dc:creator>` +
    `</cp:coreProperties>`;

  const enc = new TextEncoder();
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'docProps/core.xml', data: enc.encode(core) },
    { name: 'word/document.xml', data: enc.encode(document) },
  ]);
}
