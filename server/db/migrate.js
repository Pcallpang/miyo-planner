/**
 * 스키마 마이그레이션을 한 번 실행하고 종료한다. `npm run db:migrate`
 *
 * 서버리스 배포에서는 앱 기동 시점에 DDL을 돌릴 수 없으므로(콜드 스타트마다
 * 실행되고 동시 실행 시 충돌한다) 스키마 변경은 이 스크립트로 따로 적용한다.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { initDb, pool } = await import('../lib/db.js');

if (!process.env.DATABASE_URL) {
  console.error('[migrate] DATABASE_URL이 없습니다.');
  process.exit(1);
}

try {
  await initDb();
  console.log('[migrate] 스키마 적용 완료');
} catch (e) {
  console.error('[migrate] 실패:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
