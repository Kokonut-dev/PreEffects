import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('preEffectsDesktop', {
  isElectron: true,
  platform: process.platform,
  arch: process.arch,
  getAppInfo: () => ipcRenderer.invoke('preeffects:app-info'),
  openProjectDialog: () => ipcRenderer.invoke('preeffects:open-project'),
  saveProjectDialog: (defaultName: string, content: string) =>
    ipcRenderer.invoke('preeffects:save-project', { defaultName, content }),
  saveBinaryDialog: (defaultName: string, bytes: Uint8Array) =>
    ipcRenderer.invoke('preeffects:write-binary', { defaultName, bytes }),
  writeAutosave: (projectId: string, content: string) =>
    ipcRenderer.invoke('preeffects:autosave', { projectId, content }),
  onMenuAction: (cb: (actionId: string) => void) => {
    const listener = (_evt: unknown, actionId: string) => cb(actionId);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  },
});
