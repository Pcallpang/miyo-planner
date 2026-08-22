/** PC 사이드바 "나의 하루" 목록에 들어가는 항목 id. '설정'은 별도 그룹이라 포함하지 않는다. */
export type SidebarItemId =
  | 'dashboard'
  | 'matrix'
  | 'memo'
  | 'school'
  | 'timetable'
  | 'procurement'
  | 'seating';

export const DEFAULT_SIDEBAR_ORDER: SidebarItemId[] = [
  'dashboard',
  'matrix',
  'memo',
  'school',
  'timetable',
  'procurement',
  'seating',
];

/**
 * 저장된 순서를 지금 존재하는 항목 기준으로 보정한다.
 * 더는 없는 항목(예전 버전의 흔적)은 버리고, 저장된 순서에 없는 새 항목은 끝에 붙인다.
 * 이렇게 하면 사용자가 순서를 바꾼 뒤에도 항목이 사라지거나 중복되지 않는다.
 */
export function resolveSidebarOrder(saved: string[]): SidebarItemId[] {
  const known = new Set<string>(DEFAULT_SIDEBAR_ORDER);
  const seen = new Set<SidebarItemId>();
  const cleaned: SidebarItemId[] = [];
  for (const id of saved) {
    if (known.has(id) && !seen.has(id as SidebarItemId)) {
      seen.add(id as SidebarItemId);
      cleaned.push(id as SidebarItemId);
    }
  }
  const missing = DEFAULT_SIDEBAR_ORDER.filter((id) => !seen.has(id));
  return [...cleaned, ...missing];
}
