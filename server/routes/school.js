import { Router } from 'express';
import { NeisError, fetchMeals, fetchSchedule, searchSchools } from '../lib/neis.js';

const router = Router();

/**
 * 브라우저에게 이 응답을 얼마나 재사용해도 되는지 알린다.
 *
 * 서버 쪽 캐시(server/lib/neis.js)는 프로세스 메모리라, 서버리스(Vercel)에서는
 * 함수 인스턴스마다 따로 생기고 수시로 사라져 사실상 거의 듣지 않는다.
 * 브라우저 캐시를 함께 쓰면 달을 앞뒤로 오가거나 새로고침할 때 나이스까지 가지 않는다.
 *
 * private = 로그인한 본인 브라우저에만 저장하고 공용 프록시에는 남기지 않는다.
 */
function cacheFor(res, seconds) {
  res.setHeader('Cache-Control', `private, max-age=${seconds}`);
}

/** 급식·학사일정 — 서버 캐시(CACHE_TTL_MS)와 같은 6시간 */
const SCHOOL_DATA_TTL = 6 * 60 * 60;
/** 학교 목록은 거의 바뀌지 않으므로 하루 */
const SCHOOL_SEARCH_TTL = 24 * 60 * 60;

function sendError(res, e, fallback) {
  if (e instanceof NeisError) {
    console.error('[school]', e.message);
    return res.status(e.status).json({ error: e.message });
  }
  console.error('[school]', e);
  res.status(500).json({ error: fallback });
}

/** 학교/기간 파라미터를 검증해 돌려준다. 잘못됐으면 응답을 보내고 null을 반환. */
function readRange(req, res) {
  const { atptCode, schoolCode, from, to } = req.query;
  if (!atptCode || !schoolCode) {
    res.status(400).json({ error: '학교를 먼저 선택해 주세요.' });
    return null;
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(String(from)) || !dateRe.test(String(to))) {
    res.status(400).json({ error: '조회 기간이 올바르지 않습니다.' });
    return null;
  }
  return { atptCode: String(atptCode), schoolCode: String(schoolCode), from: String(from), to: String(to) };
}

router.get('/search', async (req, res) => {
  const name = String(req.query.name ?? '').trim();
  if (name.length < 2) return res.status(400).json({ error: '학교명을 두 글자 이상 입력해 주세요.' });
  try {
    const schools = await searchSchools(name);
    cacheFor(res, SCHOOL_SEARCH_TTL);
    res.json({ schools });
  } catch (e) {
    sendError(res, e, '학교를 검색하지 못했습니다.');
  }
});

router.get('/meals', async (req, res) => {
  const range = readRange(req, res);
  if (!range) return;
  try {
    const meals = await fetchMeals(range);
    cacheFor(res, SCHOOL_DATA_TTL);
    res.json({ meals });
  } catch (e) {
    sendError(res, e, '급식 정보를 불러오지 못했습니다.');
  }
});

router.get('/schedule', async (req, res) => {
  const range = readRange(req, res);
  if (!range) return;
  try {
    const schedule = await fetchSchedule(range);
    cacheFor(res, SCHOOL_DATA_TTL);
    res.json({ schedule });
  } catch (e) {
    sendError(res, e, '학사일정을 불러오지 못했습니다.');
  }
});

export default router;
