import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeSessionToken, verifySessionToken, parseCookies } from './auth.js';

process.env.SESSION_SECRET = 'test-session-secret';

test('userId를 담은 토큰을 검증하면 userId가 나온다', () => {
  const tok = makeSessionToken('user-123');
  assert.deepEqual(verifySessionToken(tok), { userId: 'user-123' });
});

test('변조 토큰은 null', () => {
  const tok = makeSessionToken('u1');
  assert.equal(verifySessionToken(tok.slice(0, -3) + 'zzz'), null);
});

test('만료 토큰은 null', () => {
  assert.equal(verifySessionToken(makeSessionToken('u1', -1000)), null);
});

test('형식오류/빈 토큰은 null', () => {
  assert.equal(verifySessionToken(''), null);
  assert.equal(verifySessionToken('nodot'), null);
});

test('쿠키 파싱', () => {
  assert.deepEqual(parseCookies('session=abc; x=1'), { session: 'abc', x: '1' });
});
