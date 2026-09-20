import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { desktopLocales } from '@rindra/desktop';
import fr from './locales/fr.json';

/**
 * The grid looks up 54 keys under `table.*`; `desktopLocales` supplies them in
 * French, English and Malagasy. The app's own strings are spread *after*, so
 * overriding any single key is a matter of defining it in `locales/fr.json`.
 */
void i18n.use(initReactI18next).init({
  lng: '__LOCALE__',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  resources: {
    fr: { translation: { ...desktopLocales.fr, ...fr } },
    en: { translation: { ...desktopLocales.en } },
    mg: { translation: { ...desktopLocales.mg } },
  },
});

export default i18n;
