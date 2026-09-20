/**
 * La bande d'en-tête d'un groupe : jusqu'où elle s'étend.
 *
 * Module à part, sans React ni antd, pour que la règle se teste — importer
 * `DataTable` fait remonter `format.ts`, qui lit `localStorage` au chargement.
 * Même mouvement que `shell/recherche-actions.ts` et `shell/ribbon-onglets.ts`.
 */

import type { DataColumn } from './DataTable';

/**
 * Combien de colonnes la bande d'en-tête d'un groupe couvre : tout jusqu'à la
 * première qui agrège, sinon la largeur entière.
 *
 * Une colonne qui agrège affiche le total du groupe — c'est le sujet même de la
 * ligne, elle garde donc sa cellule. Au moins une colonne dans tous les cas :
 * une première colonne agrégeante ne doit pas réduire la bande à rien.
 */
export function porteeBandeGroupe<T>(colonnes: readonly DataColumn<T>[]): number {
  const premierAgrege = colonnes.findIndex((c) => typeof c.aggregate === 'function');
  return premierAgrege === -1 ? colonnes.length : Math.max(1, premierAgrege);
}
