import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * The few things the chrome needs from its host that a browser cannot do on its
 * own: save through a native dialog, reveal a file, open it, remember the accent
 * for a native splash.
 *
 * Every member is optional. Electron apps wire these to their preload IPC; a web
 * build leaves them out and gets the browser fallbacks below. Keeping this an
 * interface rather than a `window.api` reach-through is what lets one library
 * serve both the desktop and the web build of the same product.
 */
export interface DesktopHost {
  /** Save a document through a native dialog. Resolves the written path, or
   *  `null` if the user cancelled. Binary is allowed because the print module
   *  writes DOCX and XLSX through this same door. */
  saveDocument?: (
    defaultName: string,
    content: string | Uint8Array,
    filter?: FileFilter,
  ) => Promise<string | null>;
  /** Show the file in the OS file manager. */
  revealFile?: (path: string) => void;
  /** Open the file with its default application. Resolves `false` on failure. */
  openFile?: (path: string) => Promise<boolean>;
  /** Persist the resolved accent/mode outside the renderer (e.g. so the next
   *  launch's splash paints in the chosen colours). */
  setChromePrefs?: (prefs: { accent: string; mode: string }) => void;
}

/** Browser-only fallbacks, used for any member the host leaves out. A plain
 *  anchor download stands in for the native save dialog; there is no path
 *  afterwards, so reveal/open degrade to no-ops and the caller skips the
 *  "saved — open it?" affordances. */
const browserFallback: Required<Pick<DesktopHost, 'saveDocument' | 'revealFile' | 'openFile'>> = {
  saveDocument: async (defaultName, content) => {
    const part: BlobPart = typeof content === 'string' ? content : new Uint8Array(content);
    const type = typeof content === 'string' ? 'text/plain;charset=utf-8' : 'application/octet-stream';
    const url = URL.createObjectURL(new Blob([part], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return null; // no filesystem path exists in a browser download
  },
  revealFile: () => {},
  openFile: async () => false,
};

export type ResolvedHost = DesktopHost &
  Required<Pick<DesktopHost, 'saveDocument' | 'revealFile' | 'openFile'>>;

const HostContext = createContext<DesktopHost | null>(null);

export function DesktopHostProvider({
  host,
  children,
}: {
  host: DesktopHost;
  children: ReactNode;
}): React.JSX.Element {
  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

/** The host adapter with browser fallbacks filled in. Safe to call without a
 *  provider — an app that never exports or themes needs no host at all. */
export function useHost(): ResolvedHost {
  const host = useContext(HostContext);
  return useMemo(() => ({ ...browserFallback, ...(host ?? {}) }), [host]);
}
