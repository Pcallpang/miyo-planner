const { app, shell, safeStorage } = require('electron');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { generateCodeVerifier, codeChallengeFromVerifier } = require('./pkce');
const { serverUrl, desktopClientId } = require('./config');

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

function autoStartChoicePath() {
  return path.join(app.getPath('userData'), 'autostart-choice.json');
}

/** 사용자가 "윈도우 시작 시 자동 실행"을 명시적으로 고른 값을 돌려준다.
 *  한 번도 고른 적이 없으면 null(= 아직 선택 기록 없음). */
function getAutoStartChoice() {
  try {
    const parsed = JSON.parse(fs.readFileSync(autoStartChoicePath(), 'utf-8'));
    return typeof parsed?.enabled === 'boolean' ? parsed.enabled : null;
  } catch {
    return null;
  }
}

/** 사용자의 자동 실행 선택을 파일에 기록한다. */
function setAutoStartChoice(enabled) {
  try {
    fs.writeFileSync(autoStartChoicePath(), JSON.stringify({ enabled: Boolean(enabled) }));
  } catch { /* 기록 실패는 치명적이지 않으므로 무시 */ }
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

      const replyPage = (heading, body) => {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:sans-serif;padding:40px"><h2>${heading}</h2><p>${body}</p></body></html>`);
      };

      if (settled) { replyPage('이미 처리된 요청입니다', '이 창은 닫아도 됩니다.'); return; }
      settled = true;
      clearTimeout(timeout);
      server.close();

      // 성공/실패를 먼저 판별한 뒤에 그에 맞는 안내 페이지를 보여준다.
      if (err || !code || returnedState !== state) {
        replyPage('로그인하지 못했어요', '로그인이 취소되었거나 실패했습니다. 이 창을 닫고 위젯에서 다시 시도해 주세요.');
        reject(new Error('로그인이 취소되었거나 실패했습니다.'));
        return;
      }
      replyPage('로그인 완료', '이 창은 닫아도 됩니다.');
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

module.exports = { login, saveToken, loadToken, clearToken, getAutoStartChoice, setAutoStartChoice };
