/**
 * Built-in labels for {@link DocumentPreview}, so the component is usable with
 * **no i18n framework at all**. Keys mirror the `print.preview.*` namespace and
 * use `{{var}}` placeholders (i18next-compatible). A host app can override any
 * subset via the component's `messages` prop — e.g. wired to react-i18next so a
 * single locale file stays authoritative (see `usePreviewMessages`).
 */

export type PreviewMessages = Record<string, string>;

export const defaultPreviewMessages: PreviewMessages = {
  'print.preview.title': 'Aperçu avant impression',
  'print.preview.groups.document': 'Document',
  'print.preview.groups.impression': 'Impression',
  'print.preview.groups.pageSetup': 'Mise en page',
  'print.preview.groups.navigation': 'Navigation',
  'print.preview.groups.zoom': 'Zoom',
  'print.preview.groups.background': 'Arrière-plan',
  'print.preview.groups.export': 'Export',
  'print.preview.groups.view': 'Affichage',
  'print.preview.groups.help': 'Aide',
  'print.preview.groups.close': 'Fermer',
  'print.preview.shortcuts': 'Raccourcis clavier',
  'print.preview.orientation': 'Orientation',
  'print.preview.minimize': 'Réduire',
  'print.preview.thumbnails': 'Miniatures',
  'print.preview.quickPrint': 'Impression rapide',
  'print.preview.quickPrintOk': "Document envoyé à l'imprimante.",
  'print.preview.quickPrintFail': "Échec de l'impression rapide.",
  'print.preview.word': 'Document Word',
  'print.preview.marginCustom': 'Personnalisées',
  'print.preview.pageColor': 'Couleur de page',
  'print.preview.cols2': '2 colonnes',
  'print.preview.cols3': '3 colonnes',
  'print.preview.firstPage': 'Première page',
  'print.preview.lastPage': 'Dernière page',
  'print.preview.close': 'Fermer',
  'print.preview.zoomIn': 'Agrandir',
  'print.preview.zoomOut': 'Réduire',
  'print.preview.fitWidth': 'Ajuster à la largeur',
  'print.preview.fitPage': 'Ajuster à la page',
  'print.preview.marginNormal': 'Marges normales',
  'print.preview.marginNarrow': 'Marges étroites',
  'print.preview.marginWide': 'Marges larges',
  'print.preview.portrait': 'Portrait',
  'print.preview.landscape': 'Paysage',
  'print.preview.singlePage': 'Une page',
  'print.preview.multiPage': 'Plusieurs pages',
  'print.preview.find': 'Rechercher dans le document',
  'print.preview.findPrev': 'Résultat précédent',
  'print.preview.findNext': 'Résultat suivant',
  'print.preview.watermark': 'Filigrane',
  'print.preview.watermarkOn': 'Afficher le filigrane',
  'print.preview.watermarkText': 'Texte du filigrane',
  'print.preview.watermarkOpacity': 'Opacité',
  'print.preview.watermarkDiagonal': 'En diagonale',
  'print.preview.docOptions': 'Options du document',
  'print.preview.letterhead': 'En-tête officiel',
  'print.preview.styleTableau': 'Style du tableau',
  'print.preview.styleModerne': 'Moderne',
  'print.preview.styleQuadrille': 'Quadrillé',
  'print.preview.signature': 'Bloc de signature',
  'print.preview.signatureDefault': 'Le Directeur',
  'print.preview.footerNote': 'Note de bas de page',
  'print.preview.footerNotePh': 'Texte affiché en bas de chaque page (facultatif)',
  'print.preview.codeType': 'Type de code',
  'print.preview.codeCode39': 'Code-barres',
  'print.preview.codeQr': 'QR',
  'print.preview.columns': 'Colonnes',
  'print.preview.columnsAll': 'Tout afficher',
  'print.preview.maximize': 'Agrandir la fenêtre',
  'print.preview.restore': 'Réduire la fenêtre',
  'print.preview.pages': 'Volet des pages',
  'print.preview.pdf': 'Document PDF',
  'print.preview.pdfSaved': 'PDF enregistré : {{path}}',
  'print.preview.openFile': 'Ouvrir',
  'print.preview.revealFile': 'Afficher dans le dossier',
  'print.preview.openFileFailed': "Impossible d'ouvrir le fichier.",
  'print.preview.pdfError': "Échec de l'export PDF.",
  'print.preview.printedBy': 'Imprimé par {{user}} le {{date}}',
  'print.preview.faitA': 'Fait à {{ville}}, le {{date}}',
  'print.preview.faitALe': 'Le {{date}}',
  'print.preview.exportMenu': 'Exporter',
  'print.preview.exportXlsx': 'Classeur Excel (mise en page)',
  'print.preview.export': 'Tableur (CSV)',
  'print.preview.save': 'Page web (HTML)',
  'print.preview.exportJson': 'Données (JSON)',
  'print.preview.copyTable': 'Copier le tableau',
  'print.preview.copied': 'Tableau copié dans le presse-papiers.',
  'print.preview.copyFailed': 'Impossible de copier le tableau.',
  'print.preview.saved': 'Document enregistré.',
  'print.preview.print': 'Imprimer',
  'print.preview.prevPage': 'Page précédente',
  'print.preview.nextPage': 'Page suivante',
  'print.preview.loading': "Préparation de l'aperçu…",
  'print.preview.empty': 'Rien à afficher.',
  'print.preview.page': 'Page {{n}} / {{total}}',
  'print.preview.status.pages': '{{n}} page(s)',
  'print.preview.status.rows': '{{n}} ligne(s)',
  'print.preview.zoomPresets': 'Niveau de zoom',
  'print.preview.zoomWhole': 'Page entière',
  'print.preview.zoomWidth': 'Largeur de page',
  'print.preview.zoomTwoPages': 'Deux pages',
  'print.preview.pagesPerRow': '{{n}} page(s) par ligne',
  'print.preview.bands': 'En-tête / pied',
  'print.preview.bandsTitle': 'En-tête et pied de page',
  'print.preview.bandsHint':
    'Texte libre et jetons, insérés dans les trois zones de chaque bande. Une zone laissée vide garde la valeur par défaut du document.',
  'print.preview.bandsReset': 'Réinitialiser',
  'print.preview.bandsPreview': 'Aperçu du pied de page',
  'print.preview.bandHeader': 'En-tête de page',
  'print.preview.bandFooter': 'Pied de page',
  'print.preview.bandLeft': 'Gauche',
  'print.preview.bandCenter': 'Centre',
  'print.preview.bandRight': 'Droite',
  'print.preview.pageSetup': 'Mise en page',
  // Marges côté par côté + invite du réglage au glissement.
  'print.preview.marge.haut': 'Haut',
  'print.preview.marge.droite': 'Droite',
  'print.preview.marge.bas': 'Bas',
  'print.preview.marge.gauche': 'Gauche',
  'print.preview.margeGlisser': 'Tirez les guides pour ajuster les marges',
  // Quick access toolbar (the commands pinned to the title bar).
  'print.preview.qat.customize': "Personnaliser la barre d'accès rapide",
  'print.preview.qat.reset': 'Rétablir la barre par défaut',
  'print.preview.paper': 'Format du papier',
  'print.preview.margins': 'Marges',
  'print.preview.scale': 'Échelle',
  'print.preview.scaleHint':
    "L'échelle réduit ou agrandit le document sur la feuille : à 80 %, il tient plus de lignes par page.",
  'print.preview.textSize': 'Texte',
  'print.preview.searchTab': 'Recherche',
  'print.preview.matchCase': 'Respecter la casse',
  'print.preview.hits': '{{n}} résultat(s)',
  'print.preview.pdfOptions': 'Options du PDF',
  'print.preview.printOptions': "Options d'impression",
  'print.preview.range': 'Étendue',
  'print.preview.rangeAll': 'Toutes les pages',
  'print.preview.rangeCurrent': 'Page courante ({{n}})',
  'print.preview.rangeCustom': 'Pages',
  'print.preview.rangePh': 'ex. 1-3,7',
  'print.preview.copies': 'Copies',
  'print.preview.rangeHintPdf': "L'étendue s'applique aux pages produites par le PDF.",
  'print.preview.rangeHintPrint':
    "L'impression rapide part directement sur l'imprimante par défaut.",
};

/** Variables substituted into a message template (`{{name}}`). */
export type MessageVars = Record<string, string | number>;

/** A minimal i18next-shaped translate function. */
export type TranslateFn = (key: string, vars?: MessageVars) => string;

/**
 * Build a translate function over the built-in defaults plus an optional
 * override map. Unknown keys return the key itself (so a typo is visible, not
 * silent). `{{var}}` placeholders are replaced from `vars`.
 */
export function makePreviewTranslate(messages?: Partial<PreviewMessages>): TranslateFn {
  const dict: Record<string, string | undefined> = messages
    ? { ...defaultPreviewMessages, ...messages }
    : defaultPreviewMessages;
  return (key, vars) => {
    const tpl = dict[key] ?? key;
    return vars ? tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(vars[k] ?? '')) : tpl;
  };
}
