const { app, shell, safeStorage } = require('electron');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { generateCodeVerifier, codeChallengeFromVerifier } = require('./pkce');

function serverUrl() {
  return process.env.MIYO_SERVER_URL || 'http://localhost:3001';
}
function desktopClientId() {
  return process.env.MIYO_GOOGLE_DESKTOP_CLIENT_ID || '';
}

function tokenFilePath() {
  return path.join(app.getPath('userData'), 'session.token');
}

function saveToken(token) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('이 컴퓨터에서는 로그인 정보를 안전하게 저장할 수 없습니다.');
  fs.writeFileSync(tokenFilePath(), safeStorage.encryptString(token));
}

function loadToken() {
  try {
    return safeStorage.decryptString(fs.readFileSync(tokenFilePath()));
  } catch {
    return null;
  }
}

function clearToken() {
  try { fs.unlinkSync(tokenFilePath()); } catch { /* 이미 없으면 무시 */ }
}

function firstLoginMarkerPath() {
  return path.join(app.getPath('userData'), 'has-logged-in-before');
}

function hasEverLoggedIn() {
  return fs.existsSync(firstLoginMarkerPath());
}

function markEverLoggedIn() {
  fs.writeFileSync(firstLoginMarkerPath(), '');
}

/** 루프백 서버를 열어 구글 로그인 리디렉션을 받고, 성공하면 세션 토큰을 저장한다. */
function login() {
  return new Promise((resolve, reject) => {
    const verifier = generateCodeVerifier();
    const challenge = codeChallengeFromVerifier(verifier);
    const state = crypto.randomBytes(16).toString('hex');
    let settled = false;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const err = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>로그인 완료</h2><p>이 창은 닫아도 됩니다.</p></body></html>');

      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();

      if (err || !code || returnedState !== state) {
        reject(new Error('로그인이 취소되었거나 실패했습니다.'));
        return;
      }
      try {
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const resp = await fetch(`${serverUrl()}/api/auth/native-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri, codeVerifier: verifier }),
        });
        const body = await resp.json();
        if (!resp.ok) throw new Error(body.error || '로그인에 실패했습니다.');
        saveToken(body.token);
        resolve(body);
      } catch (e) {
        reject(e);
      }
    });

    server.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(e);
    });

    let port;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      server.close();
      reject(new Error('로그인 시간이 초과되었습니다.'));
    }, 60_000);

    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', desktopClientId());
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      shell.openExternal(authUrl.toString());
    });
  });
}

module.exports = { login, saveToken, loadToken, clearToken, hasEverLoggedIn, markEverLoggedIn };
