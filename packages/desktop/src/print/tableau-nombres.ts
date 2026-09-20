/**
 * Reading figures back out of an already-formatted table.
 *
 * The document pipeline carries cells as display strings (« 1.200.000 Ar »,
 * « 12,5 »). Print and Word only ever show them, so a string is enough there —
 * but a spreadsheet has to receive *numbers*, or Excel can't sum, sort or pivot
 * what it was given, which is the whole point of exporting to it. Both
 * processes need the same reading, so it lives here.
 */

/** Currency and percent suffixes the app appends to formatted figures. */
const UNITE = /(?:Ar|MGA|%|€|\$)$/;
const CHIFFRES = /^-?[\d.,\s\u00a0]+$/;

/**
 * Which visible columns hold figures, and should therefore be right-aligned on
 * their digits like a financial statement — and written as numbers in a
 * spreadsheet.
 *
 * A column qualifies when every filled cell reads as a number *and* at least one
 * of them carries a separator or a unit (« 1.200.000 Ar », « 12,5 », « 87,5 % »).
 * That second condition is what keeps a matricule or a room number — digits, but
 * not quantities — aligned left where it belongs.
 */
export function colonnesNumeriques(rows: string[][], idx: number[]): Set<number> {
  const numeriques = new Set<number>();
  for (const i of idx) {
    let remplies = 0;
    let quantite = false;
    let toutes = true;
    for (const r of rows) {
      const brut = (r[i] ?? '').trim();
      if (brut === '') continue;
      remplies += 1;
      const sansUnite = brut.replace(UNITE, '').trim();
      if (!/\d/.test(sansUnite) || !CHIFFRES.test(sansUnite)) {
        toutes = false;
        break;
      }
      if (UNITE.test(brut) || /[.,\s\u00a0]/.test(sansUnite)) quantite = true;
    }
    if (toutes && remplies > 0 && quantite) numeriques.add(i);
  }
  return numeriques;
}

/**
 * The number a formatted cell stands for, or `null` when it isn't one.
 *
 * The app formats money in de-DE (« 1.200.000 Ar ») and marks in fr-FR
 * (« 12,5 »), so a dot is sometimes a thousands separator and a comma sometimes
 * a decimal one. The rule: the last separator is the decimal point **unless**
 * exactly three digits follow it, in which case every separator is a thousands
 * grouping. That reads « 1.200 » as 1200 — right for this app, where amounts are
 * whole Ariary — and « 12,5 » as 12.5.
 */
export function lireNombre(cellule: string): number | null {
  const brut = cellule
    .replace(UNITE, '')
    .replace(/[\s\u00a0]/g, '')
    .trim();
  if (brut === '' || !/\d/.test(brut) || !CHIFFRES.test(brut)) return null;
  const dernier = Math.max(brut.lastIndexOf('.'), brut.lastIndexOf(','));
  let normalise: string;
  if (dernier === -1) {
    normalise = brut;
  } else if (brut.length - dernier - 1 === 3) {
    normalise = brut.replace(/[.,]/g, ''); // groupes de milliers
  } else {
    normalise = brut.slice(0, dernier).replace(/[.,]/g, '') + '.' + brut.slice(dernier + 1);
  }
  const n = Number(normalise);
  return Number.isFinite(n) ? n : null;
}

/** Excel number format for a column, guessed from how its cells are written. */
export function formatExcel(valeurs: string[]): string {
  const uneUnite = valeurs.find((v) => UNITE.test(v.trim()));
  const decimales = valeurs.reduce((max, v) => {
    const sans = v
      .replace(UNITE, '')
      .replace(/[\s\u00a0]/g, '')
      .trim();
    const dernier = Math.max(sans.lastIndexOf('.'), sans.lastIndexOf(','));
    const n = dernier === -1 ? 0 : sans.length - dernier - 1;
    return n === 3 ? max : Math.max(max, n); // 3 chiffres = séparateur de milliers
  }, 0);
  const motif = decimales > 0 ? `#,##0.${'0'.repeat(decimales)}` : '#,##0';
  if (!uneUnite) return motif;
  const unite = UNITE.exec(uneUnite.trim())?.[0] ?? '';
  return unite === '%' ? `${motif}" %"` : `${motif}" ${unite}"`;
}
