import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { initDb, getUserById, getUserGeminiKeyEnc } = await import('./lib/db.js');
const { isGoogleConfigured, hasTokensForUser } = await import('./lib/google.js');
const { sessionUserId } = await import('./lib/auth.js');
const { default: authRouter } = await import('./routes/auth.js');
const { default: calendarRouter } = await import('./routes/calendar.js');
const { default: geminiRouter } = await import('./routes/gemini.js');
const { default: dataRouter } = await import('./routes/data.js');
const { default: schoolRouter } = await import('./routes/school.js');

if (process.env.NODE_ENV === 'production') {
  for (const k of ['SESSION_SECRET', 'TOKEN_ENC_KEY', 'DATABASE_URL']) {
    if (!process.env[k]) { console.error(`[server] 필수 환경변수 ${k}가 없습니다.`); process.exit(1); }
  }
}

await initDb();

const app = express();
app.use(express.json({ limit: '1mb' }));

function requireAuth(req, res, next) {
  const userId = sessionUserId(req);
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다.' });
  req.userId = userId;
  next();
}

app.get('/api/status', async (req, res) => {
  const userId = sessionUserId(req);
  const user = userId ? await getUserById(userId) : null;
  const geminiUserKey = userId ? Boolean(await getUserGeminiKeyEnc(userId)) : false;
  res.json({
    googleConfigured: isGoogleConfigured(),
    // 사용자 본인 키 또는 서버 기본 키가 있으면 사용 가능
    geminiConfigured: geminiUserKey || Boolean(process.env.GEMINI_API_KEY),
    geminiUserKey,
    authenticated: Boolean(userId),
    connected: userId ? await hasTokensForUser(userId) : false,
    email: user?.email ?? null,
  });
});

app.use('/api/auth', authRouter);            // /url, /callback은 공개; 나머지 라우트는 내부에서 처리
app.use('/api/calendar', requireAuth, calendarRouter);
app.use('/api/gemini', requireAuth, geminiRouter);
app.use('/api/data', requireAuth, dataRouter);
app.use('/api/school', requireAuth, schoolRouter);

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); });

const DIST = path.resolve(__dirname, '../client/dist');
const INDEX_HTML = path.join(DIST, 'index.html');
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(INDEX_HTML));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => console.log(`[server] 포트 ${port} 실행 중 (0.0.0.0)`));
