import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberToKorean, formatKoreanCurrency } from './koreanNumber.js';

test('numberToKorean은 0을 영으로 표기한다', () => {
  assert.equal(numberToKorean(0), '영');
});

test('numberToKorean은 십/백/천 앞의 1을 생략한다', () => {
  assert.equal(numberToKorean(1), '일');
  assert.equal(numberToKorean(10), '십');
  assert.equal(numberToKorean(100), '백');
  assert.equal(numberToKorean(1000), '천');
});

test('numberToKorean은 만 단위 앞의 1은 생략하지 않는다', () => {
  assert.equal(numberToKorean(10000), '일만');
  assert.equal(numberToKorean(100000000), '일억');
});

test('numberToKorean은 사용자 예시(450000)를 정확히 변환한다', () => {
  assert.equal(numberToKorean(450000), '사십오만');
});

test('numberToKorean은 복합 자릿수를 처리한다', () => {
  assert.equal(numberToKorean(123456), '십이만삼천사백오십육');
});

test('formatKoreanCurrency는 공문서 표기 형식을 만든다', () => {
  assert.equal(formatKoreanCurrency(450000), '금450,000원(금사십오만원)');
});
