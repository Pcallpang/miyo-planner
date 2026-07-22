import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encrypt, decrypt, deriveKey } from './crypto.js';

const key = deriveKey('test-secret');

test('암호화한 값을 복호화하면 원문이 나온다', () => {
  const plain = JSON.stringify({ tokens: { refresh_token: 'abc' }, email: 'a@b.com' });
  const enc = encrypt(plain, key);
  assert.equal(decrypt(enc, key), plain);
});

test('암호문은 원문과 다르고 매번 달라진다(IV 랜덤)', () => {
  const enc1 = encrypt('hello', key);
  const enc2 = encrypt('hello', key);
  assert.notEqual(enc1, 'hello');
  assert.notEqual(enc1, enc2);
});

test('다른 키로는 복호화가 실패한다', () => {
  const enc = encrypt('secret', key);
  assert.throws(() => decrypt(enc, deriveKey('other-secret')));
});

test('변조된 암호문은 복호화가 실패한다(무결성)', () => {
  const enc = encrypt('secret', key);
  const tampered = enc.slice(0, -2) + (enc.endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => decrypt(tampered, key));
});

test('deriveKey는 32바이트 키를 만든다', () => {
  assert.equal(deriveKey('anything').length, 32);
});
