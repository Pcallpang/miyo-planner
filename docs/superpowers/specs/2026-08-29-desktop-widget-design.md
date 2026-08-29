# 오늘의 시간표 — 바탕화면 위젯(팝업 미니 창) 설계

## 배경

사용자 피드백: "오늘의 시간표 혹은 달력이 윈도우 바탕화면에 위젯으로 나타나면 좋겠다,
켜고 끄는 설정 버튼이 있으면 좋겠다"는 의견이 들어왔다.

진짜 윈도우 바탕화면 위젯(마이크로소프트 위젯 보드에 등록되는 것)은 별도 네이티브
패키징·인증 절차가 필요해 이 웹 앱만으로는 불가능하다(사용자에게 이미 설명하고
동의받음). 대신 **버튼을 누르면 뜨는 작은 팝업 창**으로 절충한다 — 오늘의 시간표만
담은 별도 브라우저 창을 열어두고 화면 한쪽에 계속 띄워두는 방식이다.

**확정된 방침(사용자와 합의):**
- "투명도"는 실제 바탕화면이 비치는 창 투명도가 아니라, **위젯 안 카드 배경 진하기**를
  뜻한다(브라우저 기술상 진짜 창 투명도는 불가능).
- 위젯 내용은 **오늘의 시간표만**(달력은 이번 범위에서 제외).
- 별도 설치형 미니 앱이 아니라 **팝업 창** 방식(더 단순하고 빠르게 만들 수 있음).

## 아키텍처 개요

기존 SPA(`App.tsx`)에 새 라우트를 추가하지 않고, URL 쿼리 파라미터 `?widget=1`로
"위젯 모드"를 구분한다. 팝업 창도 같은 오리진(`/`)을 열기 때문에 로그인 세션(쿠키)을
그대로 공유해 별도 로그인 절차가 필요 없다. `DataProvider`/`AppProvider`도 그대로
씌워져 있으므로 기존 훅(`useData`, `useApp`)과 `lib/schedule.ts`의
`getDayPhase`, `lib/subjectProgress.ts`의 `effectiveSlot` 등 계산 로직을 그대로
재사용한다 — 새 계산 로직을 만들지 않는다.

```
사용자가 환경 설정에서 "위젯 열기" 클릭
  → window.open('/?widget=1', 'miyo-widget', 'width=…,height=…,resizable=yes')
  → 새 창이 같은 번들을 로드 (App.tsx가 이미 Provider로 감싸져 있음)
  → App.tsx가 location.search로 위젯 모드 감지
  → Sidebar/Header 없이 <WidgetView/>만 렌더
```

## 변경 파일

### 1. `client/src/App.tsx`
- `const isWidget = new URLSearchParams(window.location.search).get('widget') === '1';`
  를 계산(마운트 시 한 번, `useState`의 초깃값 함수로 고정 — location.search가
  런타임에 바뀔 일은 없다).
- `isWidget`이면 기존 로그인 게이트(`status && !status.authenticated`)를 그대로
  존중하되, 렌더 결과만 다르게 한다:
  - 미로그인: 작은 안내(`"메인 창에서 먼저 로그인해 주세요"`, 미요 마스코트 정도)만
    표시하고 `LoginScreen`(구글 OAuth 버튼이 있는 큰 화면)은 띄우지 않는다 — 팝업
    창에서 OAuth 플로우를 새로 타는 건 배제.
  - 로그인됨: `Sidebar`/`Header`/`MobileTabBar`/`MoreSheet`/`WhatsNewModal` 등 기존
    셸을 전부 건너뛰고 `<WidgetView/>` 하나만 렌더.
- 위젯 모드가 아니면 지금 동작 그대로.

### 2. `client/src/views/WidgetView.tsx` (신규)
- `useData()`로 `data.timetable`, `data.swapOverrides`, `data.canceledLessons`,
  `data.makeupLessons`, `data.subjectColors`를 읽는다(기존 `WeeklyGrid.tsx`가 쓰는
  것과 같은 필드).
- 오늘 날짜/요일 표시 + `Array.from({length: settings.periodCount})`로 교시별 한 줄씩:
  `effectiveSlot(timetable, swapOverrides, todayKey, i)`로 과목/반을 구하고,
  `settings.periodTimes[i]`로 시작~종료 시간을 붙인다. `canceledLessons`에 있으면
  취소선 + "휴강" 배지, `makeupLessons`에 있으면 "보강 · 과목" 배지 — `WeeklyGrid.tsx`
  칸 렌더 로직과 같은 조건, 새 로직 아님.
  - **범위 제외:** 학사일정(공휴일·재량휴업일) 기반 자동 휴강은 나이스 API를 추가로
    불러와야 해서 이번 미니 위젯 범위에서는 뺀다(수동 휴강만 반영). 필요해지면 다음
    단계에서 추가.
- `getDayPhase(now, settings.periodTimes, settings.periodCount)`로 지금 진행 중인
  교시를 찾아 그 줄만 민트색으로 강조(`LiveStatusCard.tsx`가 이미 쓰는 함수 재사용).
