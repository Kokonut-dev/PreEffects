import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

let mainWindow: BrowserWindow | null = null;

function installZeroNetworkPrivacyGuard(): void {
  // Enforce strict 100% offline guarantee: block any outbound http(s)/ws(s) requests outside local dev server
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const allowedLocal =
      url.startsWith('file://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('devtools://') ||
      url.startsWith('http://localhost:') ||
      url.startsWith('http://127.0.0.1:');
    callback({ cancel: !allowedLocal });
  });
}

async function createStudioWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    title: 'PreEffects — Studio Compositor',
    width: 1600,
    height: 960,
    minWidth: 1120,
    minHeight: 680,
    backgroundColor: '#0b0c0e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function registerDesktopIpcHandlers(): void {
  ipcMain.handle('preeffects:app-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('preeffects:open-project', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Open PreEffects Project',
      filters: [
        { name: 'PreEffects Project (.prex)', extensions: ['prex', 'json'] },
        { name: 'All Supported Assets', extensions: ['prex', 'json', 'csv', 'obj', 'edl', 'cube', 'svg'] },
      ],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    return { filePath, content };
  });

  ipcMain.handle('preeffects:save-project', async (_evt, payload: { defaultName: string; content: string }) => {
    if (!mainWindow) return null;
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PreEffects Project',
      defaultPath: payload.defaultName || 'Project.prex',
      filters: [{ name: 'PreEffects Project (.prex)', extensions: ['prex'] }],
    });
    if (res.canceled || !res.filePath) return null;
    await fs.writeFile(res.filePath, payload.content, 'utf8');
    return { filePath: res.filePath };
  });

  ipcMain.handle('preeffects:write-binary', async (_evt, payload: { defaultName: string; bytes: Uint8Array }) => {
    if (!mainWindow) return null;
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Rendered Output',
      defaultPath: payload.defaultName,
    });
    if (res.canceled || !res.filePath) return null;
    await fs.writeFile(res.filePath, Buffer.from(payload.bytes));
    return { filePath: res.filePath };
  });

  ipcMain.handle('preeffects:autosave', async (_evt, payload: { projectId: string; content: string }) => {
    const autoDir = path.join(app.getPath('userData'), 'autosave');
    await fs.mkdir(autoDir, { recursive: true });
    const target = path.join(autoDir, `${payload.projectId.replace(/[^a-zA-Z0-9_-]/g, '_')}.prex`);
    await fs.writeFile(target, payload.content, 'utf8');
    return { savedAt: Date.now(), path: target };
  });
}

function buildNativeMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'PreEffects Home Hub', accelerator: 'Alt+H', click: () => mainWindow?.webContents.send('menu:action', 'view.home') },
        { type: 'separator' },
        { label: 'New Project', accelerator: 'CmdOrCtrl+Alt+N', click: () => mainWindow?.webContents.send('menu:action', 'file.new') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:action', 'file.open') },
        { label: 'Save Project…', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:action', 'file.save') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:action', 'edit.undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send('menu:action', 'edit.redo') },
      ],
    },
    {
      label: 'Composition',
      submenu: [
        { label: 'New Composition…', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:action', 'comp.new') },
        { label: 'Add to Render Queue', accelerator: 'CmdOrCtrl+M', click: () => mainWindow?.webContents.send('menu:action', 'comp.addToQueue') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Home / Studio', accelerator: 'Alt+H', click: () => mainWindow?.webContents.send('menu:action', 'view.home') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Interactive Feature Tutorial', click: () => mainWindow?.webContents.send('menu:action', 'help.tutorial') },
        { label: 'Studio Guide & Handbook', accelerator: 'F1', click: () => mainWindow?.webContents.send('menu:action', 'help.guide') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  installZeroNetworkPrivacyGuard();
  registerDesktopIpcHandlers();
  buildNativeMenu();
  await createStudioWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createStudioWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
