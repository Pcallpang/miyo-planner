require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { loadWindowBounds, saveWindowBounds } = require('./windowBounds');
const auth = require('./auth');
const { fetchAppData } = require('./dataFetch');

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

  mainWindow.on('focus', () => { if (auth.loadToken()) void refreshAppData(); });

  const persistBounds = () => saveWindowBounds(mainWindow.getBounds());
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('close', (e) => {
    persistBounds();
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

let pollTimer = null;

async function refreshAppData() {
  const token = auth.loadToken();
  if (!token) return { ok: false, offline: true, data: null, error: '로그인이 필요합니다.' };
  const result = await fetchAppData(token);
  if (mainWindow) mainWindow.webContents.send('miyo:appDataUpdated', result);
  return result;
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshAppData, 5 * 60 * 1000);
}

ipcMain.handle('miyo:getAppData', () => refreshAppData());

async function handleLogin() {
  const isFirstLogin = !auth.loadToken();
  try {
    const result = await auth.login();
    if (isFirstLogin) app.setLoginItemSettings({ openAtLogin: true });
    startPolling();
    await refreshAppData();
    if (tray) updateTrayMenu();
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

let tray = null;

function updateTrayMenu() {
  const loggedIn = Boolean(auth.loadToken());
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? '위젯 숨기기' : '위젯 보이기',
      click: () => mainWindow && (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()),
    },
    { type: 'separator' },
    loggedIn
      ? { label: '로그아웃', click: () => { auth.clearToken(); updateTrayMenu(); } }
      : { label: '로그인', click: () => void handleLogin().then(updateTrayMenu) },
    {
      label: '윈도우 시작 시 자동 실행',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('미요 오늘의 시간표');
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
  updateTrayMenu();
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  if (auth.loadToken()) {
    startPolling();
    await refreshAppData();
  }
});
