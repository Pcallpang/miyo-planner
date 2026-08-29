import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultAppState, mergeAppState } from './appState.js';

test('defaultAppState는 16개 키를 가진다', () => {
  const s = defaultAppState();
  assert.deepEqual(
    Object.keys(s).sort(),
    [
      'canceledLessons', 'ddays', 'holidays', 'lunchAfterPeriod', 'makeupLessons', 'meetings', 'memos',
      'overtimeLogs', 'overtimePunches', 'settings', 'subjectColors', 'subjectLessonNotes',
      'subjectProgress', 'swapOverrides', 'timetable', 'todos',
    ],
  );
  assert.deepEqual(s.todos, []);
  assert.deepEqual(s.holidays, {});
  assert.deepEqual(s.overtimeLogs, []);
  assert.deepEqual(s.overtimePunches, []);
  assert.deepEqual(s.subjectProgress, []);
  assert.deepEqual(s.canceledLessons, []);
  assert.deepEqual(s.swapOverrides, []);
  assert.deepEqual(s.makeupLessons, []);
  assert.deepEqual(s.lunchAfterPeriod, {});
  assert.deepEqual(s.subjectLessonNotes, {});
  assert.deepEqual(s.subjectColors, {});
  assert.deepEqual(s.ddays, []);
  assert.equal(s.settings.periodCount, 7);
});

test('mergeAppState는 holidays 패치를 반영한다', () => {
  const base = defaultAppState();
  const merged = mergeAppState(base, { holidays: { '2026-07-22': '재량휴업일' } });
  assert.deepEqual(merged.holidays, { '2026-07-22': '재량휴업일' });
});

test('mergeAppState는 patch의 키만 덮어쓴다', () => {
  const base = defaultAppState();
  const merged = mergeAppState(base, { todos: [{ id: '1' }] });
  assert.equal(merged.todos.length, 1);
  assert.equal(merged.memos, base.memos); // 안 건드린 키는 유지
});

test('mergeAppState는 빈 patch에 기존을 그대로 반환', () => {
  const base = defaultAppState();
  assert.equal(mergeAppState(base, null), base);
  assert.deepEqual(mergeAppState(base, {}), base);
});
