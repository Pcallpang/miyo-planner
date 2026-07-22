import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRetryAfterSeconds, isQuotaError } from './geminiErrors.js';

test('"Please retry in 31.03s" 형태에서 초를 올림해 추출한다', () => {
  const msg = 'You exceeded your current quota. Please retry in 31.034094265s. [links]';
  assert.equal(parseRetryAfterSeconds(msg), 32);
});

test('"retryDelay":"7s" 형태에서 초를 추출한다', () => {
  const msg = '{"@type":"...RetryInfo","retryDelay":"7s"}';
  assert.equal(parseRetryAfterSeconds(msg), 7);
});

test('재시도 정보가 없으면 null을 반환한다', () => {
  assert.equal(parseRetryAfterSeconds('some other error'), null);
});

test('빈 입력에도 안전하게 null을 반환한다', () => {
  assert.equal(parseRetryAfterSeconds(undefined), null);
  assert.equal(parseRetryAfterSeconds(''), null);
});

test('429 상태는 할당량 오류로 판정한다', () => {
  assert.equal(isQuotaError({ status: 429 }), true);
  assert.equal(isQuotaError({ status: 500 }), false);
});

test('상태코드가 없어도 메시지에 quota가 있으면 할당량 오류로 판정한다', () => {
  assert.equal(isQuotaError({ message: '[429 Too Many Requests] You exceeded your current quota' }), true);
  assert.equal(isQuotaError({ message: 'model not found' }), false);
});
