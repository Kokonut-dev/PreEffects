import { contextBridge, ipcRenderer } from 'electron';

export interface DesktopAppInfo {
  version: string;
  platform: string;
  arch: string;
  electronVersion: string;
  isPackaged: boolean;
}

export interface DesktopOpenFileResult {
  filePath: string;
  name: string;
  bytes: Uint8Array;
  content?: string;
}

export interface UpdateCheckResult {
  ok: boolean;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseName?: string;
  releaseNotes?: string;
  publishedAt?: string;
  htmlUrl?: string;
  assetName?: string;
  assetUrl?: string;
  assetSize?: number;
  sha256?: string;
  canInstallInPlace: boolean;
  error?: string;
}

export interface UpdateProgressEvent {
  stage: 'checking' | 'downloading' | 'verifying' | 'installing' | 'relaunching' | 'error';
  percent: number;
  message: string;
  transferredBytes?: number;
  totalBytes?: number;
}

export interface RecentVaultMenuItem {
  id: string;
  name: string;
  updatedAt: number;
}

const desktopBridge = {
  isDesktopApp: true,
  isElectron: true,
  platform: process.platform,
  arch: process.arch,
  getAppInfo: (): Promise<DesktopAppInfo> => ipcRenderer.invoke('preeffects:app-info'),
  openProjectDialog: (): Promise<DesktopOpenFileResult | null> =>
    ipcRenderer.invoke('preeffects:open-project'),
  saveProjectDialog: (defaultName: string, content: string): Promise<{ canceled?: boolean; filePath?: string } | null> =>
    ipcRenderer.invoke('preeffects:save-project', { defaultName, content }),
  saveBinaryDialog: (defaultName: string, bytes: Uint8Array): Promise<{ canceled?: boolean; filePath?: string } | null> =>
    ipcRenderer.invoke('preeffects:write-binary', { defaultName, bytes }),
  writeAutosave: (projectId: string, content: string): Promise<{ savedAt: number; path: string }> =>
    ipcRenderer.invoke('preeffects:autosave', { projectId, content }),
  writeAutosaveSnapshot: (projectId: string, content: string): Promise<{ savedAt: number; path: string }> =>
    ipcRenderer.invoke('preeffects:autosave', { projectId, content }),
  syncRecentProjects: (items: RecentVaultMenuItem[]): Promise<void> =>
    ipcRenderer.invoke('preeffects:sync-recent-projects', items),
  checkForUpdates: (): Promise<UpdateCheckResult> =>
    ipcRenderer.invoke('preeffects:check-update'),
  installUpdate: (info: UpdateCheckResult): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('preeffects:install-update', info),
  onUpdateProgress: (cb: (ev: UpdateProgressEvent) => void) => {
    const listener = (_evt: unknown, ev: UpdateProgressEvent) => cb(ev);
    ipcRenderer.on('updater:progress', listener);
    return () => {
      ipcRenderer.removeListener('updater:progress', listener);
    };
  },
  onMenuAction: (cb: (actionId: string) => void) => {
    const listener = (_evt: unknown, actionId: string) => cb(actionId);
    ipcRenderer.on('menu:action', listener);
    return () => {
      ipcRenderer.removeListener('menu:action', listener);
    };
  },
};

export type DesktopBridge = typeof desktopBridge;

contextBridge.exposeInMainWorld('preEffectsDesktop', desktopBridge);
