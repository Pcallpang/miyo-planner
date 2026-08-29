require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { loadWindowBounds, saveWindowBounds } = require('./windowBounds');
const auth = require('./auth');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5174';

let mainWindow = null;

function createWindow() {
  const bounds = loadWindowBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) mainWindow.loadURL(DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  const persistBounds = () => saveWindowBounds(mainWindow.getBounds());
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('close', persistBounds);
}

async function handleLogin() {
  try {
    const result = await auth.login();
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('miyo:getAuthState', () => ({ loggedIn: Boolean(auth.loadToken()) }));
ipcMain.handle('miyo:login', handleLogin);
ipcMain.handle('miyo:logout', () => {
  auth.clearToken();
  return { ok: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // 트레이 상주 프로그램이라 창을 닫아도 앱을 종료하지 않는다(Task 7에서 트레이 추가).
  if (process.platform !== 'darwin' && !app.isPackaged) app.quit();
});
