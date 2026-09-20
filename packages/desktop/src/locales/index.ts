import fr from './fr.json';
import en from './en.json';
import mg from './mg.json';

/**
 * The grid's own strings, under the `table` namespace it looks up through
 * `react-i18next`. Merge these into your i18next resources so a fresh app gets
 * a working toolbar without transcribing 54 keys:
 *
 * ```ts
 * import { desktopLocales } from '@rindra/desktop';
 *
 * i18n.init({
 *   resources: {
 *     fr: { translation: { ...desktopLocales.fr, ...mesTraductions.fr } },
 *   },
 * });
 * ```
 *
 * Spreading yours last keeps the app's wording authoritative — override any
 * single key without forking the set.
 */
export const desktopLocales = { fr, en, mg };

export type DesktopLocale = keyof typeof desktopLocales;
