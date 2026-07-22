# 미요 플래너 다중 사용자 전환 — 설계 문서 (2026-07-22)

## 목적
현재 단일 사용자(공유 비밀번호 1개 + 서버에 구글 계정 1개 + localStorage 데이터)인 미요 플래너를,
**한 배포 주소에서 여러 사용자가 각자 로그인·각자 구글 캘린더·각자 데이터**를 쓰는 다중 사용자 앱으로 전환한다.

## 확정된 결정
- **로그인**: "Google로 로그인" 하나로 통일. 구글 OAuth가 신원(openid·email·profile) + 캘린더 권한을 한 번에 받음. 공유 비밀번호(APP_PASSWORD) 제거.
- **접속 범위**: 구글 계정 있는 누구나 가입·사용. (calendar는 민감 권한이라 구글 검수 전까지 "미인증 앱" 경고 + 최대 100명 제한 — 알려진 제약으로 수용.)
- **데이터 저장**: 모든 앱 데이터(To-Do·시간표·메모·설정·회의록)를 사용자별로 **서버 DB**에 저장 → 기기 간 동기화.
- **DB**: **Supabase**(Postgres). 순수 데이터베이스로만 사용(Supabase Auth 미사용). 우리 Express 서버가 연결 문자열로 `pg` 접속.

## 아키텍처

### 인증 (구글 로그인)
1. 클라이언트 "Google로 로그인" → `GET /api/auth/url`이 OAuth 동의 URL 반환(scope: openid, email, profile, calendar).
2. 콜백 `GET /api/auth/google/callback` → 코드 교환 → id_token 검증으로 `google_sub`·email·name 추출 → `users` upsert → 토큰을 `google_tokens`에 암호화 저장(기존 `crypto.js` 재사용) → **세션 쿠키에 서명된 userId** 설정 → 앱으로 리다이렉트.
3. 세션: 기존 `auth.js`의 HMAC 서명 쿠키를 확장해 payload에 `{ userId, exp }`를 담음. `requireAuth` 미들웨어가 검증하고 `req.userId`를 채움.
4. 로그아웃 `POST /api/auth/logout` → 쿠키 제거(토큰은 DB에 남김). 연동 해제는 별도(그 사용자의 `google_tokens` 삭제).

### 데이터베이스 (Supabase Postgres, `pg.Pool`)
- `users(id uuid pk, google_sub text unique, email text, name text, created_at timestamptz)`
- `google_tokens(user_id uuid pk fk→users, enc_tokens text, calendar_id text default 'primary', updated_at timestamptz)`
- `app_state(user_id uuid pk fk→users, todos jsonb, meetings jsonb, memos jsonb, timetable jsonb, settings jsonb, updated_at timestamptz)`
- 접근: `server/lib/db.js`가 `pg.Pool`(SSL) 생성, 쿼리 헬퍼 제공. 무거운 ORM 없음.
- 마이그레이션 SQL: `server/db/schema.sql` (서버 부팅 시 `CREATE TABLE IF NOT EXISTS` 실행).

### 백엔드 변경
- `getAuthedClient(userId)` → 전역 파일 대신 해당 사용자의 `google_tokens`(복호화) 로드. 갱신 토큰은 DB에 자동 저장.
- `/api/calendar/*`, `/api/gemini/*` → `requireAuth`로 보호되고 `req.userId` 기준으로 동작.
- 신설 `/api/data`:
  - `GET` → 그 사용자의 `app_state`(없으면 기본값) 반환.
  - `PUT` → 그 사용자의 `app_state` 저장(부분 병합).
- 파일 기반 `tokenStore.js` 제거. `GOOGLE_REFRESH_TOKEN`/`APP_PASSWORD`/`.enckey` 관련 경로 정리. 토큰 암호화 키는 `TOKEN_ENC_KEY`(env)로 통일.

### 프론트엔드 변경
- 로그인 화면: 비밀번호 입력 대신 **"Google로 로그인" 버튼**. 미인증 상태면 이 화면 표시.
- 데이터 계층: `useLocalStorage` → **DataContext**(서버 연동).
  - 로그인 직후 `GET /api/data`로 상태 하이드레이트.
  - 상태 변경 시 디바운스(예: 800ms) `PUT /api/data`.
  - 로딩 중 UI 처리(스켈레톤/비활성).
- **첫 로그인 마이그레이션**: 서버 `app_state`가 비어 있고 브라우저 localStorage에 기존 데이터가 있으면 → 1회 서버로 업로드 후 표시. (현재 사용자 데이터 보존.)
- `ServerStatus`에 `authenticated`, `user`(email/name) 포함. `authRequired`(공유 비번) 개념 제거.

### 데이터 흐름
클라이언트 ↔ `/api/data`(앱 상태, 사용자별) + `/api/calendar`(구글, 사용자별 토큰) + `/api/gemini`(사용자 무관, 서버 키).

## 오류 처리
- DB 연결 실패 시 명확한 503 + 한국어 메시지.
- 세션 만료/무효 → 401 → 클라이언트가 로그인 화면으로.
- 구글 토큰 만료·갱신 실패 → 재로그인 유도.
- `/api/data` 저장 충돌은 last-writer-wins(단일 사용자가 여러 탭일 때 관대하게).

## 테스트
- 세션 토큰 서명·검증(userId 포함) 단위 테스트(기존 auth 테스트 확장).
- `db.js` 데이터 접근 계층: app_state upsert/merge, 사용자 격리(다른 userId 데이터 안 보임) 테스트.
- crypto 재사용(기존 테스트 유지).
- 통합: 미인증 401, 로그인 후 본인 데이터만 접근.

## 배포 변경
- Supabase 프로젝트 생성(무료) → 연결 문자열을 Render 환경변수 `DATABASE_URL`에 추가.
- `TOKEN_ENC_KEY` 설정(토큰 암호화 키 고정 — 여러 인스턴스/재배포 대비).
- `APP_PASSWORD`, `GOOGLE_REFRESH_TOKEN` 환경변수 제거.
- 구글 OAuth 리디렉션 URI는 기존 그대로(배포 주소).

## 범위 밖(향후)
- 구글 앱 검수(100명 제한·경고 제거).
- 실시간 캘린더 동기화(폴링/웹훅).
- 계정 삭제/데이터 내보내기 UI.
