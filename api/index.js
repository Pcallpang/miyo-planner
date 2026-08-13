/**
 * Vercel 서버리스 함수 엔트리포인트.
 *
 * Express 앱은 (req, res) 시그니처라 Node 런타임 핸들러로 그대로 쓸 수 있다.
 * vercel.json의 rewrite가 /api/* 요청 전부를 이 함수로 보내므로,
 * 경로 분기는 app.js에 등록된 라우터들이 그대로 처리한다.
 *
 * 주의: 여기서 initDb()를 부르지 않는다. 콜드 스타트마다 DDL이 돌면
 * 느려지고 동시 실행 시 충돌한다. 스키마 변경은 `npm run db:migrate`로 따로.
 */
export { default } from '../server/app.js';
