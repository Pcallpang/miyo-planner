/**
 * 나이스(NEIS) 교육정보 개방 포털 API 클라이언트.
 * https://open.neis.go.kr/hub/...
 *
 * NEIS_API_KEY는 사실상 필수다. 인증키 없이 호출하면 나이스가 pSize·pIndex를 모두
 * 무시하고 언제나 첫 5건만 돌려주므로, 급식·학사일정이 대부분 잘려 나간다.
 * 발급은 무료 — open.neis.go.kr에서 신청한다.
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
  'ERROR-290': '나이스 인증키가 올바르지 않습니다. .env의 NEIS_API_KEY를 확인해 주세요.',
  'ERROR-300': '나이스 요청에 필수 값이 빠졌습니다.',
  'ERROR-337': '나이스 일일 호출 한도를 초과했습니다. 내일 다시 시도해 주세요.',
  'INFO-100': '나이스 인증키가 없습니다. .env에 NEIS_API_KEY를 등록해 주세요.',
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

/** 한 번에 요청할 최대 건수 — 나이스가 허용하는 상한 */
const PAGE_SIZE = 1000;

/** 페이지를 넘겨가며 모을 최대 횟수. 응답이 이상할 때 무한히 도는 것을 막는다 */
const MAX_PAGES = 10;

/**
 * NEIS 응답에서 전체 건수(list_total_count)를 꺼낸다.
 * 값이 없거나 숫자가 아니면 null — 이 경우 페이지 수를 추측하지 않는다.
 */
export function extractTotalCount(body, service) {
  const sections = body?.[service];
  if (!Array.isArray(sections)) return null;
  const head = sections.find((s) => s?.head)?.head;
  if (!Array.isArray(head)) return null;
  const n = head.find((h) => typeof h?.list_total_count === 'number')?.list_total_count;
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new NeisError('나이스 서버에 연결하지 못했습니다.');
  }
  if (!res.ok) throw new NeisError('나이스 서버 응답이 올바르지 않습니다.');

  const body = await res.json().catch(() => null);
  if (!body) throw new NeisError('나이스 응답을 해석하지 못했습니다.');
  return body;
}

/**
 * 나이스 한 서비스를 호출해 모든 행을 모아 돌려준다.
 *
 * 나이스는 한 번에 최대 pSize건만 주므로, 전체 건수(list_total_count)를 보고
 * 남은 페이지가 있으면 pIndex를 올려가며 이어 받는다.
 *
 * 주의: 인증키(NEIS_API_KEY)가 없으면 나이스는 pSize·pIndex를 모두 무시하고
 * 언제나 첫 5건만 준다. 그래서 "받은 행이 pSize보다 적으면 마지막 페이지"라는
 * 조건으로 반드시 빠져나온다 — 같은 페이지를 반복해서 받는 일이 없도록.
 */
async function call(service, params, { pSize = PAGE_SIZE } = {}) {
  const base = new URLSearchParams({ Type: 'json', pSize: String(pSize), ...params });
  if (process.env.NEIS_API_KEY) base.set('KEY', process.env.NEIS_API_KEY);

  const cacheKey = `${service}?${base}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const all = [];
  let total = null;

  for (let pIndex = 1; pIndex <= MAX_PAGES; pIndex += 1) {
    const query = new URLSearchParams(base);
    query.set('pIndex', String(pIndex));

    const body = await fetchJson(`${BASE}/${service}?${query}`);
    const rows = extractRows(body, service);
    if (pIndex === 1) total = extractTotalCount(body, service);

    if (rows.length === 0) break;
    all.push(...rows);

    // 받은 행이 요청한 만큼 꽉 차지 않았다면 마지막 페이지다
    if (rows.length < pSize) break;
    // 전체 건수를 다 받았으면 그만
    if (total !== null && all.length >= total) break;
  }

  if (total !== null && all.length < total && !process.env.NEIS_API_KEY) {
    warnMissingKey(service, all.length, total);
  }

  cacheSet(cacheKey, all);
  return all;
}

let keyWarned = false;

/**
 * 인증키가 없어서 결과가 잘린 경우 한 번만 경고한다.
 * (매 요청마다 찍으면 로그가 시끄러워진다)
 */
function warnMissingKey(service, got, total) {
  if (keyWarned) return;
  keyWarned = true;
  console.warn(
    `[neis] NEIS_API_KEY가 없어 ${service} 결과가 잘렸습니다 (${total}건 중 ${got}건). ` +
      'open.neis.go.kr에서 무료 인증키를 발급받아 .env의 NEIS_API_KEY에 넣어주세요.',
  );
}

/** 서버 기동 시 인증키 설정 여부를 한 번 알린다 */
export function checkNeisKey() {
  if (process.env.NEIS_API_KEY) return true;
  console.warn(
    '[neis] NEIS_API_KEY가 설정되지 않았습니다 — 급식·학사일정이 5건까지만 조회됩니다. ' +
      'open.neis.go.kr에서 무료 인증키를 발급받아 .env에 NEIS_API_KEY=... 로 넣어주세요.',
  );
  return false;
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
