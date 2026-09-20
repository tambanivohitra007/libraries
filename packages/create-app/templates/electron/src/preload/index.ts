import { contextBridge, ipcRenderer } from 'electron';

/** The narrow surface the renderer is allowed to reach. It mirrors the host
 *  adapter in `renderer/src/host.ts` — add here only what the chrome genuinely
 *  cannot do in a browser. */
const api = {
  saveDocument: (
    name: string,
    content: string,
    filter?: { name: string; extensions: string[] },
  ): Promise<string | null> => ipcRenderer.invoke('doc:save', name, content, filter),
  revealFile: (path: string): Promise<void> => ipcRenderer.invoke('doc:reveal', path),
  openFile: (path: string): Promise<boolean> => ipcRenderer.invoke('doc:open', path),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld('api', api);
