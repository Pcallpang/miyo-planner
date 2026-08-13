import { Router } from 'express';
import { getAuthedClient } from '../lib/google.js';

const router = Router();

/** 자리배치 앱 주소. 배포처가 바뀌면 SEATING_APP_URL로 덮어쓴다. */
export function seatingAppUrl() {
  return (process.env.SEATING_APP_URL || 'https://sn-aseating.vercel.app').replace(/\/$/, '');
}

/**
 * 자리배치 앱에 넘길 구글 id_token을 발급한다.
 *
 * 자리배치는 별도 Supabase 프로젝트를 쓰는 독립 배포라서 플래너의 세션 쿠키를
 * 읽을 수 없다. 대신 이 토큰을 URL fragment로 건네받아 supabase의
 * signInWithIdToken()으로 자기 세션을 만든다.
 *
 * 저장된 id_token은 이미 만료됐을 수 있으므로(수명 1시간) 매번 refresh해서
 * 새로 받는다. SCOPES에 openid가 있어 refresh 응답에 id_token이 딸려온다.
 * 갱신된 자격증명은 getAuthedClient가 등록해둔 'tokens' 핸들러가 알아서 저장한다.
 */
router.get('/token', async (req, res, next) => {
  try {
    const client = await getAuthedClient(req.userId);
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.id_token) {
      return res.status(502).json({ error: '구글 인증 토큰을 받지 못했습니다. 환경 설정에서 구글 연결을 다시 해주세요.' });
    }
    res.json({ idToken: credentials.id_token, appUrl: seatingAppUrl() });
  } catch (e) {
    if (e.status === 401) return res.status(401).json({ error: e.message });
    next(e);
  }
});

export default router;
