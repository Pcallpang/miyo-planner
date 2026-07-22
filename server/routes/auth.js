import { Router } from 'express';
import {
  isGoogleConfigured, createOAuthClient, SCOPES, profileFromIdToken, saveTokensForUser,
} from '../lib/google.js';
import { upsertUser, deleteUserTokens } from '../lib/db.js';
import { makeSessionToken, sessionUserId } from '../lib/auth.js';
import { clientUrl, isSecureOrigin } from '../lib/urls.js';

const router = Router();

function setSessionCookie(res, userId) {
  const parts = [`session=${makeSessionToken(userId)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`];
  if (isSecureOrigin()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

router.get('/url', (req, res) => {
  if (!isGoogleConfigured()) return res.status(503).json({ error: '구글 OAuth 키가 설정되지 않았습니다.' });
  const url = createOAuthClient().generateAuthUrl({
    access_type: 'offline', prompt: 'consent', scope: SCOPES,
  });
  res.json({ url });
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect(`${clientUrl()}/?auth=error`);
  try {
    const { tokens } = await createOAuthClient().getToken(String(code));
    const { sub, email, name } = profileFromIdToken(tokens.id_token);
    if (!sub) throw new Error('id_token 없음');
    const user = await upsertUser({ googleSub: sub, email, name });
    await saveTokensForUser(user.id, tokens);
    setSessionCookie(res, user.id);
    res.redirect(`${clientUrl()}/?auth=success`);
  } catch (e) {
    console.error('[auth] 로그인 실패:', e.message);
    res.redirect(`${clientUrl()}/?auth=error`);
  }
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

router.post('/disconnect', async (req, res) => {
  const userId = sessionUserId(req);
  if (userId) await deleteUserTokens(userId);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

export default router;
