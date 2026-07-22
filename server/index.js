import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { default: authRouter } = await import('./routes/auth.js');
const { default: calendarRouter } = await import('./routes/calendar.js');
const { default: geminiRouter } = await import('./routes/gemini.js');
const { isGoogleConfigured, hasTokens, getSavedEmail } = await import('./lib/google.js');
const { authEnabled, isAuthed, checkPassword, makeSessionToken } = await import('./lib/auth.js');
const { isSecureOrigin } = await import('./lib/urls.js');

const app = express();
app.use(express.json({ limit: '1mb' }));

const SESSION_COOKIE = 'session';

function setSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE}=${makeSessionToken()}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${30 * 24 * 60 * 60}`,
  ];
  if (isSecureOrigin()) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

// ── 공개 엔드포인트 (인증 불필요) ──────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    googleConfigured: isGoogleConfigured(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    connected: hasTokens(),
    email: getSavedEmail(),
    authRequired: authEnabled(),
    authenticated: isAuthed(req),
  });
});

app.post('/api/session/login', (req, res) => {
  if (!authEnabled()) return res.json({ ok: true }); // 게이트 미설정 시 통과
  if (checkPassword(req.body?.password)) {
    setSessionCookie(res);
    return res.json({ ok: true });
  }
  res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
});

app.post('/api/session/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ── 보호 엔드포인트 (인증 필요) ───────────────────────────────────
app.use('/api/auth', requireAuth, authRouter);
app.use('/api/calendar', requireAuth, calendarRouter);
app.use('/api/gemini', requireAuth, geminiRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// ── 프로덕션: 빌드된 프론트엔드 정적 서빙 (같은 오리진) ──────────────
const DIST = path.resolve(__dirname, '../client/dist');
const INDEX_HTML = path.join(DIST, 'index.html');
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(DIST));
  // SPA 폴백: /api 외의 GET은 index.html로
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(INDEX_HTML));
}

const port = Number(process.env.PORT) || 3001;
// 0.0.0.0에 명시적으로 바인딩해야 Render 등 호스트가 포트를 감지·라우팅할 수 있다.
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] 포트 ${port} 에서 실행 중 (0.0.0.0)`);
});
