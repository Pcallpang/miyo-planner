# 네이티브 데스크톱 위젯(Electron) 설계

## 배경

브라우저 팝업창 위젯(`?widget=1`, `WidgetView.tsx`)으로 오늘의 시간표를 바탕화면에
띄우는 기능을 이미 구현했으나, 사용자는 "글래스모피즘 뒤로 실제 데스크톱 배경/다른
창이 비치는" 진짜 투명 효과를 원했다. 브라우저에서 렌더링되는 페이지(일반 탭,
`window.open` 팝업, 설치된 PWA 포함)는 어떤 방식으로도 OS 수준의 창 투명도·배경
패스스루를 구현할 수 없다 — 이는 웹 기술의 근본적 한계다. 따라서 별도의 네이티브
데스크톱 프로그램(Electron)을 새로 만들어, 브라우저 밖에서 진짜 투명 창을 띄운다.

## 목표

- 오늘의 시간표를 완전 투명 배경의 항상-위(always-on-top) 위젯 창으로 바탕화면에
  표시한다 — 창 뒤의 실제 데스크톱/다른 프로그램이 그대로 비친다.
- 기존 웹앱(`planner`)의 서버(Express + Postgres)와 데이터를 그대로 재사용한다.
  네이티브 앱은 별도 DB를 두지 않는다.
- 네이티브 앱 안에서 한 번 구글 로그인을 하면, 이후에는 자동으로 로그인된 채로
  실행된다.
- 완성 후 기존 브라우저 팝업 위젯 기능은 제거한다(별도 커밋으로).

## 비목표(이번 설계에서 다루지 않음)

- 블러(뿌옇게 흐려 보이는) 효과 — 완전 투명(선명하게 비침)으로 한정한다.
  블러/아크릴 효과는 Windows 버전별 안정성 문제와 추가 네이티브 모듈이 필요해
  이번 범위에서 제외한다.
- macOS/Linux 지원 — Windows 전용으로 한정한다(사용자 환경이 win32).
- 시간표 외 다른 화면(달력, 메모 등) — 오늘의 시간표만 표시한다.
- 코드서명 인증서 구매 — 설치 시 Windows SmartScreen "알 수 없는 게시자" 경고는
  그대로 감수한다.

## 아키텍처 개요

```
planner/                          (기존 웹앱 저장소, 그대로 유지)
  server/                         (기존 서버, 신규 엔드포인트 1개만 추가)
  client/                         (기존 웹앱 — 위젯 관련 코드는 이후 별도 커밋으로 제거)
  native-widget/                  (신규 Electron 프로젝트)
    electron/
      main.js                     투명창 생성, 트레이, 자동실행, 로그인 흐름 조율
      preload.js                  렌더러 ↔ 메인 프로세스 IPC 브릿지
      auth.js                     루프백 로그인 서버, 토큰 암호화 저장/조회
    src/
      App.tsx                     오늘의 시간표 렌더링(기존 WidgetView.tsx 로직 이식)
      main.tsx
    package.json
    electron-builder.yml
```

네이티브 앱은 기존 서버의 `/api/data`(시간표 등 조회)를 그대로 호출한다. 인증은
쿠키 대신 저장해둔 세션 토�큰을 매 요청마다 `Cookie: session=<token>` 헤더로 직접
실어 보낸다(자세한 내용은 "로그인 흐름" 참고).

## 화면(렌더러)

- `native-widget/src/App.tsx`는 `planner/client/src/views/WidgetView.tsx`의 렌더링
  로직(교시별 카드, 현재 교시 강조, 점심/보강/휴강 표시, 과목 색상)을 그대로
  이식한다. `client/src/lib/schedule.ts`, `subjectProgress.ts`, `subjectColors.ts`의
  순수 함수는 `native-widget`에 복사해 사용한다(별도 npm 패키지로 공유하지 않음 —
  두 프로젝트가 독립적으로 배포되므로 결합도를 낮춘다. 추후 로직이 갈라지면
  각자 프로젝트에서 수정한다).
