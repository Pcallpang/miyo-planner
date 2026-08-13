/**
 * 배포 환경에 맞는 공개 주소를 계산한다.
 * 우선순위: 명시 env > 플랫폼 제공 env > 로컬 기본값.
 *
 * VERCEL_URL은 배포마다 값이 바뀌는 미리보기 주소라 최후의 수단이다.
 * 프로덕션에서는 PUBLIC_URL에 고정 도메인을 반드시 지정해야 한다 —
 * 이 값이 OAuth 리디렉션 URI와 세션 쿠키의 Secure 플래그를 결정한다.
 */
export function publicUrl() {
  const explicit = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
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
