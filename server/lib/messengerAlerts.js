import crypto from 'node:crypto';

const PHONE_RE = /01([0-9])[-.\s]?(\d{3,4})[-.\s]?(\d{4})/g;

/** 010-1234-5678 / 01012345678 형태를 010-****-**78 로 가린다. */
export function maskPhoneNumbers(text) {
  if (typeof text !== 'string') return text;
  return text.replace(PHONE_RE, (_, carrier, mid, last) => `01${carrier}-${'*'.repeat(mid.length)}-**${last.slice(-2)}`);
}

/** (발신자, 수신시각, 본문)으로 중복 방지용 해시를 만든다. */
export function messageHash({ sender, receivedAt, body }) {
  return crypto
    .createHash('sha256')
    .update(`${sender ?? ''}|${receivedAt ?? ''}|${body ?? ''}`)
    .digest('hex');
}
