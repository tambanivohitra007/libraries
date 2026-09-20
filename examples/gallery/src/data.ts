/** Sample rows shared by the grid demos. Deliberately small and readable — a
 *  demo that needs 10 000 rows to look impressive is hiding something. */
export interface Eleve {
  id: number;
  nom: string;
  classe: string;
  sexe: 'F' | 'M';
  statut: 'Inscrit' | 'En attente' | 'Sorti';
  solde: number;
}

export const eleves: Eleve[] = [
  { id: 1, nom: 'Rakotoarisoa Hery', classe: '6e A', sexe: 'M', statut: 'Inscrit', solde: 0 },
  { id: 2, nom: 'Razafindrabe Soa', classe: '6e A', sexe: 'F', statut: 'Inscrit', solde: 120_000 },
  { id: 3, nom: 'Andriamanana Lova', classe: '6e A', sexe: 'F', statut: 'En attente', solde: 45_000 },
  { id: 4, nom: 'Rasoanaivo Mirana', classe: '6e B', sexe: 'F', statut: 'Inscrit', solde: 0 },
  { id: 5, nom: 'Randrianarisoa Tiana', classe: '6e B', sexe: 'M', statut: 'Inscrit', solde: 300_000 },
  { id: 6, nom: 'Ravelojaona Fy', classe: '6e B', sexe: 'M', statut: 'Sorti', solde: 15_000 },
  { id: 7, nom: 'Rakotomalala Aina', classe: '5e A', sexe: 'F', statut: 'Inscrit', solde: 0 },
  { id: 8, nom: 'Andrianjafy Ny Aina', classe: '5e A', sexe: 'M', statut: 'Inscrit', solde: 80_000 },
  { id: 9, nom: 'Rabemananjara Koto', classe: '5e A', sexe: 'M', statut: 'En attente', solde: 220_000 },
  { id: 10, nom: 'Raharimalala Vola', classe: '5e B', sexe: 'F', statut: 'Inscrit', solde: 0 },
  { id: 11, nom: 'Ramanantsoa Fanja', classe: '5e B', sexe: 'F', statut: 'Inscrit', solde: 60_000 },
  { id: 12, nom: 'Rakotonirina Faly', classe: '5e B', sexe: 'M', statut: 'Sorti', solde: 5_000 },
];

export const ariary = (n: number): string => `${n.toLocaleString('fr-FR')} Ar`;
