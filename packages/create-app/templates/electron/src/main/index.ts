import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

/**
 * The three file operations the chrome cannot do itself. They are the whole
 * reason the renderer needs a host adapter — everything else in
 * `@rindra/desktop` is plain browser code.
 */
function registerFileHandlers(): void {
  ipcMain.handle(
    'doc:save',
    async (
      _e,
      defaultName: string,
      content: string | Uint8Array,
      filter?: { name: string; extensions: string[] },
    ): Promise<string | null> => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: filter ? [filter] : undefined,
      });
      // null tells the renderer the user cancelled, which is not an error and
      // must not raise the "saved" notification.
      if (canceled || !filePath) return null;
      // Text is written as UTF-8; DOCX and XLSX arrive as bytes and must not be
      // re-encoded, or the file is corrupt on open.
      await writeFile(filePath, content, typeof content === 'string' ? 'utf8' : null);
      return filePath;
    },
  );

  ipcMain.handle('doc:reveal', (_e, path: string): void => {
    shell.showItemInFolder(path);
  });

  // shell.openPath resolves an empty string on success, or a message on failure.
  ipcMain.handle('doc:open', async (_e, path: string): Promise<boolean> => {
    return (await shell.openPath(path)) === '';
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  // Painting only once the renderer is ready avoids the white flash.
  win.on('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  registerFileHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
