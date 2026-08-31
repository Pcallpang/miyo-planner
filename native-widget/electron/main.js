require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const { loadWindowBounds, saveWindowBounds } = require('./windowBounds');
const auth = require('./auth');
const { fetchAppData } = require('./dataFetch');

const isDev = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5174';

let mainWindow = null;
let boundsSaveTimer = null;
/** 렌더러가 최소화 토글 버튼을 누를 때마다 miyo:setMinimized로 알려주는 현재 모드.
 *  창 리사이즈 이벤트가 펼침/최소화 중 어느 쪽 높이를 갱신해야 할지 이 값으로 가른다. */
let isMinimized = false;
let lastBounds = null;

function isWindowAlive() {
  return Boolean(mainWindow) && !mainWindow.isDestroyed();
}

function persistBoundsDebounced() {
  clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(() => {
    if (!isWindowAlive()) return;
    const current = mainWindow.getBounds();
    lastBounds = {
      ...lastBounds,
      x: current.x,
      y: current.y,
      width: current.width,
      wasMinimized: isMinimized,
      ...(isMinimized ? { minimizedHeight: current.height } : { height: current.height }),
    };
    saveWindowBounds(lastBounds);
  }, 300);
}

/** 로그인 상태가 바뀌었음을 렌더러에 알린다(위젯 버튼·트레이 메뉴 어느 쪽에서 바뀌든). */
function broadcastAuthChanged() {
  if (isWindowAlive()) {
    mainWindow.webContents.send('miyo:authChanged', { loggedIn: Boolean(auth.loadToken()) });
  }
}

function createWindow() {
  const bounds = loadWindowBounds();
  lastBounds = bounds;
  isMinimized = Boolean(bounds.wasMinimized);
  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: isMinimized ? bounds.minimizedHeight : bounds.height,
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

  // 드래그/크기조절 중에는 이벤트가 초당 수십 번 발생한다. 매번 동기 디스크 쓰기를
  // 하면 메인 프로세스가 멈추므로 0.3초 동안 모아서 한 번만 저장한다.
  mainWindow.on('resize', persistBoundsDebounced);
  mainWindow.on('move', persistBoundsDebounced);
  mainWindow.on('close', (e) => {
    // 닫기는 한 번만 일어나므로 지연 없이 즉시 저장한다(마지막 크기가 유실되지 않게).
    clearTimeout(boundsSaveTimer);
    const current = mainWindow.getBounds();
    lastBounds = {
      ...lastBounds,
      x: current.x,
      y: current.y,
      width: current.width,
      wasMinimized: isMinimized,
      ...(isMinimized ? { minimizedHeight: current.height } : { height: current.height }),
    };
    saveWindowBounds(lastBounds);
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

/** 렌더러의 최소화 토글에 맞춰 창 자체의 높이를 줄이거나 되돌린다(너비·위치는 그대로).
 *  두 모드의 높이를 각각 기억해 두므로, 어느 한쪽에서 사용자가 리사이즈해도 다른
 *  쪽 크기는 그대로 유지된다. */
function setMinimized(minimized) {
  isMinimized = Boolean(minimized);
  if (!isWindowAlive()) return;
  const current = mainWindow.getBounds();
  const targetHeight = isMinimized ? lastBounds.minimizedHeight : lastBounds.height;
  mainWindow.setBounds({ x: current.x, y: current.y, width: current.width, height: targetHeight });
}

let pollTimer = null;

async function refreshAppData() {
  const token = auth.loadToken();
  if (!token) return { ok: false, offline: true, data: null, error: '로그인이 필요합니다.' };
  const result = await fetchAppData(token);
  // 세션이 만료됐으면(401) 토큰을 버리고 로그인 화면으로 되돌린다.
  if (result.needsLogin) {
    auth.clearToken();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tray) updateTrayMenu();
    broadcastAuthChanged();
    return result;
  }
  if (isWindowAlive()) mainWindow.webContents.send('miyo:appDataUpdated', result);
  return result;
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refreshAppData, 5 * 60 * 1000);
}

ipcMain.handle('miyo:getAppData', () => refreshAppData());
ipcMain.handle('miyo:hideWidget', () => {
  if (isWindowAlive()) mainWindow.hide();
  if (tray) updateTrayMenu();
});
ipcMain.handle('miyo:setMinimized', (_event, minimized) => setMinimized(minimized));

async function handleLogin() {
  try {
    const result = await auth.login();
    // 자동 실행은 사용자가 명시적으로 고른 값을 존중한다. 한 번도 고른 적이 없을 때만
    // (= 진짜 첫 로그인) 기본으로 켜고, 그 선택을 파일에 기록해 둔다.
    if (auth.getAutoStartChoice() === null) {
      app.setLoginItemSettings({ openAtLogin: true });
      auth.setAutoStartChoice(true);
    }
    startPolling();
    await refreshAppData();
    if (tray) updateTrayMenu();
    broadcastAuthChanged();
    return { ok: true, user: result.user };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('miyo:getAuthState', () => ({ loggedIn: Boolean(auth.loadToken()) }));
ipcMain.handle('miyo:login', handleLogin);
function handleLogout() {
  auth.clearToken();
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (tray) updateTrayMenu();
  broadcastAuthChanged();
}

ipcMain.handle('miyo:logout', () => {
  handleLogout();
  return { ok: true };
});

let tray = null;

/** 위젯 보이기/숨기기 토글. 토글 뒤에는 트레이 메뉴 라벨도 최신 상태로 다시 만든다. */
function toggleWindowVisibility() {
  if (!isWindowAlive()) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
  if (tray) updateTrayMenu();
}

function updateTrayMenu() {
  const loggedIn = Boolean(auth.loadToken());
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: isWindowAlive() && mainWindow.isVisible() ? '위젯 숨기기' : '위젯 보이기',
      click: toggleWindowVisibility,
    },
    { type: 'separator' },
    loggedIn
      ? { label: '로그아웃', click: handleLogout }
      : { label: '로그인', click: () => void handleLogin() },
    {
      label: '윈도우 시작 시 자동 실행',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        auth.setAutoStartChoice(item.checked); // 사용자의 명시적 선택을 기록해 둔다.
      },
    },
    { type: 'separator' },
    { label: '종료', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/tray-icon.png'));
  tray = new Tray(icon);
  tray.setToolTip('미요 오늘의 시간표');
  tray.on('click', toggleWindowVisibility);
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
