# 하루 플래너 — 설계 문서 (2026-07-21)

## 목적
고등학교 교사 1인이 사용하는 개인 생산성 웹앱. 일정·To-Do 관리, 구글 캘린더 양방향 연동,
학교 쪽지를 Gemini로 요약·구조화해 캘린더에 등록하는 기능을 제공한다. UI는 전부 한국어.

## 아키텍처
- **모노레포** (npm workspaces): `client/`(React+Vite+TS+Tailwind v4) + `server/`(Express, ESM JS)
- `npm run dev` 하나로 concurrently가 서버(3001)와 클라이언트(5173)를 동시 실행.
  Vite dev proxy가 `/api` → `http://localhost:3001` 전달 (CORS 불필요).
- 비밀키(구글 OAuth 클라이언트 시크릿, Gemini API 키)는 루트 `.env`에만 존재, 서버만 읽음.
- 키가 없어도 서버·UI는 뜨고, `/api/status`가 configured 플래그를 내려줘 UI가 안내를 표시.

## 데이터 소유권
- **구글 캘린더가 일정의 원본(source of truth)**. 캘린더 일정 CRUD는 전부 Google Calendar API 경유.
- 앱 자체 데이터(To-Do, 시간표, 메모, 회의록, 설정)는 localStorage.
- 회의록은 localStorage에 저장하되 "구글 캘린더에도 등록" 옵션 시 이벤트 생성(googleEventId 보관).

## 서버 API
- `GET /api/status` → { googleConfigured, geminiConfigured, connected, email }
- `GET /api/auth/url` → OAuth 동의 URL / `GET /api/auth/google/callback` → 토큰 교환·저장 후 클라이언트로 리다이렉트
- `POST /api/auth/logout` → 토큰 파일 삭제
- `GET /api/calendar/calendars` → 캘린더 목록
- `GET /api/calendar/events?calendarId&timeMin&timeMax` / `POST /api/calendar/events` /
  `PATCH /api/calendar/events/:id` / `DELETE /api/calendar/events/:id?calendarId=`
- `POST /api/gemini/parse` { text } → { events: ParsedEvent[] } — 오늘 날짜(Asia/Seoul)를 프롬프트에 포함,
  responseMimeType=application/json으로 구조화 추출. 여러 일정 분리, 애매하면 needsConfirmation=true.
- 토큰은 `server/data/tokens.json`(gitignore)에 저장, googleapis의 tokens 이벤트로 갱신분 자동 저장.

## 클라이언트 구조
- 상태: AppContext(연동 상태, 이벤트 캐시, 캘린더 목록, 설정, 토스트). 뷰 전환은 state 기반(라우터 없음).
- 뷰: 대시보드 / 오늘의 시간표 / 월간 일정 / 간단 메모 / 타이머 / 환경 설정
- 레이아웃: 좌 사이드바(메뉴 + 쪽지 붙여넣기 버튼) / 중앙(주간 요약, 월 캘린더) /
  우측(실시간 일과, 데일리 To-Do, 회의록&일정). 헤더에 날짜·실시간 시계·구글 연동 버튼.
- 쪽지 붙여넣기: 전역 모달. 붙여넣기 → Gemini 분석 → 편집 가능한 미리보기 카드 → 건별/일괄 "캘린더에 등록".
  자동 등록 없음(미리보기 필수), 성공/실패를 카드별로 표시.
- To-Do: 업무/교과/개인 탭(미완료 개수), 마감일 선택, 역산 템플릿(D-7/D-3/D-1/D-day 자동 생성).
- 시간표: 교시 수·교시별 시각(전 요일 공통, 설정과 공유), 요일별 과목/교실. 실시간 일과 카드가 이 데이터로
  일과 전/n교시/쉬는 시간/일과 후/주말 판정.
- 디자인: 오프화이트 배경, 민트/틸 포인트, rounded-2xl 카드, Pretendard(CDN), lucide-react 아이콘.

## 오류 처리
- 서버는 실패 시 { error: 한국어 메시지 } + 적절한 상태코드. 키 미설정 시 503과 안내 메시지.
- 클라이언트는 토스트로 성공/실패 표시. 미연동 상태에서 캘린더 쓰기 UI는 비활성화 + 안내.

## 검증
- `tsc --noEmit` + `vite build` 통과, 서버 기동 후 `/api/status` 응답 확인.
