# 미요 플래너 🌿

고등학교 교사를 위한 개인 일정·To-Do 관리 웹앱입니다.

- **구글 캘린더 양방향 연동** — 앱에서 만든 일정이 실제 구글 캘린더에 등록되고, 기존 일정도 앱에 표시됩니다.
- **쪽지 → Gemini 자동 일정 추출** — 학교 안내문·쪽지를 붙여넣으면 Gemini가 일정을 추출하고, 미리보기에서 확인·수정 후 캘린더에 등록합니다.
- 데일리 To-Do(업무/교과/개인), 오늘의 시간표 + 실시간 일과 상태, 회의록, 간단 메모, 타이머.

기술 스택: React + Vite + TypeScript + Tailwind CSS / Node.js + Express / Google Calendar API + Gemini API

> API 키·시크릿은 전부 서버(`.env`)에만 보관되며 브라우저에 노출되지 않습니다.

---

## 1. 필요한 키와 발급 방법

### ① 구글 OAuth 클라이언트 (캘린더 연동용)

1. [Google Cloud Console](https://console.cloud.google.com)에 접속해 **새 프로젝트**를 만듭니다.
2. **API 및 서비스 → 라이브러리**에서 **Google Calendar API**를 검색해 **사용 설정**합니다.
3. **API 및 서비스 → OAuth 동의 화면**
   - User Type: **외부(External)** 선택 → 앱 이름·이메일 입력
   - **테스트 사용자**에 본인 구글 계정(이메일)을 추가합니다. (게시 전에는 테스트 사용자만 로그인 가능)
4. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 리디렉션 URI**에 다음을 추가:
     ```
     http://localhost:3001/api/auth/google/callback
     ```
5. 생성된 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 복사해 둡니다.

### ② Gemini API 키 (쪽지 요약용)

1. [Google AI Studio](https://aistudio.google.com/apikey)에 접속합니다.
2. **API 키 만들기**를 눌러 키를 발급받아 복사해 둡니다.

---

## 2. `.env` 설정

프로젝트 루트에서 예시 파일을 복사한 뒤 값을 채웁니다.

```powershell
copy .env.example .env
```

```dotenv
GOOGLE_CLIENT_ID=발급받은_클라이언트_ID
GOOGLE_CLIENT_SECRET=발급받은_클라이언트_시크릿
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

GEMINI_API_KEY=발급받은_Gemini_키
# 무료 등급 키는 gemini-flash-lite-latest 사용을 권장합니다.
GEMINI_MODEL=gemini-flash-lite-latest

# Supabase(Postgres) 연결 문자열 — 반드시 Session pooler(포트 5432) 사용.
# Transaction pooler(포트 6543)는 인증이 거부되어 동작하지 않습니다.
DATABASE_URL=postgresql://...pooler.supabase.com:5432/postgres

PORT=3001
CLIENT_URL=http://localhost:5173
```

> 구글/Gemini 키를 아직 넣지 않아도 앱은 실행됩니다. 연동 기능만 비활성화된 상태로 표시되며,
> 키를 넣고 서버를 재시작하면 바로 동작합니다. 단, `DATABASE_URL`은 사용자 데이터 저장에 필수이므로
> 반드시 Supabase 프로젝트를 만들어 연결해야 합니다 (자세한 절차는 `DEPLOY.md` 참고).

---

## 3. 실행 방법

Node.js 20 이상이 필요합니다.

```powershell
# 1) 의존성 설치 (최초 1회)
npm install

# 2) 개발 서버 실행 (백엔드 + 프론트 동시 실행)
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3001

브라우저에서 http://localhost:5173 을 열고, **구글 로그인** 버튼으로 로그인합니다.
로그인한 구글 계정을 기준으로 To-Do·시간표·메모 등 모든 데이터가 서버(Supabase)에
사용자별로 저장되며, 캘린더 연동도 이 계정으로 진행됩니다. 여러 사람이 같은 배포 주소를
사용해도 각자 자신의 구글 계정으로 로그인하는 한 데이터는 서로 섞이지 않습니다.

---

## 4. 사용 팁

- **쪽지 붙여넣기**: 사이드바 상단 버튼 → 안내문 붙여넣기 → *Gemini로 일정 추출* →
  추출된 카드에서 날짜·시간 확인/수정 → **캘린더에 등록**. (확인 전에는 절대 자동 등록되지 않습니다)
- **날짜·시간 확인 필요** 배지가 붙은 카드는 Gemini가 날짜를 추정한 항목이니 꼭 확인하세요.
- 사용할 캘린더는 **환경 설정 → 사용할 캘린더**에서 변경할 수 있습니다.
- **일정 알림**: 환경 설정 → 일정 알림에서 "N분 전"을 고르면 시간제 일정 시작 전에 브라우저 알림을 띄웁니다. 처음 켤 때 알림 권한을 허용해 주세요.
- **회의록 양방향 동기화**: 앱에서 구글에 등록한 회의록은, 구글 캘린더에서 직접 수정하면 다음 새로고침 때 앱에도 반영되고, 구글에서 삭제하면 앱에서는 연동만 해제되고 메모는 남습니다.
- To-Do·시간표·메모·설정은 이제 서버(Supabase Postgres)에 로그인한 구글 계정별로 저장되어,
  같은 계정으로 로그인하면 어느 컴퓨터·브라우저에서든 동일한 데이터가 그대로 동기화됩니다.
  캘린더 일정의 원본은 구글 캘린더입니다.
- 저장되는 OAuth 토큰은 DB에 **암호화**되어 보관됩니다(AES-256-GCM). 배포 시에는 `TOKEN_ENC_KEY`를 고정된 값으로 설정하세요.

## 5. 테스트

```powershell
npm test          # 서버(node:test) + 클라이언트(vitest) 전체 실행
```

## 폴더 구조

```
planer/
├─ client/   # React + Vite + TS + Tailwind 프론트엔드
├─ server/   # Express 백엔드 (OAuth 토큰·API 키 보관, 구글/Gemini 프록시)
│  └─ data/  # OAuth 토큰 저장 (gitignore)
├─ .env      # 비밀키 (gitignore)
└─ .env.example
```
