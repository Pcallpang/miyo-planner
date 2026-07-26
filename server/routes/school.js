import { Router } from 'express';
import { NeisError, fetchMeals, fetchSchedule, searchSchools } from '../lib/neis.js';

const router = Router();

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
    res.json({ schools: await searchSchools(name) });
  } catch (e) {
    sendError(res, e, '학교를 검색하지 못했습니다.');
  }
});

router.get('/meals', async (req, res) => {
  const range = readRange(req, res);
  if (!range) return;
  try {
    res.json({ meals: await fetchMeals(range) });
  } catch (e) {
    sendError(res, e, '급식 정보를 불러오지 못했습니다.');
  }
});

router.get('/schedule', async (req, res) => {
  const range = readRange(req, res);
  if (!range) return;
  try {
    res.json({ schedule: await fetchSchedule(range) });
  } catch (e) {
    sendError(res, e, '학사일정을 불러오지 못했습니다.');
  }
});

export default router;
