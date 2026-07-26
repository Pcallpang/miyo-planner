import { describe, expect, test } from 'vitest';
import {
  clearUrgentOverride,
  isUrgent,
  moveToQuadrant,
  quadrantOf,
  quadrantOfTodo,
} from './eisenhower';
import type { Todo } from '../types';

const today = new Date('2026-07-27T10:00:00+09:00');

function todo(over: Partial<Todo> = {}): Todo {
  return {
    id: 't1',
    text: '수행평가 채점',
    category: '업무',
    done: false,
    createdAt: '2026-07-20T09:00:00+09:00',
    ...over,
  };
}

describe('isUrgent', () => {
  test('마감일이 없으면 긴급하지 않다', () => {
    expect(isUrgent(todo(), 3, today)).toBe(false);
  });

  test('오늘 마감이면 긴급하다', () => {
    expect(isUrgent(todo({ dueDate: '2026-07-27' }), 3, today)).toBe(true);
  });

  test('기준일수 안쪽 경계(모레)는 긴급하다', () => {
    expect(isUrgent(todo({ dueDate: '2026-07-29' }), 3, today)).toBe(true);
  });

  test('기준일수 바깥 경계(3일 뒤)는 긴급하지 않다', () => {
    expect(isUrgent(todo({ dueDate: '2026-07-30' }), 3, today)).toBe(false);
  });

  test('마감일이 지난 항목은 항상 긴급하다', () => {
    expect(isUrgent(todo({ dueDate: '2026-07-01' }), 3, today)).toBe(true);
  });

  test('기준일수를 늘리면 더 먼 마감도 긴급해진다', () => {
    expect(isUrgent(todo({ dueDate: '2026-07-30' }), 7, today)).toBe(true);
  });

  test('수동 고정이 자동 판정보다 우선한다', () => {
    // 마감일상 긴급이지만 긴급하지 않음으로 고정
    expect(isUrgent(todo({ dueDate: '2026-07-27', urgentOverride: false }), 3, today)).toBe(false);
    // 마감일이 없지만 긴급으로 고정
    expect(isUrgent(todo({ urgentOverride: true }), 3, today)).toBe(true);
  });
});

describe('quadrantOf', () => {
  test('중요도·긴급도 조합을 분면에 대응시킨다', () => {
    expect(quadrantOf(true, true)).toBe('do');
    expect(quadrantOf(true, false)).toBe('plan');
    expect(quadrantOf(false, true)).toBe('quick');
    expect(quadrantOf(false, false)).toBe('later');
  });

  test('important가 없는 기존 할 일은 중요하지 않음으로 본다', () => {
    expect(quadrantOfTodo(todo(), 3, today)).toBe('later');
    expect(quadrantOfTodo(todo({ dueDate: '2026-07-27' }), 3, today)).toBe('quick');
  });
});

describe('moveToQuadrant', () => {
  test('세로 이동은 important만 바꾸고 고정을 남기지 않는다', () => {
    const before = todo({ dueDate: '2026-07-27' }); // 자동 판정: 긴급
    const after = moveToQuadrant(before, 'do', 3, today);
    expect(after.important).toBe(true);
    expect('urgentOverride' in after).toBe(false);
  });

  test('가로 이동은 목적지 긴급값으로 고정한다', () => {
    const before = todo({ dueDate: '2026-07-27' }); // 자동 판정: 긴급
    const after = moveToQuadrant(before, 'later', 3, today);
    expect(after.important).toBe(false);
    expect(after.urgentOverride).toBe(false);
  });

  test('대각선 이동은 둘 다 바꾼다', () => {
    const before = todo({ dueDate: '2026-07-27' });
    const after = moveToQuadrant(before, 'plan', 3, today);
    expect(after.important).toBe(true);
    expect(after.urgentOverride).toBe(false);
  });

  test('자동 판정과 같은 칸으로 옮기면 기존 고정이 해제된다', () => {
    const before = todo({ dueDate: '2026-07-27', urgentOverride: false });
    const after = moveToQuadrant(before, 'do', 3, today); // 자동 판정도 긴급
    expect('urgentOverride' in after).toBe(false);
  });

  test('마감일이 없는 항목을 긴급 칸으로 옮기면 고정된다', () => {
    const after = moveToQuadrant(todo(), 'quick', 3, today);
    expect(after.urgentOverride).toBe(true);
  });

  test('원본을 변경하지 않는다', () => {
    const before = todo({ dueDate: '2026-07-27' });
    moveToQuadrant(before, 'later', 3, today);
    expect(before.important).toBeUndefined();
    expect(before.urgentOverride).toBeUndefined();
  });
});

describe('clearUrgentOverride', () => {
  test('고정을 제거해 자동 판정으로 되돌린다', () => {
    const after = clearUrgentOverride(todo({ dueDate: '2026-07-27', urgentOverride: false }));
    expect('urgentOverride' in after).toBe(false);
    expect(isUrgent(after, 3, today)).toBe(true);
  });
});
