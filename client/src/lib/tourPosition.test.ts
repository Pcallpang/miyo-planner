import { expect, test } from 'vitest';
import { tourPosition } from './tourPosition';

test('넓은 화면에서는 입력 영역 오른쪽에 겹치지 않게 배치한다', () => {
  const p = tourPosition({ left: 300, top: 700, right: 900, bottom: 850 }, 1365, 950, 320);
  expect(p.left).toBeGreaterThan(900);
  expect(p.top + 320).toBeLessThanOrEqual(938);
});
test('좁은 화면과 키보드가 열린 화면에서도 말풍선은 화면 안에 남는다', () => {
  for (const height of [844, 400]) {
    const p = tourPosition({ left: 20, top: 50, right: 370, bottom: 160 }, 390, height, 250);
    expect(p.left).toBeGreaterThanOrEqual(12);
    expect(p.left + p.width).toBeLessThanOrEqual(378);
    expect(p.top).toBeGreaterThanOrEqual(12);
    expect(p.top + Math.min(250, p.maxHeight)).toBeLessThanOrEqual(height - 12);
  }
});
