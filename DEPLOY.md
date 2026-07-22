# 배포 가이드 — 어디서나 접속하기 (Render)

이 문서를 따라 하면 **인터넷 어디서나 접속 가능한 공개 주소**가 생깁니다.
로그인은 **구글 계정**으로 하며, 각자 자신의 구글 계정으로 로그인해 자신만의 데이터(할 일·시간표·메모 등)를
사용할 수 있는 다중 사용자 앱입니다. 데이터는 Supabase(Postgres) 서버에 사용자별로 저장됩니다.

> 전체 흐름: ① GitHub에 코드 올리기 → ② Supabase 프로젝트 준비 → ③ Render에 배포 →
> ④ 환경변수 입력 → ⑤ 구글 OAuth에 새 주소 등록 → ⑥ 접속·로그인

---

## 사전 준비물
- GitHub 계정 (없으면 https://github.com 에서 무료 가입)
- Render 계정 (없으면 https://render.com 에서 무료 가입 — 신용카드 불필요)
- Supabase 계정 (없으면 https://supabase.com 에서 무료 가입)
- `.env`에 이미 넣어둔 구글/Gemini 키 값 (배포 대시보드에 다시 입력합니다)

---

## ① GitHub에 코드 올리기

프로젝트 폴더(`planer/`)에서:

```powershell
git init
git add .
git commit -m "미요 플래너"
```

그다음 GitHub에서 **New repository**로 빈 저장소(예: `miyo-planner`)를 하나 만들고, 안내에 나오는 주소로 연결·푸시합니다:

```powershell
git remote add origin https://github.com/<본인아이디>/miyo-planner.git
git branch -M main
git push -u origin main
```

> `.gitignore`가 `.env`·`node_modules`·`server/data`를 제외하므로 비밀키는 올라가지 않습니다.

---

## ② Supabase 프로젝트 준비 (데이터베이스)

사용자별 데이터(할 일·시간표·메모 등)를 저장할 Postgres 데이터베이스입니다.

1. https://supabase.com 접속 → **New project** 생성 (조직 선택 → 프로젝트 이름·DB 비밀번호 설정 → 리전 선택)
2. 프로젝트 생성이 끝나면 좌측 메뉴 **Settings → Database**로 이동
3. **Connection string** 섹션에서 **⚠️ 반드시 "Session pooler"(포트 `5432`)** 탭을 선택합니다.
   - **"Transaction pooler"(포트 `6543`)를 사용하면 인증이 거부되어 앱이 DB에 접속하지 못합니다.** (실제 테스트에서 확인된 문제)
   - Session pooler 문자열은 `...pooler.supabase.com:5432/postgres` 형태입니다.
4. 복사한 문자열에서 `[YOUR-PASSWORD]` 부분을 프로젝트 생성 시 정한 DB 비밀번호로 바꿉니다.
5. 완성된 문자열을 잘 보관해 둡니다 (③에서 Render `DATABASE_URL`에 입력).

---

## ③ Render에 배포

1. https://dashboard.render.com 접속 → **New +** → **Blueprint**
2. 방금 만든 GitHub 저장소를 선택 (Render가 `render.yaml`을 자동 인식)
3. **Apply** 클릭 → 서비스가 생성됩니다.

`render.yaml`이 빌드/실행 명령과 환경변수 목록을 자동 구성합니다.

---

## ④ 환경변수 입력

서비스의 **Environment** 탭에서 아래 값을 채웁니다 (값이 비어 있는 항목):

| 변수 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 로컬 `.env`의 값 그대로 |
| `GOOGLE_CLIENT_SECRET` | 로컬 `.env`의 값 그대로 |
| `GEMINI_API_KEY` | 로컬 `.env`의 값 그대로 |
| `DATABASE_URL` | ②에서 준비한 Supabase **Session pooler(5432)** 연결 문자열 (비밀번호 치환 완료된 값) |

- `SESSION_SECRET`, `TOKEN_ENC_KEY`는 Render가 자동 생성합니다.
- `GEMINI_MODEL`은 `gemini-flash-lite-latest`로 미리 채워져 있습니다.

저장하면 자동으로 다시 배포됩니다. 배포가 끝나면 상단에 주소가 뜹니다:
`https://miyo-planner-xxxx.onrender.com`

---

## ⑤ 구글 OAuth에 새 주소 등록

공개 주소가 생겼으니, 구글이 그 주소로 로그인 결과를 돌려보내도록 허용해야 합니다.

1. https://console.cloud.google.com/auth/clients (프로젝트: My First Project)
2. OAuth 클라이언트 **"미요 플래너 웹"** 열기
3. **승인된 리디렉션 URI**에 다음을 추가(기존 localhost는 그대로 둬도 됨):
   ```
   https://<본인주소>.onrender.com/api/auth/google/callback
   ```
4. 저장. (반영에 몇 분 걸릴 수 있음)

> 앱은 이미 프로덕션으로 게시돼 있어, 로그인 시 "미인증 앱" 경고가 나오면
> **고급 → 미요 플래너로 이동 → 허용**으로 진행하면 됩니다.

---

## ⑥ 접속·로그인

1. 브라우저에서 `https://<본인주소>.onrender.com` 열기
2. **구글 로그인** 버튼 클릭 → 로그인할 구글 계정 선택 → 허용
3. 끝! 이제 어느 컴퓨터·폰에서든 이 주소로 접속해 같은 구글 계정으로 로그인하면 자신의 데이터가 그대로 이어집니다.

> 무료 플랜은 일정 시간 접속이 없으면 잠들었다가, 다음 접속 때 30~50초 걸려 깨어납니다(정상).

---

## 참고
- To-Do·시간표·메모·설정은 이제 Supabase(서버 DB)에 **사용자별로** 저장되므로, 같은 구글 계정으로 로그인하면 어느 기기·브라우저에서든 동일한 데이터가 보입니다(구글 캘린더 일정도 어디서나 동일).
- 여러 사람이 같은 배포 주소를 써도 각자 자신의 구글 계정으로 로그인하는 한 데이터는 서로 분리되어 저장됩니다.
- 로컬 개발은 그대로 `npm run dev` 사용.