- 배경은 완전 투명: 최상위 컨테이너에 `background: transparent`만 두고, 브라우저
  팝업 위젯에 있던 `bg-gradient-to-br`/`backdrop-blur-xl`/`bg-white/35` 카드 배경을
  전부 제거한다. 텍스트 가독성을 위해 텍스트에 그림자(`text-shadow`)를 준다.
- 창은 `frame: false`라 타이틀바가 없다 — 위젯 상단 여백 영역을 `-webkit-app-region:
  drag`로 지정해 마우스로 위치를 옮길 수 있게 한다. 크기 조절은 Electron의
  `resizable: true` 기본 동작(모서리 드래그)을 사용한다.
- 창 크기/위치는 종료 시 저장해뒀다가 다음 실행 때 복원한다(Electron
  `electron-store`로 로컬 JSON 저장).

## 로그인 흐름

**신규 구글 OAuth 클라이언트:** 기존 웹앱은 "웹 애플리케이션" 타입 클라이언트를
쓰는데, 데스크톱 앱은 별도의 "데스크톱 앱" 타입 클라이언트가 필요하다(리디렉션
URI가 `http://127.0.0.1:*` 루프백이어야 하는데, 이건 데스크톱 앱 타입에서만
허용된다). 구글 클라우드 콘솔에서 새로 발급받아 `GOOGLE_DESKTOP_CLIENT_ID`/
`GOOGLE_DESKTOP_CLIENT_SECRET` 서버 환경변수로 추가한다(발급은 무료 — 실제 착수
시 단계별로 안내).

**흐름:**
1. 사용자가 위젯의 "로그인" 버튼(또는 트레이 메뉴)을 누른다.
2. Electron 메인 프로세스가 로컬에 임시 HTTP 서버를 열고(포트는 OS가 자동 할당),
   `shell.openExternal()`로 시스템 기본 브라우저에 구글 로그인 URL을 연다
   (`redirect_uri=http://127.0.0.1:<임시포트>`, PKCE 사용).
3. 로그인 완료 후 브라우저가 그 루프백 주소로 이동하며 `code`를 전달 → 임시 서버가
   이를 받고 "로그인 완료, 이 창을 닫아도 됩니다" 안내 페이지를 띄운 뒤 스스로
   종료된다.
4. Electron 메인 프로세스가 받은 `code`를 기존 서버의 신규 엔드포인트
   `POST /api/auth/native-login`으로 전달한다.
5. 서버는 `code`를 데스크톱 클라이언트로 구글과 교환해 `id_token`을 얻고, 기존
   `upsertUser`/`saveTokensForUser`(재사용)로 사용자를 저장한 뒤, 기존
   `makeSessionToken(userId)`로 세션 토큰을 만들어 **쿠키가 아니라 JSON 응답 바디로**
   돌려준다(`{ token, user }`).
6. Electron은 이 토큰을 `safeStorage.encryptString()`(윈도우 자격 증명 저장소 기반,
   추가 네이티브 모듈 불필요)으로 암호화해 로컬 파일에 저장한다.
7. 이후 서버 API 호출 시 매번 `Cookie: session=<복호화한 토큰>` 헤더를 직접 실어
   보낸다. 앱 시작 시 저장된 토큰이 있으면 자동으로 로그인된 상태로 뜬다.
8. 로그아웃(트레이 메뉴)은 로컬에 저장된 토큰 파일만 지운다(서버 세션 무효화는
   기존 `/api/auth/logout`을 호출해 처리).

**서버 변경 범위:** `server/routes/auth.js`에 `POST /api/auth/native-login` 라우트
하나 추가. 기존 `createOAuthClient`/`profileFromIdToken`/`upsertUser`/
`saveTokensForUser`/`makeSessionToken`을 그대로 재사용하되, 데스크톱 클라이언트
자격증명으로 토큰 교환하는 부분만 다르다(`google.js`에 데스크톱용 OAuth2Client
생성 함수 하나 추가).

