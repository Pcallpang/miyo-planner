import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDesktopGoogleConfigured, createDesktopOAuthClient } from './google.js';

test('GOOGLE_DESKTOP_CLIENT_ID/SECRET이 둘 다 있어야 설정된 것으로 본다', () => {
  const prevId = process.env.GOOGLE_DESKTOP_CLIENT_ID;
  const prevSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  delete process.env.GOOGLE_DESKTOP_CLIENT_ID;
  delete process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  assert.equal(isDesktopGoogleConfigured(), false);

  process.env.GOOGLE_DESKTOP_CLIENT_ID = 'id';
  assert.equal(isDesktopGoogleConfigured(), false); // 하나만 있으면 아직 미설정

  process.env.GOOGLE_DESKTOP_CLIENT_SECRET = 'secret';
  assert.equal(isDesktopGoogleConfigured(), true);

  if (prevId === undefined) delete process.env.GOOGLE_DESKTOP_CLIENT_ID;
  else process.env.GOOGLE_DESKTOP_CLIENT_ID = prevId;
  if (prevSecret === undefined) delete process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  else process.env.GOOGLE_DESKTOP_CLIENT_SECRET = prevSecret;
});

test('createDesktopOAuthClient는 code 교환이 가능한 OAuth2 클라이언트를 만든다', () => {
  process.env.GOOGLE_DESKTOP_CLIENT_ID = 'id';
  process.env.GOOGLE_DESKTOP_CLIENT_SECRET = 'secret';
  const client = createDesktopOAuthClient('http://127.0.0.1:12345/callback');
  assert.equal(typeof client.getToken, 'function');
});
