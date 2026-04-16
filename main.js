const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

// Decide dynamic paths for Packaged App vs Dev
// Provide OS tmp dir as robust fallback for uploads instead of project root
const appUploadsDir = path.join(app.getPath('userData'), 'uploads');
const appLogsDir = path.join(app.getPath('userData'), 'logs');
const APP_PORT = 3001; // Internal express port

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "酒店牛马美工专用",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false // for simplicity if needed, otherwise true is better
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'client/dist/index.html'));
  }
}

function startExpressServer() {
  const serverPath = path.join(__dirname, 'server/index.js');
  
  // Start server, passing dynamic paths via environment variables
  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: APP_PORT,
      UPLOAD_DIR: appUploadsDir,
      LOG_DIR: appLogsDir,
      IS_ELECTRON: 'true'
    },
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start Express server:', err);
    dialog.showErrorBox("Backend Server Failed", "Failed to start the backend processing server. " + err.message);
  });
}

function checkServerReady(port, callback) {
  const client = new net.Socket();
  client.once('connect', () => {
    client.destroy();
    callback(true);
  });
  client.once('error', (err) => {
    client.destroy();
    setTimeout(() => {
      checkServerReady(port, callback);
    }, 500);
  });
  client.connect(port, '127.0.0.1');
}

app.whenReady().then(() => {
  if (!isDev) {
    // In production, we orchestrate the express server first.
    startExpressServer();
    checkServerReady(APP_PORT, () => {
      createWindow();
    });
  } else {
    // In dev, 'concurrently' handles the server via npm run start:server
    createWindow();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Kill the Express child process on exit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
