/**
 * Express 앱 구성만 담당한다 — listen도, 정적 파일 서빙도 하지 않는다.
 *
 * 로컬 개발은 `server/index.js`가 이 앱에 정적 서빙과 listen을 얹어 쓰고,
 * Vercel 배포는 `api/index.js`가 이 앱을 서버리스 핸들러로 그대로 내보낸다.
 * (프론트엔드는 Vercel이 CDN에서 직접 서빙하므로 서버가 관여하지 않는다.)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 아래 모듈들은 로드 시점에 process.env를 읽으므로 dotenv 이후에 import해야 한다.
const { getUserById, getUserGeminiKeyEnc } = await import('./lib/db.js');
const { isGoogleConfigured, hasTokensForUser } = await import('./lib/google.js');
const { sessionUserId } = await import('./lib/auth.js');
const { default: authRouter } = await import('./routes/auth.js');
const { default: calendarRouter } = await import('./routes/calendar.js');
const { default: geminiRouter } = await import('./routes/gemini.js');
const { default: dataRouter } = await import('./routes/data.js');
const { default: schoolRouter } = await import('./routes/school.js');
const { checkNeisKey } = await import('./lib/neis.js');
const { default: seatingRouter } = await import('./routes/seating.js');
const { default: procurementRouter } = await import('./routes/procurement.js');
const { default: boardRouter } = await import('./routes/board.js');

checkNeisKey();

if (process.env.NODE_ENV === 'production') {
  for (const k of ['SESSION_SECRET', 'TOKEN_ENC_KEY', 'DATABASE_URL']) {
    if (!process.env[k]) { console.error(`[server] 필수 환경변수 ${k}가 없습니다.`); process.exit(1); }
  }
}

const app = express();
// 품의서 상품 캡쳐 이미지(base64)를 담아 보내므로 기존 1mb보다 넉넉하게 잡는다.
app.use(express.json({ limit: '8mb' }));

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
app.use('/api/seating', requireAuth, seatingRouter);
app.use('/api/procurement', requireAuth, procurementRouter);
app.use('/api/board', requireAuth, boardRouter);

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); });

export default app;
