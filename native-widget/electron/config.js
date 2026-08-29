/**
 * 위젯이 쓰는 설정값(서버 주소, 구글 데스크톱 클라이언트 ID)을 한 곳에서 해결한다.
 *
 * 우선순위:
 *   1) 환경변수(MIYO_SERVER_URL / MIYO_GOOGLE_DESKTOP_CLIENT_ID) — 개발용 `.env`
 *   2) package.json의 `miyoConfig` — 설치 파일에 함께 구워지는 배포용 기본값
 *
 * `.env`는 gitignore 대상이고 electron-builder의 files 목록에도 없어서 설치된
 * 프로그램에는 존재하지 않는다. 그래서 배포 빌드에서는 반드시 2번 경로가 쓰인다.
 */
const pkg = require('../package.json');

const fallback = pkg.miyoConfig || {};

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function serverUrl() {
  return nonEmpty(process.env.MIYO_SERVER_URL) || nonEmpty(fallback.serverUrl) || 'http://localhost:3001';
}

function desktopClientId() {
  return nonEmpty(process.env.MIYO_GOOGLE_DESKTOP_CLIENT_ID) || nonEmpty(fallback.desktopClientId) || '';
}

module.exports = { serverUrl, desktopClientId };