## 트레이 · 자동 실행

- `Tray` 아이콘(작업표시줄 알림영역) 상시 표시. 좌클릭: 위젯 보이기/숨기기 토글.
  우클릭 메뉴: "위젯 보이기/숨기기", "로그인 상태: OO님" 또는 "로그인", "로그아웃",
  "윈도우 시작 시 자동 실행" (체크 토글), "종료".
- 자동 실행은 `app.setLoginItemSettings({ openAtLogin: true })`로 구현(레지스트리를
  직접 건드리지 않는 Electron 표준 API). 첫 로그인 성공 시 기본으로 켜고, 트레이
  메뉴에서 언제든 끌 수 있다.

## 패키징

- `electron-builder`로 NSIS 설치 파일(.exe) 빌드. `native-widget/electron-builder.yml`
  에 `target: nsis`, `win.certificateFile` 미설정(서명 안 함).
- 설치 파일 실행 시 SmartScreen 경고가 뜰 수 있음 — README/설치 안내 문서에
  "추가 정보 → 실행"으로 넘어가는 방법을 안내한다.
- 앱 데이터(암호화된 로그인 토큰, 창 크기/위치)는 Electron 기본 `userData` 경로
  (`%APPDATA%/miyo-native-widget/`)에 저장한다.

## 데이터 갱신

- 브라우저 팝업 위젯과 동일한 정책: 창이 포커스를 받을 때 + 5분마다
  `GET /api/data`를 다시 호출해 최신 시간표를 반영한다.
- 네트워크 오류 시(서버 응답 실패) 마지막으로 성공한 데이터를 계속 보여주고,
  위젯 우측 상단에 작은 오프라인 표시(●)를 띄운다.

## 기존 팝업 위젯 정리 (후속 작업, 별도 커밋)

네이티브 앱이 정상 동작 확인되면 다음을 제거한다:
- `client/src/views/WidgetView.tsx`
- `client/src/lib/widgetPrefs.ts`, `widgetPrefs.test.ts`
- `App.tsx`의 `?widget=1` 분기 라우팅
- `SettingsView.tsx`의 "위젯 열기/닫기" 버튼

이 정리는 네이티브 앱 구현·테스트가 끝난 뒤 별도 계획/커밋으로 진행한다(이번
설계·계획의 범위 밖).

## 에러 처리

- 로그인 실패(사용자가 구글 로그인 취소, 네트워크 오류 등): 위젯에 "로그인이
  필요해요" 안내와 로그인 버튼만 표시. 임시 루프백 서버는 60초 타임아웃 후 스스로
  정리된다.
- 서버(`planner` 백엔드) 연결 실패: 마지막 캐시 데이터 + 오프라인 표시(위 "데이터
  갱신" 참고).
- 저장된 토큰 복호화 실패(예: 다른 PC로 파일만 복사한 경우 — `safeStorage`는
  OS/계정에 종속): 토큰을 버리고 로그인 화면으로 되돌린다.

## 테스트 방침

- 시간표 렌더링 로직(교시 계산, 색상, 보강/휴강 표시)은 `native-widget/src`에
  이식한 순수 함수 단위로 vitest 테스트를 작성한다(기존 `client`의 동일 로직
  테스트를 참고해 이식).
- Electron 메인 프로세스(투명창 생성, 트레이, 로그인 흐름)는 자동화 테스트 대신
  수동 검증 체크리스트로 확인한다(Electron 앱의 창 투명도·트레이·OS 자동실행은
  일반적으로 E2E 자동화 비용 대비 효용이 낮음): 설치 → 로그인 → 투명 확인 →
  트레이 토글 → 재부팅 후 자동 실행 확인.
