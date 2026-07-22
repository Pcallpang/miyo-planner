# 배포 가이드 — 어디서나 접속하기 (Render)

이 문서를 따라 하면 **인터넷 어디서나 접속 가능한 공개 주소**가 생깁니다.
앱은 비밀번호로 보호되므로 회원님만 사용할 수 있습니다.

> 전체 흐름: ① GitHub에 코드 올리기 → ② Render에 배포 → ③ 환경변수 입력 →
> ④ 구글 OAuth에 새 주소 등록 → ⑤ 접속·로그인

---

## 사전 준비물
- GitHub 계정 (없으면 https://github.com 에서 무료 가입)
- Render 계정 (없으면 https://render.com 에서 무료 가입 — 신용카드 불필요)
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

## ② Render에 배포

1. https://dashboard.render.com 접속 → **New +** → **Blueprint**
2. 방금 만든 GitHub 저장소를 선택 (Render가 `render.yaml`을 자동 인식)
3. **Apply** 클릭 → 서비스가 생성됩니다.

`render.yaml`이 빌드/실행 명령과 환경변수 목록을 자동 구성합니다.

---

## ③ 환경변수 입력

서비스의 **Environment** 탭에서 아래 값을 채웁니다 (값이 비어 있는 항목):

| 변수 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 로컬 `.env`의 값 그대로 |
| `GOOGLE_CLIENT_SECRET` | 로컬 `.env`의 값 그대로 |
| `GEMINI_API_KEY` | 로컬 `.env`의 값 그대로 |
| `APP_PASSWORD` | **원하는 접속 비밀번호** (직접 정함) |

- `SESSION_SECRET`은 Render가 자동 생성합니다.
- `GEMINI_MODEL`은 `gemini-flash-lite-latest`로 미리 채워져 있습니다.
- `GOOGLE_REFRESH_TOKEN`은 지금은 비워둡니다(아래 ⑤-보너스 참고).

저장하면 자동으로 다시 배포됩니다. 배포가 끝나면 상단에 주소가 뜹니다:
`https://miyo-planner-xxxx.onrender.com`

---

## ④ 구글 OAuth에 새 주소 등록

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

## ⑤ 접속·로그인

1. 브라우저에서 `https://<본인주소>.onrender.com` 열기
2. **비밀번호**(③에서 정한 `APP_PASSWORD`) 입력 → 로그인
3. **구글 계정 연동** → `ljh6479z@gmail.com` 선택 → 허용
4. 끝! 이제 어느 컴퓨터·폰에서든 이 주소로 접속해 비밀번호만 넣으면 됩니다.

> 무료 플랜은 일정 시간 접속이 없으면 잠들었다가, 다음 접속 때 30~50초 걸려 깨어납니다(정상).

### ⑤-보너스: 재배포에도 구글 연동 유지 (선택)
무료 플랜은 코드를 다시 배포하면 저장된 로그인이 사라져 구글 재연동이 필요합니다.
이를 막으려면:
1. Environment에 `LOG_REFRESH_TOKEN` = `1` 임시 추가 → 저장(재배포)
2. 앱에서 구글 연동을 한 번 진행
3. 서비스 **Logs** 탭에서 `GOOGLE_REFRESH_TOKEN=...` 줄을 찾아 값 복사
4. Environment에서 `GOOGLE_REFRESH_TOKEN`에 그 값을 붙여넣고, `LOG_REFRESH_TOKEN`은 삭제 → 저장
이후에는 재배포해도 연동이 유지됩니다.

---

## 참고
- To-Do·시간표·메모는 여전히 **브라우저별 저장**이라 기기 간 자동 공유는 안 됩니다(구글 캘린더 일정은 어디서나 동일). 기기 간 전부 공유하려면 서버 DB 추가 작업이 필요합니다.
- 로컬 개발은 그대로 `npm run dev` 사용(비밀번호 없이 열림).
