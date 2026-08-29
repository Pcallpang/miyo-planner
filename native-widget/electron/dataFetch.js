const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function serverUrl() {
  return process.env.MIYO_SERVER_URL || 'http://localhost:3001';
}

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
    if (!res.ok) throw new Error(`서버 응답 오류: ${res.status}`);
    const body = await res.json();
    saveCache(body.state);
    return { ok: true, offline: false, data: body.state };
  } catch (e) {
    const cached = loadCache();
    return { ok: Boolean(cached), offline: true, data: cached, error: e.message };
  }
}

module.exports = { fetchAppData };
