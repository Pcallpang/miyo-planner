import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';

/** 임의의 비밀 문자열에서 32바이트 대칭키를 파생한다. */
export function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret), 'utf-8').digest();
}

/**
 * 평문을 AES-256-GCM으로 암호화한다.
 * 반환 형식: base64(iv).base64(authTag).base64(ciphertext)
 */
export function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

/** encrypt로 만든 문자열을 복호화한다. 변조·잘못된 키면 예외를 던진다. */
export function decrypt(payload, key) {
  const [ivB64, tagB64, dataB64] = String(payload).split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('암호문 형식이 올바르지 않습니다.');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return dec.toString('utf-8');
}
