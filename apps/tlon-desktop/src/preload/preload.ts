import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  setUrbitShip: (shipUrl) => ipcRenderer.invoke('set-urbit-ship', shipUrl),
  getVersion: () => ipcRenderer.invoke('get-version'),
  loginToShip: (shipUrl, accessCode) =>
    ipcRenderer.invoke('login-to-ship', { shipUrl, accessCode }),

  storeAuthInfo: (authInfo) => ipcRenderer.invoke('store-auth-info', authInfo),
  getAuthInfo: () => ipcRenderer.invoke('get-auth-info'),
  clearAuthInfo: () => ipcRenderer.invoke('clear-auth-info'),
});

// Expose SQLite bridge
contextBridge.exposeInMainWorld('sqliteBridge', {
  init: () => ipcRenderer.invoke('sqlite:init'),
  execute: (
    sql: string,
    params: any[],
    method: 'all' | 'run' | 'values' | 'get'
  ) => ipcRenderer.invoke('sqlite:execute', { sql, params, method }),
  runMigrations: (migrations: any[]) =>
    ipcRenderer.invoke('sqlite:migrations', { migrations }),
  purgeDb: () => ipcRenderer.invoke('sqlite:purge'),
  getDbPath: () => ipcRenderer.invoke('sqlite:get-path'),
  onDbChange: (callback: (data: any) => void) => {
    const handler = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on('sqlite:change', handler);
    return () => {
      ipcRenderer.removeListener('sqlite:change', handler);
    };
  },
});
