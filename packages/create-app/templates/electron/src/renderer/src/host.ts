import type { DesktopHost } from '@rindra/desktop';

/**
 * Bridges the chrome's host contract to this app's preload API.
 *
 * Screens must never call `window.api` directly — going through the adapter is
 * what keeps every screen runnable in a plain browser (and therefore in the
 * library's gallery, and in tests) where these operations fall back to a
 * download.
 */
export const host: DesktopHost = {
  saveDocument: (name, content, filter) => window.api.saveDocument(name, content, filter),
  revealFile: (path) => void window.api.revealFile(path),
  openFile: (path) => window.api.openFile(path),
};
