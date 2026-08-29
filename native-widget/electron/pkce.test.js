import { describe, expect, test } from 'vitest';
import { generateCodeVerifier, codeChallengeFromVerifier } from './pkce';

describe('pkce', () => {
  test('generateCodeVerifier는 43자 이상의 base64url 문자열을 만든다', () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('호출할 때마다 다른 verifier를 만든다', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  test('같은 verifier는 항상 같은 challenge를 만든다', () => {
    const v = generateCodeVerifier();
    expect(codeChallengeFromVerifier(v)).toBe(codeChallengeFromVerifier(v));
  });

  test('다른 verifier는 다른 challenge를 만든다', () => {
    expect(codeChallengeFromVerifier('aaaa')).not.toBe(codeChallengeFromVerifier('bbbb'));
  });
});
