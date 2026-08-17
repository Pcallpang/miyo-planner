# 모바일 반응형 대응 설계

## 배경

미요 플래너는 데스크톱 전용 레이아웃(고정 240px 사이드바 + 상단 헤더)으로만 구현돼 있다. 모바일 브라우저에서도 하루 일정을 확인·관리할 수 있도록 반응형 대응한다.

기존 코드 조사 결과, 대시보드·매트릭스·급식학사일정은 이미 `sm:`/`xl:` 그리드로 좁은 화면에서 자동 1단 스택되고, 품의서 표·시간표는 `overflow-x-auto`로 가로 스크롤 처리가 돼 있다. 손질이 필요한 지점은 (1) 사이드바 중심 내비게이션 구조 자체, (2) `DraftDocumentModal`의 고정폭 2단 레이아웃, (3) `MatrixView`의 네이티브 HTML5 드래그앤드롭(터치 미지원) 세 곳으로 좁혀진다.

## 범위

- 전체 화면·모달을 모바일 전용 UI로 새로 설계하지 않는다. 기존 컴포넌트에 반응형 클래스를 추가해 좁은 화면에서도 조작 가능한 "실용 수준" 대응을 한다.
- 브레이크포인트는 Tailwind 기본값을 그대로 쓴다(`sm`=640px, `md`=768px, `lg`=1024px, `xl`=1280px). `lg` 미만을 모바일/태블릿 레이아웃으로 취급한다.
- 실기기 테스트 환경이 없으므로 Chrome DevTools 기기 에뮬레이션(iPhone/Android 뷰포트)으로 검증한다.

## 1. 전체 레이아웃 셸

- `App.tsx`: `lg` 미만에서 데스크톱 `Sidebar`를 숨기고(`hidden lg:flex`), 화면 하단에 `MobileTabBar`를 고정 배치한다(`lg:hidden`). `main` 요소에 탭바에 가리지 않도록 하단 패딩을 추가한다(`pb-24 lg:pb-6`).
- `Header.tsx`: 좁은 화면에서 날짜/시계/일과단계 뱃지가 한 줄에 들어가지 않으므로 일과단계 뱃지 등 부차 정보를 `hidden sm:flex`로 숨긴다. 구글 연동 상태 배지의 이메일 텍스트도 `hidden sm:inline`으로 좁을 땐 아이콘/점만 남긴다.

## 2. 하단 탭바 + 더보기 시트

- `client/src/components/MobileTabBar.tsx`(신규): 고정폭 하단 바, 5개 탭 — 대시보드·매트릭스·메모·시간표·더보기. 현재 `view`와 일치하는 탭을 강조 표시. `position: fixed; bottom: 0`, iOS 안전영역 대응으로 `padding-bottom: env(safe-area-inset-bottom)`. `lg:hidden`으로 데스크톱에서 숨김.
- `client/src/components/MoreSheet.tsx`(신규): 탭바의 "더보기"를 누르면 하단에서 올라오는 시트. 항목: 급식·학사일정, 품의서 작성, 스마트 자리배치(`Sidebar.tsx`의 `openSeating()` 로직 재사용), 미요 실험실 바로가기, 환경 설정, 로그아웃(`Sidebar.tsx`의 `logout()` 재사용), 로그인 이메일 표시. 오버레이 클릭/ESC로 닫힘(`SlidePanel`과 유사한 슬라이드 트랜지션이나 하단에서 올라오는 방향).
- `App.tsx`에 `moreSheetOpen` 상태를 추가하고 `MobileTabBar`의 "더보기" 클릭 시 열리도록 연결한다.

## 3. 화면별 조정

- 대시보드(`DashboardView`), 매트릭스(`MatrixView`), 급식·학사일정(`SchoolView`)은 기존 그리드 클래스로 이미 좁은 화면에서 1단 스택되므로 구조 변경은 하지 않는다. 카드 내부 여백만 좁은 화면에서 다소 줄인다(`p-6` → `p-4 sm:p-6` 등 필요한 곳에 한해).
- 품의서 표(`ProcurementView`)와 시간표(`TimetableView`)는 이미 `overflow-x-auto` + `min-w-[...]`로 가로 스크롤 처리돼 있으므로 그대로 둔다.
- `DraftDocumentModal.tsx`: 왼쪽 입력 폼이 고정폭 `w-[420px] shrink-0`이라 모바일에서 잘린다. 바깥 컨테이너를 `flex-col md:flex-row`로, 입력 폼을 `w-full md:w-[420px]`로 바꿔 좁은 화면에서는 입력 폼 → 미리보기 순으로 세로 스택되게 한다. 모달 전체 높이(`h-[85vh]`)와 내부 스크롤은 유지.
- `SlidePanel` 기반 모달(`TodoModal`, `MeetingModal`, `OvertimeModal`)은 이미 `w-full max-w-md`라 추가 작업이 필요 없다.
- `DateActionModal`, `EventModal`, `NotePasteModal`은 `fixed inset-0 grid place-items-center p-4` 오버레이 + 내부 `max-w-*` 카드 구조라 좁은 화면에서도 이미 중앙 정렬·축소되므로 실사용 확인만 하고 구조는 바꾸지 않는다(문제 발견 시에만 수정).

## 4. 매트릭스 드래그앤드롭 대안

`MatrixView`는 HTML5 네이티브 드래그(`onDragStart`/`onDrop`)로 사분면 이동을 구현하는데, 이는 터치 환경에서 동작하지 않는다. 모바일에서 할 일을 사분면 간 이동할 방법이 사라지는 것은 시각적 문제가 아니라 기능 손실이므로 대안을 추가한다.

- 각 할 일 항목에 작은 "이동" 아이콘 버튼을 추가한다. 클릭하면 4개 사분면 목록이 담긴 작은 드롭다운/팝오버가 뜨고, 선택하면 `moveToQuadrant(todo, target, urgentDays)`를 호출한다(기존 `drop()` 핸들러와 동일한 로직 재사용).
- 데스크톱의 기존 드래그앤드롭 동작은 그대로 유지하고, 이동 버튼은 두 환경 모두에서 노출한다(데스크톱에서도 드래그가 번거로운 사용자를 위한 보조 수단이 됨).

## 5. 검증

- `npx tsc --noEmit`, `npm run build`, `npx vitest run` — 기존 테스트 그린 유지.
- Chrome DevTools 기기 에뮬레이션(iPhone 12/SE, 대표 Android 폭)으로 로그인 우회 후 직접 확인:
  1. 하단 탭바로 대시보드·매트릭스·메모·시간표 전환, "더보기" 시트로 나머지 메뉴 접근·로그아웃 동작
  2. 매트릭스에서 이동 버튼으로 사분면 간 할 일 이동
  3. 품의서 작성 → 기안문 생성 모달이 좁은 화면에서 입력 폼/미리보기가 세로로 스택되는지, 스크롤이 정상인지
  4. 대시보드 카드들, 품의서 표, 시간표가 가로 스크롤 없이(표는 가로 스크롤 허용) 읽을 수 있는지
  5. 데스크톱(`lg` 이상)에서 기존 사이드바 레이아웃이 그대로 동작하는지 회귀 확인
