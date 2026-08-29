const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miyo', {
  getAuthState: () => ipcRenderer.invoke('miyo:getAuthState'),
  login: () => ipcRenderer.invoke('miyo:login'),
  logout: () => ipcRenderer.invoke('miyo:logout'),
  getAppData: () => ipcRenderer.invoke('miyo:getAppData'),
  onAppDataUpdated: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on('miyo:appDataUpdated', listener);
    return () => ipcRenderer.removeListener('miyo:appDataUpdated', listener);
  },
});
