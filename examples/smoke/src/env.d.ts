/** Stands in for the app's own preload bridge typing, so the example shows how
 *  a real Electron renderer adapts `window.api` to the library's host contract. */
declare global {
  interface Window {
    api: {
      enregistrerDocument: (
        name: string,
        content: string | Uint8Array,
      ) => Promise<string | null>;
      montrerFichier: (path: string) => void;
      ouvrirFichier: (path: string) => Promise<boolean>;
      setChromePrefs: (prefs: { accent: string; mode: string }) => Promise<void>;
    };
  }
}

export {};
