const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    show: false,
    resizable: true,
    icon: path.join(__dirname, 'public', 'icon.png')
  });

  ipcMain.on('toggle-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    // URL của Vite
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Build folder (dist)
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes('localhost') && !url.includes('index.html')) {
        event.preventDefault();
        require('electron').shell.openExternal(url);
    }
  });

  // Ẩn thay vì tắt khi bấm X
  mainWindow.on('close', (event) => {
    if(!app.isQuiting){
        event.preventDefault();
        mainWindow.hide();
    }
  });

  const enginePath = isDev 
    ? path.join(__dirname, 'engine.py') 
    : path.join(process.resourcesPath, 'engine.py');
    
  const pyProcess = require('child_process').spawn('python', [enginePath]);
  
  pyProcess.stdout.on('data', (data) => {
     const lines = data.toString().split('\n');
     lines.forEach(line => {
        if(line.startsWith('STAT|')) {
           const parts = line.split('|');
           const mode = parts[1];
           const force = parseFloat(parts[2]);
           if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('engine-stat', { mode, force });
           }
        }
     });
  });

  app.on('before-quit', () => {
    if (pyProcess) {
      pyProcess.kill();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mở Giao Diện Tùy Chỉnh', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Thoát Hoàn Toàn', click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('SlapWin - Đang lắng nghe...');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

// Đảm bảo micro được quyền truy cập nếu build trên MacOS/Windows (Electron tự handle, nhưng có thể cần thiết lập thêm trên Mac)
app.commandLine.appendSwitch('enable-features', 'GetUserMedia');
