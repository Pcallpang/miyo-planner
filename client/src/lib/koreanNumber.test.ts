import { describe, expect, test } from 'vitest';
import { numberToKorean, formatKoreanCurrency } from './koreanNumber';

describe('numberToKorean', () => {
  test('0은 영으로 표기한다', () => {
    expect(numberToKorean(0)).toBe('영');
  });

  test('십/백/천 앞의 1은 생략한다', () => {
    expect(numberToKorean(1)).toBe('일');
    expect(numberToKorean(10)).toBe('십');
    expect(numberToKorean(100)).toBe('백');
    expect(numberToKorean(1000)).toBe('천');
  });

  test('만 단위 앞의 1은 생략하지 않는다', () => {
    expect(numberToKorean(10000)).toBe('일만');
    expect(numberToKorean(100000000)).toBe('일억');
  });

  test('사용자 예시(450000)를 정확히 변환한다', () => {
    expect(numberToKorean(450000)).toBe('사십오만');
  });

  test('복합 자릿수를 처리한다', () => {
    expect(numberToKorean(123456)).toBe('십이만삼천사백오십육');
  });
});

test('formatKoreanCurrency는 공문서 표기 형식을 만든다', () => {
  expect(formatKoreanCurrency(450000)).toBe('금450,000원(금사십오만원)');
});
