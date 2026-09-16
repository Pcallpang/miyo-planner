import assert from 'node:assert/strict';
import { test } from 'node:test';
import { maskPhoneNumbers, messageHash } from './messengerAlerts.js';

test('maskPhoneNumbers는 하이픈 있는 번호를 가린다', () => {
  assert.equal(maskPhoneNumbers('연락처 010-1234-5678 입니다'), '연락처 010-****-**78 입니다');
});

test('maskPhoneNumbers는 하이픈 없는 번호도 가린다', () => {
  assert.equal(maskPhoneNumbers('01012345678로 연락주세요'), '010-****-**78로 연락주세요');
});

test('maskPhoneNumbers는 번호가 없으면 그대로 반환한다', () => {
  assert.equal(maskPhoneNumbers('내일 회의 있습니다'), '내일 회의 있습니다');
});

test('messageHash는 동일 입력에 동일 해시를 낸다', () => {
  const a = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '회의 안내' });
  const b = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '회의 안내' });
  assert.equal(a, b);
});

test('messageHash는 본문이 다르면 다른 해시를 낸다', () => {
  const a = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '회의 안내' });
  const b = messageHash({ sender: '교무실', receivedAt: '2026-09-16T09:00:00+09:00', body: '다른 내용' });
  assert.notEqual(a, b);
});
