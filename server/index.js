/**
 * 로컬 개발용 서버 기동 스크립트.
 *
 * 배포(Vercel)는 이 파일을 쓰지 않는다 — `api/index.js`가 `server/app.js`를
 * 서버리스 핸들러로 내보내고, 프론트엔드는 Vercel이 직접 서빙한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// app.js가 dotenv를 로드하므로 반드시 먼저 import한다.
const { default: app } = await import('./app.js');
const { initDb } = await import('./lib/db.js');

// 개발 편의: 기동할 때마다 스키마를 맞춰둔다.
// (배포 환경에서는 `npm run db:migrate`로 따로 실행한다 — server/db/migrate.js)
await initDb();

const DIST = path.resolve(__dirname, '../client/dist');
const INDEX_HTML = path.join(DIST, 'index.html');
if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(INDEX_HTML));
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, '0.0.0.0', () => console.log(`[server] 포트 ${port} 실행 중 (0.0.0.0)`));
