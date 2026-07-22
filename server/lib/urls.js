/**
 * 배포 환경에 맞는 공개 주소를 계산한다.
 * 우선순위: 명시 env > 플랫폼 제공 env(RENDER_EXTERNAL_URL) > 로컬 기본값.
 */
export function publicUrl() {
  const explicit = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const port = Number(process.env.PORT) || 3001;
  return `http://localhost:${port}`;
}

/** OAuth 콜백 리디렉션 URI. */
export function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || `${publicUrl()}/api/auth/google/callback`;
}

/** 로그인 완료 후 사용자를 돌려보낼 프론트엔드 주소. */
export function clientUrl() {
  return process.env.CLIENT_URL || publicUrl();
}

/** 공개 주소가 https인지(쿠키 Secure 플래그 판단용). */
export function isSecureOrigin() {
  return publicUrl().startsWith('https://');
}
