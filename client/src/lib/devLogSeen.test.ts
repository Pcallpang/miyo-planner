import { describe, expect, test } from 'vitest';
import { devLogKey, hasUnreadDevLog } from './devLogSeen';

const log = [
  { date: '2026-10-19', title: '새 소식', desc: '' },
  { date: '2026-10-12', title: '이전 소식', desc: '' },
];

describe('hasUnreadDevLog', () => {
  test('아직 본 적이 없으면 안 읽음이다', () => {
    expect(hasUnreadDevLog(null, log)).toBe(true);
  });

  test('최신 항목을 확인했으면 읽음이다', () => {
    expect(hasUnreadDevLog(devLogKey(log[0]), log)).toBe(false);
  });

  test('확인한 뒤 새 항목이 맨 위에 추가되면 다시 안 읽음이다', () => {
    const next = [{ date: '2026-10-20', title: '또 새 소식', desc: '' }, ...log];
    expect(hasUnreadDevLog(devLogKey(log[0]), next)).toBe(true);
  });

  test('항목이 하나도 없으면 안 읽음이 아니다', () => {
    expect(hasUnreadDevLog(null, [])).toBe(false);
  });
});
