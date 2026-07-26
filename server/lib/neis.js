/**
 * 나이스(NEIS) 교육정보 개방 포털 API 클라이언트.
 * https://open.neis.go.kr/hub/...
 *
 * NEIS_API_KEY가 없으면 인증키 없이(샘플키) 호출된다. 동작은 하지만
 * 일일 호출 한도가 훨씬 낮으므로 운영 환경에서는 키를 등록하는 편이 좋다.
 */

const BASE = 'https://open.neis.go.kr/hub';

/** 응답 캐시 유지 시간 — 급식·학사일정은 하루에 한 번만 받아오면 충분하다. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 300;

const cache = new Map(); // key → { at, value }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // 최근 사용 항목을 뒤로 보내 오래된 것부터 지워지게 한다
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

export class NeisError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const CODE_MESSAGES = {
  'INFO-300': '나이스 인증키 사용 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  'ERROR-290': '나이스 인증키가 올바르지 않습니다.',
  'ERROR-300': '나이스 요청에 필수 값이 빠졌습니다.',
  'ERROR-337': '나이스 일일 호출 한도를 초과했습니다. 내일 다시 시도해 주세요.',
  'ERROR-500': '나이스 서버에 문제가 있습니다.',
  'ERROR-600': '나이스 서버에 문제가 있습니다.',
  'ERROR-601': '나이스 서버에 문제가 있습니다.',
};

/**
 * NEIS 응답에서 row 배열을 꺼낸다.
 * 조회 결과가 없으면(INFO-200) 빈 배열을 돌려준다 — 방학이나 주말이면 정상적인 상황이다.
 */
export function extractRows(body, service) {
  // 오류는 최상위 RESULT로 오기도 하고, service 배열의 head 안에 오기도 한다
  const topCode = body?.RESULT?.CODE;
  if (topCode && topCode !== 'INFO-000') {
    if (topCode === 'INFO-200') return [];
    throw new NeisError(CODE_MESSAGES[topCode] || '나이스 조회에 실패했습니다.');
  }

  const sections = body?.[service];
  if (!Array.isArray(sections)) return [];

  const head = sections.find((s) => s?.head)?.head;
  const code = head?.find((h) => h?.RESULT)?.RESULT?.CODE;
  if (code && code !== 'INFO-000') {
    if (code === 'INFO-200') return [];
    throw new NeisError(CODE_MESSAGES[code] || '나이스 조회에 실패했습니다.');
  }

  return sections.find((s) => s?.row)?.row ?? [];
}

async function call(service, params, { pSize = 100 } = {}) {
  const query = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: String(pSize), ...params });
  if (process.env.NEIS_API_KEY) query.set('KEY', process.env.NEIS_API_KEY);

  const url = `${BASE}/${service}?${query}`;
  const cacheKey = url;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new NeisError('나이스 서버에 연결하지 못했습니다.');
  }
  if (!res.ok) throw new NeisError('나이스 서버 응답이 올바르지 않습니다.');

  const body = await res.json().catch(() => null);
  if (!body) throw new NeisError('나이스 응답을 해석하지 못했습니다.');

  const rows = extractRows(body, service);
  cacheSet(cacheKey, rows);
  return rows;
}

/** "<br/>"로 이어진 나이스 텍스트를 줄 배열로 자른다 */
export function splitLines(text) {
  return String(text ?? '')
    .split(/<br\s*\/?>/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 요리명에서 알레르기 번호를 떼어낸다: "된장국 (5.6)" → { name: '된장국', allergens: ['5','6'] } */
export function parseDish(line) {
  const m = line.match(/^(.*?)\s*\(([\d.\s]+)\)\s*$/);
  if (!m) return { name: line, allergens: [] };
  return {
    name: m[1].trim(),
    allergens: m[2].split('.').map((s) => s.trim()).filter(Boolean),
  };
}

/** YYYYMMDD → YYYY-MM-DD */
export function toDashed(ymd) {
  const s = String(ymd ?? '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
}

/** YYYY-MM-DD → YYYYMMDD */
export function toCompact(date) {
  return String(date ?? '').replace(/-/g, '');
}

export async function searchSchools(name) {
  const rows = await call('schoolInfo', { SCHUL_NM: name }, { pSize: 30 });
  return rows.map((r) => ({
    atptCode: r.ATPT_OFCDC_SC_CODE,
    schoolCode: r.SD_SCHUL_CODE,
    name: r.SCHUL_NM,
    kind: r.SCHUL_KND_SC_NM ?? '',
    region: r.LCTN_SC_NM ?? '',
    address: r.ORG_RDNMA ?? '',
  }));
}

export async function fetchMeals({ atptCode, schoolCode, from, to }) {
  const rows = await call(
    'mealServiceDietInfo',
    {
      ATPT_OFCDC_SC_CODE: atptCode,
      SD_SCHUL_CODE: schoolCode,
      MLSV_FROM_YMD: toCompact(from),
      MLSV_TO_YMD: toCompact(to),
    },
    { pSize: 100 },
  );
  return rows
    .map((r) => ({
      date: toDashed(r.MLSV_YMD),
      type: r.MMEAL_SC_NM ?? '급식',
      dishes: splitLines(r.DDISH_NM).map(parseDish),
      calorie: (r.CAL_INFO ?? '').trim(),
      origin: splitLines(r.ORPLC_INFO),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

export async function fetchSchedule({ atptCode, schoolCode, from, to }) {
  const rows = await call(
    'SchoolSchedule',
    {
      ATPT_OFCDC_SC_CODE: atptCode,
      SD_SCHUL_CODE: schoolCode,
      AA_FROM_YMD: toCompact(from),
      AA_TO_YMD: toCompact(to),
    },
    { pSize: 300 },
  );
  return rows
    .map((r) => ({
      date: toDashed(r.AA_YMD),
      name: (r.EVENT_NM ?? '').trim(),
      content: (r.EVENT_CNTNT ?? '').trim(),
      /** 수업이 없는 날인지 (휴업일·공휴일 등) */
      noClass: Boolean(r.SBTR_DD_SC_NM && r.SBTR_DD_SC_NM !== '해당없음'),
    }))
    .filter((e) => e.name)
    .sort((a, b) => a.date.localeCompare(b.date));
}
