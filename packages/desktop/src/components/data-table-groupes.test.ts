import { describe, expect, it } from 'vitest';
import { porteeBandeGroupe } from './data-table-groupes';
import type { DataColumn } from './DataTable';

/**
 * La bande d'en-tête d'un groupe couvrait une seule colonne — la première des
 * données — et en héritait la largeur : 56 px sur une colonne photo, où le nom
 * du groupe se réduisait à trois lettres. Elle s'étend maintenant jusqu'à la
 * première colonne qui agrège, celles-là gardant leur cellule pour y afficher
 * leur total.
 *
 * C'est cette règle-là qui se teste ; le reste (couleur, chevron, indentation)
 * est du rendu, que ce dépôt ne sait pas exercer.
 */
const col = (key: string, agrege = false): DataColumn<{ x: number }> =>
  ({
    key,
    title: key,
    ...(agrege ? { aggregate: () => '42' } : {}),
  }) as DataColumn<{ x: number }>;

describe('portée de la bande de groupe', () => {
  it('couvre toute la largeur quand aucune colonne n’agrège', () => {
    expect(porteeBandeGroupe([col('photo'), col('nom'), col('classe')])).toBe(3);
  });

  it('s’arrête avant la première colonne qui agrège', () => {
    const cols = [col('photo'), col('nom'), col('total', true), col('reste', true)];
    expect(porteeBandeGroupe(cols)).toBe(2);
  });

  it('garde au moins une colonne, même si la première agrège', () => {
    // Sinon la bande n'aurait plus de cellule où se poser.
    expect(porteeBandeGroupe([col('total', true), col('nom')])).toBe(1);
  });

  it('vaut zéro colonne sur une grille vide, sans planter', () => {
    expect(porteeBandeGroupe([])).toBe(0);
  });
});