- 주말/일과 전/일과 후에는 표 대신 짧은 안내 문구만 표시(예: "주말이에요", "아직
  일과 전이에요").

### 3. 위젯 자체 상태(크기·투명도 기억) — `client/src/lib/widgetPrefs.ts` (신규, 작은 유틸)
- `localStorage` 키 `haru.widget.opacity`(0~100 정수, 기본 100)와
  `haru.widget.size`(`{width, height}`, 기본 `{width: 320, height: 420}`)를
  읽고 쓰는 함수 두어 개만 담은 순수 유틸(기존 `lib/storage.ts`의
  `useLocalStorage` 훅과는 별개 — 위젯 창에서만 쓰고 React 상태와 동기화할 필요는
  없어서 직접 `localStorage.getItem/setItem`을 감싼 작은 함수로 충분).
- `WidgetView`는 마운트 시 `getWidgetOpacity()`로 초깃값을 읽어 카드 배경
  투명도(`background: rgba(255,255,255, opacity/100)` 형태)에 반영하고, 오른쪽
  위 톱니바퀴 버튼을 누르면 뜨는 슬라이더로 값을 바꿀 때마다 `setWidgetOpacity()`로
  즉시 저장한다.
- 창 크기 기억: `WidgetView`가 아니라 **여는 쪽**(환경 설정 버튼)이 담당한다 —
  `window.open` 호출 시 `getWidgetSize()`로 저장된 크기를 읽어 `width=…,height=…`에
  넣고, 팝업 창에 `beforeunload` 리스너를 하나 걸어 그 시점의
  `window.outerWidth`/`outerHeight`를 `setWidgetSize()`로 저장한다(이 리스너는
  `WidgetView`가 마운트 시 등록).

### 4. `client/src/views/SettingsView.tsx`
- 기존 3개 섹션(환경 설정 / 구글 캘린더 연동 / 데이터) 사이에 새 섹션 "바탕화면 위젯"을
  추가(데이터 섹션 앞이 자연스러움).
- `useRef<Window | null>`로 열어 둔 팝업 창 참조를 들고, 버튼 라벨을
  `widgetRef.current && !widgetRef.current.closed ? '위젯 닫기' : '위젯 열기'`로
  토글한다.
  - 열기: `window.open('/?widget=1', 'miyo-widget', 'width=…,height=…,resizable=yes,popup=yes')`
    호출 결과를 `widgetRef.current`에 저장. 이미 열려 있으면(같은 `name`이라 브라우저가
    새로 안 열고) 그 창에 `.focus()`만 호출.
  - 닫기: `widgetRef.current?.close()`.
- 설명 문구에 "이 브라우저를 닫으면 위젯도 같이 닫혀요. 창 크기는 드래그로, 배경
  진하기는 위젯 안 톱니바퀴 아이콘으로 조절할 수 있어요"를 안내.

## 데이터 흐름 / 최신화

위젯 창은 메인 탭과 별개의 JS 실행 환경(별도 페이지 로드)이라 메모리를 공유하지
않는다. `client/src/context/DataContext.tsx`를 확인한 결과 지금은 마운트 시 1회만
`api.getData()`를 부르고 끝이라, 읽기 전용으로 다시 불러오는 함수가 따로 없다.
이번 작업에서 그 마운트-이펙트 안의 로드 로직을 `loadFromServer()` 함수로 뽑아
마운트 시/`refetch()` 호출 시 둘 다 재사용하고, `refetch: () => Promise<void>`를
`DataValue`에 추가해 `useData()`로 어디서든 쓸 수 있게 한다(쓰기 전용 디바운스
큐인 `update()`/`scheduleFlush()`는 그대로 두고 건드리지 않는다). 이렇게 하면
위젯뿐 아니라 다른 화면에서도 나중에 "새로고침" 버튼 같은 걸 붙일 때 재사용할 수
있다.

`WidgetView`는:
- 마운트 시 1회는 `DataProvider`가 이미 처리(그대로 최초 데이터를 받음).
- `document.addEventListener('visibilitychange', …)`로 창이 다시 보일 때
  `refetch()` 호출.
- 5분마다 같은 `refetch()`를 반복(`setInterval`, 언마운트 시 정리).

## 검증

- 개발 서버에서: 환경 설정 → "위젯 열기" → 작은 창이 뜨고 오늘 교시가 보이는지,
  현재 교시가 강조되는지.
- 팝업 창 가장자리를 드래그해 크기를 바꾼 뒤 닫았다가 다시 열어 그 크기로 뜨는지.
- 톱니바퀴 → 슬라이더로 배경 진하기를 바꾼 뒤 닫았다가 다시 열어 값이 유지되는지.
- 메인 탭에서 시간표를 수정한 뒤 위젯 창을 클릭(포커스)하면 바뀐 내용이 반영되는지.
- 로그아웃 상태로 `/?widget=1`을 직접 열면 안내 문구만 뜨고 에러가 안 나는지.
- `npx tsc --noEmit`, `npm run build` 통과 확인.
