const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readExcel: (filePath) => ipcRenderer.invoke('read-excel', filePath),
  runPython: (code) => ipcRenderer.invoke('run-python', code),
  isElectron: true
});
