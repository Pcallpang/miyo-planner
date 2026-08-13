# 배포 가이드 — 어디서나 접속하기 (Vercel)

이 문서를 따라 하면 **인터넷 어디서나 접속 가능한 공개 주소**가 생깁니다.
로그인은 **구글 계정**으로 하며, 각자 자신의 구글 계정으로 로그인해 자신만의 데이터(할 일·시간표·메모 등)를
사용할 수 있는 다중 사용자 앱입니다. 데이터는 Supabase(Postgres) 서버에 사용자별로 저장됩니다.

> 전체 흐름: ① GitHub에 코드 올리기 → ② Supabase 준비 → ③ 스키마 적용 → ④ Vercel에 배포 →
> ⑤ 환경변수 입력 → ⑥ 구글 OAuth에 새 주소 등록 → ⑦ 자리배치 앱 연동 → ⑧ 접속·로그인

---

## 사전 준비물
- GitHub 계정 (없으면 https://github.com 에서 무료 가입)
- Vercel 계정 (없으면 https://vercel.com 에서 무료 가입 — 신용카드 불필요)
- Supabase 계정 (없으면 https://supabase.com 에서 무료 가입)
- `.env`에 이미 넣어둔 구글/Gemini 키 값 (배포 대시보드에 다시 입력합니다)

> Vercel 무료(Hobby) 플랜은 **비상업적 용도**에 한합니다. 개인용 플래너는 해당됩니다.

---

## ① GitHub에 코드 올리기

프로젝트 폴더에서:

```powershell
git add .
git commit -m "미요 플래너"
git push
```

아직 원격 저장소가 없다면 GitHub에서 **New repository**로 빈 저장소(예: `miyo-planner`)를 만들고 연결합니다:

```powershell
git remote add origin https://github.com/<본인아이디>/miyo-planner.git
git branch -M main
git push -u origin main
```

> `.gitignore`가 `.env`·`node_modules`·`server/data`를 제외하므로 비밀키는 올라가지 않습니다.

---

## ② Supabase 준비 (데이터베이스)

사용자별 데이터(할 일·시간표·메모 등)를 저장할 Postgres 데이터베이스입니다.
이미 쓰던 프로젝트가 있으면 그대로 쓰고, 연결 문자열만 아래 방식으로 다시 받습니다.

1. https://supabase.com 접속 → 프로젝트 선택(없으면 **New project** 생성)
2. 좌측 메뉴 **Settings → Database**로 이동
3. **Connection string** 섹션에서 **"Transaction pooler"(포트 `6543`)** 탭을 선택합니다.
   - 서버리스 배포는 함수 인스턴스가 여러 개 뜨므로 Transaction pooler를 써야 커넥션이 남아납니다.
   - 대시보드가 주는 문자열을 **그대로** 복사하세요. 사용자명이 `postgres.<프로젝트ref>` 형태여야 하며,
     이걸 그냥 `postgres`로 바꾸면 **인증이 거부됩니다**(예전에 겪었던 문제의 원인).
4. 문자열의 `[YOUR-PASSWORD]`를 DB 비밀번호로 바꿉니다.
5. 완성된 문자열을 잘 보관해 둡니다 (⑤에서 `DATABASE_URL`에 입력).

---

## ③ 스키마 적용

서버리스에서는 앱이 뜰 때 스키마를 만들지 않습니다(콜드 스타트마다 실행되면 느리고 충돌합니다).
대신 **내 컴퓨터에서 한 번** 실행합니다. 로컬 `.env`의 `DATABASE_URL`을 ②의 값으로 맞춘 뒤:

```powershell
npm run db:migrate
```

`[migrate] 스키마 적용 완료`가 뜨면 됩니다. 앞으로 `server/db/schema.sql`을 고칠 때마다 이 명령을 다시 실행하세요.

---

## ④ Vercel에 배포

1. https://vercel.com/new 접속 → **Import Git Repository**에서 방금 만든 저장소 선택
2. Framework Preset은 **Other**로 두면 됩니다 — 저장소의 `vercel.json`이 빌드/출력/함수 설정을 다 담고 있습니다.
3. **Deploy** 클릭. (환경변수가 아직 없어 첫 배포는 실패할 수 있습니다. ⑤ 후 재배포하면 됩니다.)

`vercel.json`이 하는 일:
- 프론트엔드를 `client/dist`로 빌드해 CDN에서 서빙
- `/api/*` 요청을 `api/index.js`(Express 앱)로 전달
- Gemini 호출을 위해 함수 실행 시간을 60초로 확장

---

## ⑤ 환경변수 입력

Vercel 프로젝트 → **Settings → Environment Variables**에서 아래를 채웁니다.

| 변수 | 값 |
|---|---|
| `PUBLIC_URL` | **배포 주소** (예: `https://miyo-planner.vercel.app`) — 슬래시 없이 |
| `GOOGLE_CLIENT_ID` | 로컬 `.env`의 값 그대로 |
| `GOOGLE_CLIENT_SECRET` | 로컬 `.env`의 값 그대로 |
| `GEMINI_API_KEY` | 로컬 `.env`의 값 그대로 |
| `NEIS_API_KEY` | 로컬 `.env`의 값 (비우면 샘플키로 동작 — 일일 한도 낮음) |
| `DATABASE_URL` | ②에서 준비한 Transaction pooler(6543) 연결 문자열 |
| `SESSION_SECRET` | 아래 설명 참고 |
| `TOKEN_ENC_KEY` | 아래 설명 참고 |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` |
| `SEATING_APP_URL` | (선택) 자리배치 앱 주소. 기본값 `https://sn-aseating.vercel.app` |

**`PUBLIC_URL`은 반드시 넣어야 합니다.** 이 값이 구글 OAuth 리디렉션 주소와 세션 쿠키의 `Secure` 플래그를
결정합니다. 비워두면 배포할 때마다 바뀌는 임시 주소가 쓰여 로그인이 깨집니다.

**`SESSION_SECRET`·`TOKEN_ENC_KEY`는 Render가 자동 생성해주던 값입니다.**
- 기존 Render 배포에서 옮겨오는 경우: Render 대시보드 → Environment에서 **현재 값을 그대로 복사**하세요.
  특히 `TOKEN_ENC_KEY`가 바뀌면 저장된 구글 토큰을 복호화할 수 없어 **전원 다시 로그인**해야 합니다.
- 새로 만드는 경우: 아무 긴 랜덤 문자열이면 됩니다.
  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

저장한 뒤 **Deployments → 최신 배포 → Redeploy**로 다시 배포합니다.

---

## ⑥ 구글 OAuth에 새 주소 등록

공개 주소가 생겼으니, 구글이 그 주소로 로그인 결과를 돌려보내도록 허용해야 합니다.

1. https://console.cloud.google.com/auth/clients (프로젝트: My First Project)
2. OAuth 클라이언트 **"미요 플래너 웹"** 열기
3. **승인된 리디렉션 URI**에 다음을 추가(기존 localhost는 그대로 둬도 됨):
   ```
   https://<본인주소>.vercel.app/api/auth/google/callback
   ```
4. 저장. (반영에 몇 분 걸릴 수 있음)

> 로그인 시 "미인증 앱" 경고가 나오면 **고급 → 미요 플래너로 이동 → 허용**으로 진행하면 됩니다.

---

## ⑦ 자리배치 앱 연동 (한 번만)

사이드바의 **스마트 자리배치**를 누르면 자리배치 앱이 새 탭에서 열리며, 플래너 구글 로그인으로
**자동 로그인**됩니다. 이게 되려면 자리배치 쪽 Supabase에 플래너의 구글 클라이언트를 등록해야 합니다.

1. 자리배치 Supabase 프로젝트(`kbaochyckwyvomnqgoru`) → **Authentication → Providers → Google**
2. 활성화하고 **Authorized Client IDs**에 플래너의 `GOOGLE_CLIENT_ID`를 추가
   - `signInWithIdToken`만 쓰므로 client secret이나 Supabase 콜백 URL 등록은 필요 없습니다.
3. 자동 로그인이 nonce 오류로 거부되면 같은 화면에서 **nonce 검사 옵션을 끕니다**.
   (플래너는 서버측 auth-code 플로우를 쓰므로 id_token에 nonce 클레임이 없습니다.)

> 자리배치 앱의 기존 이메일/비번 로그인과 '가입 없이 둘러보기'는 그대로 살아 있습니다.
> 기존 사용자는 아무 영향도 받지 않습니다.

**기존 학급이 안 보이는 경우** — 이메일/비번으로 만든 계정과 구글 계정은 Supabase에서 별개 사용자입니다.
자리배치 Supabase의 SQL Editor에서 한 번 실행해 학급 소유자를 옮기세요:

```sql
-- 1) 두 계정의 id 확인
select id, email, created_at from auth.users order by created_at;

-- 2) 기존 계정의 학급을 새 구글 계정으로 이관
update public.classes
   set teacher_id = '<구글계정 uuid>'
 where teacher_id = '<기존 이메일계정 uuid>';
```

설문 응답(`survey_responses`)은 학급에 딸려 있어 함께 따라옵니다.

---

## ⑧ 접속·로그인

1. 브라우저에서 `https://<본인주소>.vercel.app` 열기
2. **구글 로그인** 버튼 클릭 → 로그인할 구글 계정 선택 → 허용
3. 끝! 이제 어느 컴퓨터·폰에서든 이 주소로 접속해 같은 구글 계정으로 로그인하면 자신의 데이터가 그대로 이어집니다.

> Render와 달리 **잠들지 않습니다.** 첫 접속에 30~50초 기다릴 일이 없습니다.

---

## 참고
- To-Do·시간표·메모·설정은 Supabase(서버 DB)에 **사용자별로** 저장되므로, 같은 구글 계정으로 로그인하면
  어느 기기·브라우저에서든 동일한 데이터가 보입니다(구글 캘린더 일정도 어디서나 동일).
- 여러 사람이 같은 배포 주소를 써도 각자 자신의 구글 계정으로 로그인하는 한 데이터는 서로 분리되어 저장됩니다.
- 자리배치 앱은 **별도 저장소·별도 배포**입니다(`C:\Pcall\SNAseating` → `sn-aseating.vercel.app`).
  플래너와 코드를 공유하지 않으며, 연동은 구글 id_token을 넘겨주는 방식으로만 이뤄집니다.
- 로컬 개발은 그대로 `npm run dev` 사용. 로컬에서는 서버가 뜰 때 스키마를 자동으로 맞춥니다.
