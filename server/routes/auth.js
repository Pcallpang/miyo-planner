import { Router } from 'express';
import {
  isGoogleConfigured,
  createOAuthClient,
  SCOPES,
  saveTokens,
  disconnect,
} from '../lib/google.js';
import { clientUrl } from '../lib/urls.js';

const router = Router();

router.get('/url', (req, res) => {
  if (!isGoogleConfigured()) {
    return res.status(503).json({
      error: '구글 OAuth 키가 설정되지 않았습니다. .env의 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET을 확인하세요.',
    });
  }
  const url = createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.json({ url });
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${clientUrl()}/?auth=error&message=${encodeURIComponent(String(error || '인증 코드가 없습니다.'))}`);
  }
  try {
    const { tokens } = await createOAuthClient().getToken(String(code));
    saveTokens(tokens);
    // 임시 디스크 호스트(예: Render 무료)에서는 재배포 시 토큰이 사라진다.
    // GOOGLE_REFRESH_TOKEN 환경변수로 고정하면 재로그인 없이 유지된다.
    if (tokens.refresh_token) {
      if (process.env.LOG_REFRESH_TOKEN === '1') {
        console.log(`[auth] GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      } else {
        console.log(
          '[auth] refresh_token 확보됨. 재배포에도 유지하려면 LOG_REFRESH_TOKEN=1로 한 번 로그인해 값을 확인한 뒤 GOOGLE_REFRESH_TOKEN에 설정하세요.',
        );
      }
    }
    res.redirect(`${clientUrl()}/?auth=success`);
  } catch (e) {
    console.error('[auth] 토큰 교환 실패:', e.message);
    res.redirect(`${clientUrl()}/?auth=error&message=${encodeURIComponent('토큰 교환에 실패했습니다.')}`);
  }
});

router.post('/logout', (req, res) => {
  disconnect();
  res.json({ ok: true });
});

export default router;
