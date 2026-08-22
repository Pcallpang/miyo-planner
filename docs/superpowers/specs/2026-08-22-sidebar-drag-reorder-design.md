# 사이드바 "나의 하루" 순서 바꾸기 — 설계

## 배경

PC 사이드바의 "나의 하루" 메뉴(대시보드·매트릭스·메모·급식학사일정·시간표·품의서·스마트 자리배치)는
순서가 코드에 고정돼 있다. 사용자가 자주 쓰는 항목을 위로 올려 쓰기 편하게 만들고 싶다는
요청에 따라, 드래그로 순서를 바꾸고 그 순서가 계정에 저장되는 기능을 추가한다.

범위는 PC 사이드바(`client/src/components/Sidebar.tsx`)로 한정한다. 모바일 하단 탭바
(`MobileTabBar.tsx`)는 항목 구성 자체가 다르고(고정 5개 + 더보기), 터치 드래그는 별도
UX 설계가 필요해 이번 범위에서 제외한다.

## 데이터 모델

`Settings`(`client/src/types.ts`)에 필드를 추가한다.

```ts
/** 사이드바 "나의 하루" 항목 순서. 비어 있으면 기본 순서를 쓴다. */
sidebarOrder: string[];
```

- 값은 `SidebarItemId`(`'dashboard' | 'matrix' | 'memo' | 'school' | 'timetable' | 'procurement' | 'seating'`) 목록.
- 다른 설정과 동일하게 서버의 사용자별 `settings` blob에 그대로 저장되어 계정 간 동기화된다
  (서버는 JSON을 그대로 저장/병합하므로 서버 코드 변경 불필요).
- `defaultSettings()`(`client/src/lib/storage.ts`)는 `sidebarOrder: []`를 기본값으로 둔다.
  빈 배열 = "아직 커스터마이즈 안 함" → 아래 보정 함수가 기본 순서 전체를 채워 넣는다.

## 순서 보정 로직 (신규: `client/src/lib/sidebarOrder.ts`)

```ts
export type SidebarItemId =
  | 'dashboard' | 'matrix' | 'memo' | 'school' | 'timetable' | 'procurement' | 'seating';

export const DEFAULT_SIDEBAR_ORDER: SidebarItemId[] =
  ['dashboard', 'matrix', 'memo', 'school', 'timetable', 'procurement', 'seating'];

/**
 * 저장된 순서를 지금 존재하는 항목 기준으로 보정한다.
 * - 더는 없는 항목(예전 버전의 흔적)은 버린다.
 * - 저장된 순서에 없는 새 항목(기능 추가로 새로 생긴 메뉴)은 끝에 붙인다.
 * 이렇게 하면 항목이 사라지거나 중복되는 일이 없다.
 */
export function resolveSidebarOrder(saved: string[]): SidebarItemId[] { ... }
```

`saved`가 `[]`(기본값)이면 `cleaned`가 비어 있으므로 `DEFAULT_SIDEBAR_ORDER` 전체가
그대로 뒤에 붙는다 — 즉 커스터마이즈 전에는 지금과 동일한 순서로 보인다.

## `Sidebar.tsx` 변경

- 지금은 `MENU[0].items` 배열을 고정 순서로 `.map()` 하고, "스마트 자리배치"는 그 뒤에
  하드코딩된 별도 `<li>`로 붙어 있다.
- 항목 정의(라벨·아이콘·클릭 동작)를 `SidebarItemId`로 찾는 조회 테이블 하나로 통합하고,
  실제 렌더 순서는 `resolveSidebarOrder(settings.sidebarOrder)`로 정한다.
- 각 `<li>`에 `draggable`을 주고 `onDragStart`/`onDragOver`/`onDrop`/`onDragEnd`를 붙인다.
  라이브러리는 추가하지 않는다(브라우저 기본 Drag and Drop API만 사용) — 이 프로젝트가
  지금까지 의존성을 가볍게 유지해 온 방식과 맞고, PC 전용이라 이걸로 충분하다.
- 동작: 항목을 누르고 끌면 지나가는 자리의 항목들이 그 즉시 밀려나며(드롭 전에도 미리보기로
  자리를 바꿔 보여준다) 마우스를 놓는 순간 그 순서가 `setSettings`로 저장된다.
- 각 줄 왼쪽에 작은 손잡이 아이콘(`GripVertical`, lucide-react)을 넣어 "끌 수 있다"는 것을
  시각적으로 알린다. 손잡이가 아니라 줄 전체가 드래그 시작점이다(구현 단순화, 클릭 동작과
  충돌하지 않음 — HTML5 드래그는 실제로 끄는 제스처가 있어야 시작되므로 평범한 클릭에는
  영향이 없다).
- 목록 맨 아래, 크게 눈에 띄지 않는 톤으로 "기본 순서로" 버튼을 둔다. 누르면
  `sidebarOrder`를 `[]`로 되돌린다.

## 테스트

`resolveSidebarOrder` 순수 함수를 `client/src/lib/sidebarOrder.test.ts`에서 검증한다:
- 빈 배열 → 기본 순서 그대로
- 사용자 지정 순서 → 그 순서 그대로 유지
- 존재하지 않는 항목이 섞여 있음 → 제거됨
- 새 항목이 저장된 목록에 없음 → 끝에 자동으로 붙음

드래그 자체(브라우저 네이티브 이벤트)는 자동 테스트로 신뢰성 있게 흉내 내기 어려운 영역이라,
개발 서버를 띄워 실제 마우스 드래그로 눈으로 확인한다: 순서 변경 → 새로고침 후에도 유지 →
"기본 순서로" 복구까지.

## 구현 규모에 대한 메모

파일 3개(`types.ts`, `storage.ts`, `Sidebar.tsx` 수정) + 신규 파일 1개(`sidebarOrder.ts`)로
끝나는 작은 변경이라, 이 설계를 그대로 구현 계획으로 삼아 바로 구현한다(별도 실행 계획
문서는 만들지 않는다).
