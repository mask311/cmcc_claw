const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('xlsx module not found, Excel support will be disabled.');
}
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "CMCC_Claw AI Agent",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// IPC Handlers
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-excel', async (event, filePath) => {
  try {
    if (!XLSX) {
      throw new Error('Excel parsing module (xlsx) is not installed. Please run "npm install xlsx" and rebuild the app.');
    }
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    const data = {};
    sheetNames.forEach(name => {
      const worksheet = workbook.Sheets[name];
      data[name] = XLSX.utils.sheet_to_json(worksheet);
    });
    return { success: true, data, sheetNames };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
