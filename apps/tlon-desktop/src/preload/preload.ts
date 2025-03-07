const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    setUrbitShip: (shipUrl) => ipcRenderer.invoke('set-urbit-ship', shipUrl),
    getVersion: () => ipcRenderer.invoke('get-version'),
    loginToShip: (shipUrl, accessCode) => 
      ipcRenderer.invoke('login-to-ship', { shipUrl, accessCode }),
    
    storeAuthInfo: (authInfo) => ipcRenderer.invoke('store-auth-info', authInfo),
    getAuthInfo: () => ipcRenderer.invoke('get-auth-info'),
    clearAuthInfo: () => ipcRenderer.invoke('clear-auth-info'),
  }
);
