const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { serverUrl } = require('./config');
const { toWidgetData } = require('./widgetData');

function cacheFilePath() {
  return path.join(app.getPath('userData'), 'last-data.json');
}

function saveCache(data) {
  fs.writeFileSync(cacheFilePath(), JSON.stringify(data));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFilePath(), 'utf-8'));
  } catch {
    return null;
  }
}

/** 서버에서 오늘의 시간표 데이터를 가져온다. 실패하면 마지막 캐시를 돌려준다. */
async function fetchAppData(token) {
  try {
    const res = await fetch(`${serverUrl()}/api/data`, {
      headers: { Cookie: `session=${token}` },
    });
    // 세션 만료(30일)는 네트워크 장애와 다르다 — 다시 로그인해야 한다고 알린다.
    if (res.status === 401) {
      return { ok: false, offline: false, needsLogin: true, data: null, error: '다시 로그인해 주세요.' };
    }
    if (!res.ok) throw new Error(`서버 응답 오류: ${res.status}`);
    const body = await res.json();
    const data = toWidgetData(body.state);
    saveCache(data);
    return { ok: true, offline: false, data };
  } catch (e) {
    const cached = loadCache();
    return { ok: Boolean(cached), offline: true, data: cached, error: e.message };
  }
}

module.exports = { fetchAppData };
