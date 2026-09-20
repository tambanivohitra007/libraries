import { describe, expect, it } from 'vitest';
import { enteteParDefaut } from './entete-config';
import { BANDS_VIDES, type DocOptions, type PrintPreviewData } from './document';
import { DOCX_MIME, buildListeDocx, crc32, zipStore } from './docx';

/**
 * A `.docx` is only worth shipping if it is a real package: the tests below read
 * the produced bytes back the way a ZIP reader would (central directory, entry
 * names, CRC of each part) rather than trusting the writer that made them.
 */

const opts = (over: Partial<DocOptions> = {}): DocOptions => ({
  etab: { nom: 'EPP Analamahitsy', ville: 'Antananarivo', proviseur: 'RAKOTO Jean' },
  logo: '',
  republique: '',
  orientation: 'portrait',
  paper: 'A4',
  marginMm: 12,
  pageColor: '#ffffff',
  watermark: { on: false, text: '', opacity: 0.1, diagonal: true },
  letterhead: true,
  signature: false,
  sigLabel: 'Le Directeur',
  faitA: 'Fait à Antananarivo, le 20/07/2026',
  footerNote: '',
  printedBy: '',
  scale: 1,
  bands: BANDS_VIDES,
  bandsCtx: {
    date: '20/07/2026',
    heure: '08:30',
    utilisateur: 'RAKOTO',
    titre: 'Liste des élèves',
  },
  today: '20/07/2026',
  visibleIdx: [0, 1, 2],
  code: () => '',
  entete: enteteParDefaut(),
  tableStyle: 'moderne',
  ...over,
});

const data: PrintPreviewData = {
  title: 'Liste des élèves',
  headers: ['Matricule', 'Nom', 'Scolarité'],
  rows: [
    ['2024001', 'RAKOTO <Jean> & fils', '1.200.000 Ar'],
    ['2024002', 'RABE', '850.000 Ar'],
  ],
  totals: ['', 'Total', '2.050.000 Ar'],
};

/** Minimal ZIP reader: walks the central directory the way Word would. */
function lireZip(bytes: Uint8Array): { name: string; data: Uint8Array; crcOk: boolean }[] {
  const vue = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: fixed 22 bytes here (no archive comment).
  const eocd = bytes.length - 22;
  expect(vue.getUint32(eocd, true)).toBe(0x06054b50);
  const nb = vue.getUint16(eocd + 10, true);
  let p = vue.getUint32(eocd + 16, true);
  const sortie: { name: string; data: Uint8Array; crcOk: boolean }[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < nb; i++) {
    expect(vue.getUint32(p, true)).toBe(0x02014b50);
    const crc = vue.getUint32(p + 16, true);
    const taille = vue.getUint32(p + 24, true);
    const nomLen = vue.getUint16(p + 28, true);
    const extraLen = vue.getUint16(p + 30, true);
    const commentLen = vue.getUint16(p + 32, true);
    const offset = vue.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nomLen));
    // Local header → data.
    expect(vue.getUint32(offset, true)).toBe(0x04034b50);
    const localNom = vue.getUint16(offset + 26, true);
    const localExtra = vue.getUint16(offset + 28, true);
    const debut = offset + 30 + localNom + localExtra;
    const contenu = bytes.subarray(debut, debut + taille);
    sortie.push({ name, data: contenu, crcOk: crc32(contenu) === crc });
    p += 46 + nomLen + extraLen + commentLen;
  }
  return sortie;
}

const texteDe = (entries: ReturnType<typeof lireZip>, nom: string): string => {
  const e = entries.find((x) => x.name === nom);
  expect(e, nom).toBeDefined();
  return new TextDecoder().decode(e?.data);
};

describe('zip', () => {
  it('computes the CRC-32 of the reference string', () => {
    // Valeur canonique de « 123456789 » — le vecteur de test habituel du CRC-32.
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips entries through a reader that walks the central directory', () => {
    const enc = new TextEncoder();
    const zip = zipStore([
      { name: 'a.txt', data: enc.encode('bonjour') },
      { name: 'dossier/b.xml', data: enc.encode('<x/>') },
    ]);
    const lu = lireZip(zip);
    expect(lu.map((e) => e.name)).toEqual(['a.txt', 'dossier/b.xml']);
    expect(lu.every((e) => e.crcOk)).toBe(true);
    expect(new TextDecoder().decode(lu[0].data)).toBe('bonjour');
  });

  it('is deterministic — the same document twice gives the same bytes', () => {
    expect(buildListeDocx(data, opts())).toEqual(buildListeDocx(data, opts()));
  });
});

