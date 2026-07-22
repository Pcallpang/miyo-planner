/**
 * Gemini 오류 응답에서 재시도까지 대기할 초를 추출한다.
 * "Please retry in 31.03s" 또는 "retryDelay":"7s" 형태를 인식하며,
 * 소수는 올림해 정수 초로 반환한다. 정보가 없으면 null.
 */
export function parseRetryAfterSeconds(message) {
  if (typeof message !== 'string' || !message) return null;

  const retry = message.match(/retry in\s+([\d.]+)s/i);
  if (retry) return Math.ceil(Number(retry[1]));

  const delay = message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  if (delay) return Math.ceil(Number(delay[1]));

  return null;
}

/** Gemini 오류가 할당량/요청 한도 초과인지 판정한다. */
export function isQuotaError(error) {
  if (!error) return false;
  if (error.status === 429) return true;
  const msg = typeof error.message === 'string' ? error.message : '';
  return /\b429\b|quota|too many requests/i.test(msg);
}
