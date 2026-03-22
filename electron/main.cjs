const { app, BrowserWindow, ipcMain, Menu, MenuItem, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
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

  // Add Context Menu
  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Add Copy if text is selected
    if (params.selectionText) {
      menu.append(new MenuItem({ label: '复制', role: 'copy' }));
    }

    // Add Cut if text is selected and editable
    if (params.isEditable && params.selectionText) {
      menu.append(new MenuItem({ label: '剪切', role: 'cut' }));
    }

    // Add Paste if editable
    if (params.isEditable) {
      menu.append(new MenuItem({ label: '粘贴', role: 'paste' }));
    }

    // Add Select All
    menu.append(new MenuItem({ label: '全选', role: 'selectAll' }));

    // Show the menu
    menu.popup({ window: win, x: params.x, y: params.y });
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
    const normalizedPath = path.normalize(filePath);
    const content = fs.readFileSync(normalizedPath, 'utf-8');
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
    const normalizedPath = path.normalize(filePath);
    const workbook = XLSX.readFile(normalizedPath);
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

ipcMain.handle('run-python', async (event, code) => {
  return new Promise((resolve) => {
    const tempFile = path.join(app.getPath('temp'), `temp_script_${Date.now()}.py`);
    fs.writeFileSync(tempFile, code);
    
    // Try 'python' then 'python3'
    const command = process.platform === 'win32' ? `python "${tempFile}"` : `python3 "${tempFile}"`;
    
    exec(command, (error, stdout, stderr) => {
      // Clean up temp file
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
      
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
});

ipcMain.handle('open-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (event, filePath) => {
  try {
    const normalizedPath = path.normalize(filePath);
    await shell.openPath(normalizedPath);
    return { success: true };
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
