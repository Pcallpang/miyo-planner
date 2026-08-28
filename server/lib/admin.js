const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** "미요쌤에게 원해요!" 게시판에서 남의 글 삭제·완료 처리를 할 수 있는 관리자인지 —
 *  ADMIN_EMAIL 환경변수(콤마로 여러 개 가능)에 등록된 이메일만 해당한다. */
export function isAdminEmail(email) {
  return Boolean(email) && ADMIN_EMAILS.includes(email.toLowerCase());
}
