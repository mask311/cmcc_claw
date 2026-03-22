const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readExcel: (filePath) => ipcRenderer.invoke('read-excel', filePath),
  runPython: (code) => ipcRenderer.invoke('run-python', code),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  isElectron: true
});
