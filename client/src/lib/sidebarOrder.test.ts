import { describe, expect, test } from 'vitest';
import { DEFAULT_SIDEBAR_ORDER, resolveSidebarOrder } from './sidebarOrder';

describe('resolveSidebarOrder', () => {
  test('빈 배열이면 기본 순서를 그대로 쓴다', () => {
    expect(resolveSidebarOrder([])).toEqual(DEFAULT_SIDEBAR_ORDER);
  });

  test('사용자가 바꾼 순서를 그대로 유지한다', () => {
    const custom = ['school', 'dashboard', 'matrix', 'memo', 'timetable', 'procurement', 'seating'];
    expect(resolveSidebarOrder(custom)).toEqual(custom);
  });

  test('더는 존재하지 않는 항목은 제거한다', () => {
    const saved = ['dashboard', 'old-removed-view', 'matrix', 'memo', 'school', 'timetable', 'procurement', 'seating'];
    const result = resolveSidebarOrder(saved);
    expect(result).not.toContain('old-removed-view');
    expect(result).toEqual(['dashboard', 'matrix', 'memo', 'school', 'timetable', 'procurement', 'seating']);
  });

  test('저장된 목록에 없는 새 항목은 끝에 붙인다', () => {
    // 'procurement'가 기능 추가 이전에 저장된 것처럼, 저장된 순서에 없는 상황을 흉내낸다
    const saved = ['school', 'dashboard', 'matrix', 'memo', 'timetable', 'seating'];
    expect(resolveSidebarOrder(saved)).toEqual(['school', 'dashboard', 'matrix', 'memo', 'timetable', 'seating', 'procurement']);
  });

  test('중복이 있어도 한 번만 남긴다', () => {
    const saved = ['dashboard', 'dashboard', 'matrix', 'memo', 'school', 'timetable', 'procurement', 'seating'];
    const result = resolveSidebarOrder(saved);
    expect(result.filter((id) => id === 'dashboard')).toHaveLength(1);
  });
});
