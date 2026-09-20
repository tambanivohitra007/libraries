import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { desktopLocales } from '@rindra/desktop';

// The gallery ships no strings of its own — the grid's bundled `table.*` keys
// are the whole resource set, which doubles as a check that they are complete.
void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    fr: { translation: desktopLocales.fr },
    en: { translation: desktopLocales.en },
    mg: { translation: desktopLocales.mg },
  },
});

export default i18n;
