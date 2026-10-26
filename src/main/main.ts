import { app, BrowserWindow, dialog, ipcMain, Menu, session } from 'electron';
import { execFile, spawn } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { compareSemver, GitHubReleasePayload, pickPlatformReleaseAsset } from '../utils/updaterLogic';

const execFileAsync = promisify(execFile);

let mainWindow: BrowserWindow | null = null;
let recentVaultItems: Array<{ id: string; name: string; updatedAt: number }> = [];

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/Kokonut-dev/PreEffects/releases/latest';

function installZeroNetworkPrivacyGuard(): void {
  // Enforce strict 100% offline guarantee on renderer webContents: block any outbound http(s)/ws(s) requests outside local dev server
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

function sendUpdaterProgress(
  stage: 'checking' | 'downloading' | 'verifying' | 'installing' | 'relaunching' | 'error',
  percent: number,
  message: string,
  transferredBytes?: number,
  totalBytes?: number,
): void {
  mainWindow?.webContents.send('updater:progress', {
    stage,
    percent,
    message,
    transferredBytes,
    totalBytes,
  });
}

function httpsGetJson<T>(url: string, redirectsLeft = 5): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': `PreEffects-Updater/${app.getVersion()}`,
          Accept: 'application/vnd.github+json',
        },
        timeout: 15000,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many HTTP redirects while checking release'));
            return;
          }
          resolve(httpsGetJson<T>(res.headers.location, redirectsLeft - 1));
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`GitHub Release API returned HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Connection timed out'));
    });
  });
}

function downloadFileWithProgress(
  url: string,
  destPath: string,
  expectedBytes?: number,
  redirectsLeft = 6,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': `PreEffects-Updater/${app.getVersion()}`,
          Accept: 'application/octet-stream',
        },
        timeout: 30000,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ((status === 301 || status === 302 || status === 307 || status === 308) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many HTTP redirects during asset download'));
            return;
          }
          resolve(downloadFileWithProgress(res.headers.location, destPath, expectedBytes, redirectsLeft - 1));
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Asset download returned HTTP ${status}`));
          return;
        }
        const total = Number(res.headers['content-length']) || expectedBytes || 0;
        let received = 0;
        const hash = crypto.createHash('sha256');
        const out = fsSync.createWriteStream(destPath);

        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          hash.update(chunk);
          const pct = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 50;
          sendUpdaterProgress('downloading', pct, `Downloading update (${(received / 1048576).toFixed(1)} MB)…`, received, total);
        });

        res.pipe(out);
        out.on('finish', () => {
          out.close(() => resolve(hash.digest('hex')));
        });
        out.on('error', reject);
      },
    );
    req.on('error', reject);
  });
}