describe('docx', () => {
  it('is a package Word can open: the four required parts, each with a valid CRC', () => {
    const entries = lireZip(buildListeDocx(data, opts()));
    expect(entries.map((e) => e.name).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'word/document.xml',
    ]);
    expect(entries.every((e) => e.crcOk)).toBe(true);
    // Le point d'entrée déclaré doit être celui qu'on a écrit.
    expect(texteDe(entries, '_rels/.rels')).toContain('Target="word/document.xml"');
    expect(texteDe(entries, '[Content_Types].xml')).toContain('wordprocessingml.document.main+xml');
    expect(DOCX_MIME).toContain('wordprocessingml.document');
  });

  it('carries the title, the headers and every row, XML-escaped', () => {
    const doc = texteDe(lireZip(buildListeDocx(data, opts())), 'word/document.xml');
    expect(doc).toContain('Liste des élèves');
    expect(doc).toContain('Matricule');
    expect(doc).toContain('RAKOTO &lt;Jean&gt; &amp; fils'); // pas de XML injecté
    expect(doc).not.toContain('<Jean>');
    expect(doc).toContain('2.050.000 Ar'); // ligne de total
    expect((doc.match(/<w:tr>/g) ?? []).length).toBe(4); // en-tête + 2 lignes + total
  });

  it('respects the hidden columns', () => {
    const doc = texteDe(
      lireZip(buildListeDocx(data, opts({ visibleIdx: [1] }))),
      'word/document.xml',
    );
    expect(doc).toContain('Nom');
    expect(doc).not.toContain('Matricule');
    expect(doc).not.toContain('2024001');
  });

  it('right-aligns the figure columns, like the printed document', () => {
    const doc = texteDe(lireZip(buildListeDocx(data, opts())), 'word/document.xml');
    // « Scolarité » est une quantité, « Matricule » non : un seul alignement à droite par ligne.
    const lignes = doc.split('<w:tr>');
    const ligneRakoto = lignes.find((l) => l.includes('2024001')) ?? '';
    expect((ligneRakoto.match(/<w:jc w:val="right"\/>/g) ?? []).length).toBe(1);
  });

  it('sets the real page geometry, portrait and landscape', () => {
    const a4 = texteDe(lireZip(buildListeDocx(data, opts())), 'word/document.xml');
    expect(a4).toContain('<w:pgSz w:w="11906" w:h="16838"/>'); // A4 en twips
    expect(a4).toContain('w:top="680"'); // 12 mm

    const paysage = texteDe(
      lireZip(buildListeDocx(data, opts({ orientation: 'landscape' }))),
      'word/document.xml',
    );
    expect(paysage).toContain('w:w="16838" w:h="11906" w:orient="landscape"');
  });

  it('follows the chosen table style', () => {
    const moderne = texteDe(lireZip(buildListeDocx(data, opts())), 'word/document.xml');
    expect(moderne).toContain('w:fill="EEF2F7"'); // bande d'en-tête ardoise
    expect(moderne).toContain('w:fill="F7F9FC"'); // zébrure

    const quadrille = texteDe(
      lireZip(buildListeDocx(data, opts({ tableStyle: 'quadrille' }))),
      'word/document.xml',
    );
    expect(quadrille).toContain('w:fill="EEEEEE"');
    expect(quadrille).toContain('w:color="BBBBBB"'); // quadrillage
    expect(quadrille).not.toContain('w:fill="F7F9FC"');
  });

  it('includes the letterhead lines and the signature only when asked', () => {
    const sans = texteDe(
      lireZip(buildListeDocx(data, opts({ letterhead: false, signature: false }))),
      'word/document.xml',
    );
    expect(sans).not.toContain('EPP Analamahitsy');
    expect(sans).not.toContain('Le Directeur');

    const avec = texteDe(
      lireZip(buildListeDocx(data, opts({ letterhead: true, signature: true }))),
      'word/document.xml',
    );
    expect(avec).toContain('EPP Analamahitsy');
    expect(avec).toContain('Le Directeur');
    expect(avec).toContain('RAKOTO Jean');
  });
});
