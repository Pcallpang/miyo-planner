const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miyo', {
  getAuthState: () => ipcRenderer.invoke('miyo:getAuthState'),
  login: () => ipcRenderer.invoke('miyo:login'),
  logout: () => ipcRenderer.invoke('miyo:logout'),
});
