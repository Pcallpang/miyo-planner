import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';

process.env.TOKEN_ENC_KEY = 'unit-test-key';
const { saveStore, loadStore, clearStore } = await import('./tokenStore.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.resolve(__dirname, '../data/tokens.json');

after(() => clearStore());

test('저장 후 로드하면 동일한 store가 나온다', () => {
  const store = { email: 'a@b.com', tokens: { refresh_token: 'rt', access_token: 'at' } };
  saveStore(store);
  assert.deepEqual(loadStore(), store);
});

test('디스크의 tokens.json은 평문 JSON이 아니다(암호화됨)', () => {
  saveStore({ email: 'secret@b.com', tokens: { refresh_token: 'topsecret' } });
  const onDisk = fs.readFileSync(TOKEN_FILE, 'utf-8');
  assert.ok(!onDisk.includes('topsecret'));
  assert.ok(!onDisk.trim().startsWith('{'));
});

test('레거시 평문 JSON도 읽을 수 있다', () => {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ email: 'legacy@b.com', tokens: {} }), 'utf-8');
  assert.equal(loadStore().email, 'legacy@b.com');
});
