import { describe, expect, it } from 'vitest';
import {
  MARGE_MIN_MM,
  MARGIN_MM,
  borner,
  margeVerticale,
  margesMm,
  pageMm,
  rowsPerPage,
} from './paper';

describe('print-preview — géométrie de page', () => {
  describe('margesMm', () => {
    it('rend quatre marges égales pour un jeu prédéfini', () => {
      expect(margesMm('normal', { haut: 1, droite: 2, bas: 3, gauche: 4 })).toEqual({
        haut: MARGIN_MM.normal,
        droite: MARGIN_MM.normal,
        bas: MARGIN_MM.normal,
        gauche: MARGIN_MM.normal,
      });
      // Le réglage libre est conservé, pas écrasé, quand on revient dessus
      // (au-dessus du minimum imprimable, que le cas suivant vérifie).
      expect(margesMm('custom', { haut: 5, droite: 7, bas: 9, gauche: 11 })).toEqual({
        haut: 5,
        droite: 7,
        bas: 9,
        gauche: 11,
      });
    });

    it('borne chaque côté au domaine imprimable', () => {
      const m = margesMm('custom', { haut: 0, droite: -5, bas: 999, gauche: 8 });
      expect(m.haut).toBe(MARGE_MIN_MM); // une marge nulle tronque à l'impression
      expect(m.droite).toBe(MARGE_MIN_MM);
      expect(m.bas).toBe(100);
      expect(m.gauche).toBe(8);
    });
  });

  describe('borner', () => {
    it('arrondit au dixième de millimètre', () => {
      // Le glissement produit des flottants ; la cote affichée doit rester lisible.
      expect(borner(12.34)).toBe(12.3);
      expect(borner(12.36)).toBe(12.4);
    });

    it('accepte un plafond propre au côté tiré', () => {
      expect(borner(80, 40)).toBe(40);
    });

    it('retombe sur le minimum devant une valeur absurde', () => {
      expect(borner(Number.NaN)).toBe(MARGE_MIN_MM);
      expect(borner(Number.POSITIVE_INFINITY)).toBe(MARGE_MIN_MM);
    });
  });

  it('prend la moyenne verticale pour les estimations de pagination', () => {
    expect(margeVerticale('custom', { haut: 10, droite: 30, bas: 20, gauche: 30 })).toBe(15);
  });

  it('échange largeur et hauteur en paysage', () => {
    expect(pageMm('A4', 'portrait')).toEqual({ w: 210, h: 297 });
    expect(pageMm('A4', 'landscape')).toEqual({ w: 297, h: 210 });
  });

  it('tient moins de lignes quand la marge grandit', () => {
    const serre = rowsPerPage('A4', 'portrait', 6);
    const large = rowsPerPage('A4', 'portrait', 20);
    expect(serre).toBeGreaterThan(large);
    expect(large).toBeGreaterThanOrEqual(5); // jamais moins d'une poignée de lignes
  });
});
