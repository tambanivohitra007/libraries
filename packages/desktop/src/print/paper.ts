import type { Orientation, Paper } from './document';

/**
 * Géométrie de page : formats, marges, conversions.
 *
 * Module interne de `print-preview`, sans dépendance à React ni à
 * l'application — c'est ici que vit tout le calcul millimétrique.
 */

export type { Orientation, Paper };

/** Jeu de marges retenu. `custom` ouvre les quatre côtés au réglage libre. */
export type Margin = 'normal' | 'narrow' | 'wide' | 'custom';

/** Marges en millimètres, côté par côté (ordre CSS : haut, droite, bas, gauche). */
export interface Marges {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

/** Un millimètre en pixels CSS : Chromium rend le mm à ~96 dpi. */
export const MM_TO_PX = 96 / 25.4;

/** Paper dimensions in mm, portrait [width, height]. */
export const PAPER_MM: Record<Paper, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

export const PAPER_LABEL: Record<Paper, string> = {
  A4: 'A4',
  A5: 'A5',
  letter: 'Letter',
  legal: 'Legal',
};

/** Marge uniforme des jeux prédéfinis, en mm. */
export const MARGIN_MM: Record<Exclude<Margin, 'custom'>, number> = {
  normal: 12,
  narrow: 6,
  wide: 20,
};

/** Marges par défaut du réglage libre — celles du jeu « normal ». */
export const MARGES_DEFAUT: Marges = {
  haut: MARGIN_MM.normal,
  droite: MARGIN_MM.normal,
  bas: MARGIN_MM.normal,
  gauche: MARGIN_MM.normal,
};

/** Aucune marge ne descend sous ce seuil : les imprimantes de bureau ne savent
 *  pas imprimer jusqu'au bord, et une marge nulle produit un document tronqué. */
export const MARGE_MIN_MM = 3;

/**
 * Les quatre marges retenues, en mm. Un jeu prédéfini les rend égales ; `custom`
 * rend celles que l'utilisateur a posées (au clavier ou en tirant les guides).
 */
export function margesMm(m: Margin, custom: Marges): Marges {
  if (m !== 'custom') {
    const v = MARGIN_MM[m];
    return { haut: v, droite: v, bas: v, gauche: v };
  }
  return {
    haut: borner(custom.haut),
    droite: borner(custom.droite),
    bas: borner(custom.bas),
    gauche: borner(custom.gauche),
  };
}

/** Marge unique représentative — pour les estimations qui n'en veulent qu'une
 *  (nombre de lignes par page) ; les deux marges verticales font foi. */
export function margeVerticale(m: Margin, custom: Marges): number {
  const { haut, bas } = margesMm(m, custom);
  return (haut + bas) / 2;
}

/** Contraint une marge au domaine imprimable, en mm entiers au dixième près. */
export function borner(mm: number, maxMm = 100): number {
  if (!Number.isFinite(mm)) return MARGE_MIN_MM;
  return Math.min(maxMm, Math.max(MARGE_MIN_MM, Math.round(mm * 10) / 10));
}

/** Page dimensions in mm for the current paper + orientation. */
export function pageMm(paper: Paper, orientation: Orientation): { w: number; h: number } {
  const [pw, ph] = PAPER_MM[paper];
  return orientation === 'portrait' ? { w: pw, h: ph } : { w: ph, h: pw };
}

/** Rough body-rows-per-page estimate (the browser does the real pagination). */
export function rowsPerPage(paper: Paper, orientation: Orientation, mm: number, scale = 1): number {
  const { h } = pageMm(paper, orientation);
  const usable = h - 2 * mm - 40; // header band + title + footer + signature
  // A scaled document fits proportionally more (or fewer) rows on a page.
  return Math.max(5, Math.floor(usable / (7 * scale))); // ~7mm per row at 100 %
}
