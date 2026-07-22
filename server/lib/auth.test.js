import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  makeSessionToken,
  verifySessionToken,
  checkPassword,
  parseCookies,
  authEnabled,
} from './auth.js';

process.env.SESSION_SECRET = 'test-session-secret';
process.env.APP_PASSWORD = 'hunter2';

test('발급한 세션 토큰은 검증을 통과한다', () => {
  const tok = makeSessionToken();
  assert.equal(verifySessionToken(tok), true);
});

test('변조된 토큰은 거부한다', () => {
  const tok = makeSessionToken();
  assert.equal(verifySessionToken(tok.slice(0, -3) + 'xxx'), false);
});

test('만료된 토큰은 거부한다', () => {
  const expired = makeSessionToken(-1000);
  assert.equal(verifySessionToken(expired), false);
});

test('빈/형식오류 토큰은 거부한다', () => {
  assert.equal(verifySessionToken(''), false);
  assert.equal(verifySessionToken('nodot'), false);
});

test('올바른 비밀번호만 통과한다', () => {
  assert.equal(checkPassword('hunter2'), true);
  assert.equal(checkPassword('wrong'), false);
  assert.equal(checkPassword(''), false);
});

test('쿠키 헤더를 파싱한다', () => {
  assert.deepEqual(parseCookies('session=abc; other=1'), { session: 'abc', other: '1' });
  assert.deepEqual(parseCookies(undefined), {});
});

test('APP_PASSWORD가 있으면 인증이 켜진 것으로 본다', () => {
  assert.equal(authEnabled(), true);
});