function resolveMacAppBundlePath(): string | null {
  if (process.platform !== 'darwin') return null;
  // Example packaged execPath: /Applications/PreEffects.app/Contents/MacOS/PreEffects
  const candidate = path.resolve(process.execPath, '../../..');
  if (candidate.endsWith('.app')) return candidate;
  const fallback = '/Applications/PreEffects.app';
  return fsSync.existsSync(fallback) ? fallback : null;
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
    electronVersion: process.versions.electron ?? '',
    isPackaged: app.isPackaged,
  }));

  // BUG-R4-03 Fixed: Support both .prex/.json projects AND binary images/audio/3D/LUTs cleanly
  ipcMain.handle('preeffects:open-project', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Open PreEffects Project or Media Asset',
      filters: [
        {
          name: 'All Supported Studio Files',
          extensions: ['prex', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'wav', 'obj', 'csv', 'tsv', 'edl', 'cube'],
        },
        { name: 'PreEffects Project (.prex)', extensions: ['prex', 'json'] },
        { name: 'Images & Plates', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
        { name: 'Audio (.wav)', extensions: ['wav'] },
        { name: '3D Mesh, Data & LUT (.obj, .csv, .edl, .cube)', extensions: ['obj', 'csv', 'tsv', 'edl', 'cube'] },
      ],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isTextProject = ext === '.prex' || ext === '.json';
    return {
      filePath,
      name: path.basename(filePath),
      bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      content: isTextProject ? buf.toString('utf8') : undefined,
    };
  });

  ipcMain.handle('preeffects:save-project', async (_evt, payload: { defaultName: string; content: string }) => {
    if (!mainWindow) return { canceled: true };
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PreEffects Project',
      defaultPath: payload.defaultName || 'Project.prex',
      filters: [{ name: 'PreEffects Project (.prex)', extensions: ['prex'] }],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    await fs.writeFile(res.filePath, payload.content, 'utf8');
    return { canceled: false, filePath: res.filePath };
  });

  ipcMain.handle('preeffects:write-binary', async (_evt, payload: { defaultName: string; bytes: Uint8Array }) => {
    if (!mainWindow) return { canceled: true };
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Rendered Output',
      defaultPath: payload.defaultName,
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    await fs.writeFile(res.filePath, Buffer.from(payload.bytes));
    return { canceled: false, filePath: res.filePath };
  });

  ipcMain.handle('preeffects:autosave', async (_evt, payload: { projectId: string; content: string }) => {
    const autoDir = path.join(app.getPath('userData'), 'autosave');
    await fs.mkdir(autoDir, { recursive: true });
    const target = path.join(autoDir, `${payload.projectId.replace(/[^a-zA-Z0-9_-]/g, '_')}.prex`);
    await fs.writeFile(target, payload.content, 'utf8');
    return { savedAt: Date.now(), path: target };
  });

  // QOL-R4-10: Sync Local Project Vault entries into Native OS File -> Open Recent Menu
  ipcMain.handle(
    'preeffects:sync-recent-projects',
    (_evt, items: Array<{ id: string; name: string; updatedAt: number }>) => {
      recentVaultItems = Array.isArray(items) ? items.slice(0, 8) : [];
      buildNativeMenu();
    },
  );

  // QOL-R4-05: Strictly Opt-In User-Initiated GitHub Release Update Checker (zero background polling!)
  ipcMain.handle('preeffects:check-update', async () => {
    const currentVersion = app.getVersion();
    try {
      sendUpdaterProgress('checking', 10, 'Checking GitHub Releases for newer version…');
      const rel = await httpsGetJson<GitHubReleasePayload>(GITHUB_LATEST_RELEASE_API);
      const latestRaw = (rel.tag_name || currentVersion).replace(/^v/i, '');
      const updateAvailable = compareSemver(latestRaw, currentVersion) > 0;
      const matched = pickPlatformReleaseAsset(rel.assets ?? [], process.platform, process.arch);
      const sha256 =
        matched?.digest && matched.digest.startsWith('sha256:')
          ? matched.digest.slice('sha256:'.length)
          : undefined;
      const canInstallInPlace =
        Boolean(matched?.browser_download_url) &&
        (process.platform === 'darwin'
          ? Boolean(resolveMacAppBundlePath())
          : process.platform === 'win32'
          ? app.isPackaged
          : process.platform === 'linux'
          ? Boolean(process.env.APPIMAGE)
          : false);

      return {
        ok: true,
        currentVersion,
        latestVersion: latestRaw,
        updateAvailable,
        releaseName: rel.name || `PreEffects v${latestRaw}`,
        releaseNotes: rel.body || '',
        publishedAt: rel.published_at,
        htmlUrl: rel.html_url || 'https://github.com/Kokonut-dev/PreEffects/releases/latest',
        assetName: matched?.name,
        assetUrl: matched?.browser_download_url,
        assetSize: matched?.size,
        sha256,
        canInstallInPlace,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach GitHub Releases';
      sendUpdaterProgress('error', 0, msg);
      return {
        ok: false,
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        canInstallInPlace: false,
        error: msg,
      };
    }
  });

  // QOL-R4-05: Opt-In Atomic In-Place Installer (supports $0/yr Apple Silicon DMG/ZIP quarantine-strip + ad-hoc sign!)
  ipcMain.handle(
    'preeffects:install-update',
    async (
      _evt,
      info: {
        assetName?: string;
        assetUrl?: string;
        assetSize?: number;
        sha256?: string;
        latestVersion: string;
      },
    ) => {
      if (!info.assetUrl || !info.assetName) {
        return { ok: false, message: 'No compatible release installer found for this platform.' };
      }
      if (!info.assetUrl.startsWith('https://github.com/Kokonut-dev/PreEffects/releases/download/')) {
        return { ok: false, message: 'Refused untrusted update URL outside Kokonut-dev/PreEffects.' };
      }

      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preeffects-update-'));
      const safeName = path.basename(info.assetName);
      const archivePath = path.join(workDir, safeName);

      try {
        const computedSha256 = await downloadFileWithProgress(info.assetUrl, archivePath, info.assetSize);
        sendUpdaterProgress('verifying', 100, 'Verifying cryptographic SHA-256 package integrity…');
        if (info.sha256 && computedSha256.toLowerCase() !== info.sha256.toLowerCase()) {
          throw new Error('SHA-256 checksum mismatch — aborted update for safety.');
        }

        sendUpdaterProgress('installing', 100, 'Preparing in-place application bundle update…');

        if (process.platform === 'darwin') {
          const targetApp = resolveMacAppBundlePath();
          if (!targetApp) {
            throw new Error('Cannot replace .app bundle when running unpacked dev Electron.');
          }
          const stagedApp = path.join(workDir, 'PreEffects.app');
          if (safeName.toLowerCase().endsWith('.dmg')) {
            const mountPoint = path.join(workDir, 'mnt');
            await fs.mkdir(mountPoint, { recursive: true });
            await execFileAsync('hdiutil', ['attach', archivePath, '-nobrowse', '-readonly', '-mountpoint', mountPoint]);
            try {
              const entries = await fs.readdir(mountPoint);
              const appEntry = entries.find((e) => e.endsWith('.app'));
              if (!appEntry) throw new Error('No .app bundle found inside downloaded DMG');
              await execFileAsync('ditto', [path.join(mountPoint, appEntry), stagedApp]);
            } finally {
              await execFileAsync('hdiutil', ['detach', mountPoint, '-force']).catch(() => undefined);
            }
          } else {
            const unpackDir = path.join(workDir, 'unpacked');
            await fs.mkdir(unpackDir, { recursive: true });
            await execFileAsync('ditto', ['-x', '-k', archivePath, unpackDir]);
            const entries = await fs.readdir(unpackDir);
            const appEntry = entries.find((e) => e.endsWith('.app'));
            if (!appEntry) throw new Error('No .app bundle found inside downloaded ZIP');
            await execFileAsync('ditto', [path.join(unpackDir, appEntry), stagedApp]);
          }

          // Strip com.apple.quarantine and ensure valid ad-hoc signature for Apple Silicon arm64
          await execFileAsync('xattr', ['-cr', stagedApp]).catch(() => undefined);
          await execFileAsync('codesign', ['--force', '--deep', '--sign', '-', stagedApp]).catch(() => undefined);

          const swapScript = path.join(workDir, 'swap_and_relaunch.sh');
          const pid = process.pid;
          const scriptBody = [
            '#!/bin/sh',
            `while kill -0 ${pid} 2>/dev/null; do sleep 0.2; done`,
            'rm -rf "$1"',
            'mv "$2" "$1"',
            'xattr -cr "$1" 2>/dev/null || true',
            'open "$1"',
            'rm -rf "$3" 2>/dev/null || true',
          ].join('\n');
          await fs.writeFile(swapScript, scriptBody, { mode: 0o755 });

          sendUpdaterProgress('relaunching', 100, `Relaunching PreEffects v${info.latestVersion}…`);
          const child = spawn('/bin/sh', [swapScript, targetApp, stagedApp, workDir], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          setTimeout(() => app.quit(), 250);
          return { ok: true, message: `Installing PreEffects v${info.latestVersion} and relaunching…` };
        }

        if (process.platform === 'win32') {
          sendUpdaterProgress('relaunching', 100, `Launching silent NSIS updater for v${info.latestVersion}…`);
          const child = spawn(archivePath, ['/S'], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          setTimeout(() => app.quit(), 250);
          return { ok: true, message: `Installing PreEffects v${info.latestVersion}…` };
        }

        if (process.platform === 'linux' && process.env.APPIMAGE) {
          const appImageDest = process.env.APPIMAGE;
          const nextPath = `${appImageDest}.new`;
          await fs.copyFile(archivePath, nextPath);
          await fs.chmod(nextPath, 0o755);
          await fs.rename(nextPath, appImageDest);
          sendUpdaterProgress('relaunching', 100, `Relaunching AppImage v${info.latestVersion}…`);
          const child = spawn(appImageDest, [], {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
          setTimeout(() => app.quit(), 250);
          return { ok: true, message: `Updated AppImage to v${info.latestVersion} and relaunching…` };
        }

        return {
          ok: false,
          message: `Downloaded installer to ${archivePath}. Run packaged build to replace in place.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update installation failed';
        sendUpdaterProgress('error', 0, msg);
        return { ok: false, message: msg };
      }
    },
  );
}

function buildNativeMenu(): void {
  const recentSubmenu: Electron.MenuItemConstructorOptions[] =
    recentVaultItems.length > 0
      ? recentVaultItems.map((item) => ({
          label: item.name,
          click: () => mainWindow?.webContents.send('menu:action', `recent:${item.id}`),
        }))
      : [{ label: 'No Vault Projects Yet', enabled: false }];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'PreEffects Home Hub', accelerator: 'Alt+H', click: () => mainWindow?.webContents.send('menu:action', 'view.home') },
        { type: 'separator' },
        { label: 'New Project', accelerator: 'CmdOrCtrl+Alt+N', click: () => mainWindow?.webContents.send('menu:action', 'file.new') },
        { label: 'Open Project or Media…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:action', 'file.open') },
        { label: 'Open Recent (Local Vault)', submenu: recentSubmenu },
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
        { type: 'separator' },
        { label: 'Copy Layer / Effects', accelerator: 'CmdOrCtrl+C', click: () => mainWindow?.webContents.send('menu:action', 'edit.copy') },
        { label: 'Paste Layer / Effects', accelerator: 'CmdOrCtrl+V', click: () => mainWindow?.webContents.send('menu:action', 'edit.paste') },
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
        { label: 'Interactive Feature Tutorial', accelerator: 'F2', click: () => mainWindow?.webContents.send('menu:action', 'help.tutorial') },
        { label: 'Studio Guide & Handbook', accelerator: 'F1', click: () => mainWindow?.webContents.send('menu:action', 'help.guide') },
        { type: 'separator' },
        { label: 'Check for Updates…', click: () => mainWindow?.webContents.send('menu:action', 'help.checkUpdates') },
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
