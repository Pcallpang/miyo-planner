import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isQuotaError, parseRetryAfterSeconds } from '../lib/geminiErrors.js';

const router = Router();

function todayInSeoul() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .replace(/\. ?/g, '-')
    .replace(/-$/, '');
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'long' }).format(now);
  return { date, weekday };
}

function buildPrompt(text) {
  const { date, weekday } = todayInSeoul();
  return `당신은 학교 행정 쪽지·안내문에서 일정을 추출하는 비서입니다.
오늘 날짜는 ${date} (${weekday})입니다. '다음 주 화요일', '내일' 같은 상대적 표현은 이 날짜를 기준으로 실제 날짜로 변환하세요.

아래 쪽지 원문에서 일정을 모두 추출해 JSON **배열**로만 응답하세요. 하나의 쪽지에 여러 일정이 있으면 각각 별도 항목으로 분리하세요.

각 항목의 스키마:
{
  "title": "간결한 일정 제목 (한국어)",
  "date": "YYYY-MM-DD",
  "startTime": "HH:mm 또는 null (본문에 시간이 없으면 null)",
  "endTime": "HH:mm 또는 null",
  "allDay": true/false (시간이 명시되지 않았으면 true),
  "location": "장소 또는 null",
  "memo": "원문 핵심 요약 (3줄 이내)",
  "needsConfirmation": true/false (날짜·시간을 추정했거나 애매하면 true)
}

규칙:
- 날짜를 추정해야 했다면(예: 요일만 있음, 애매한 표현) needsConfirmation을 true로 하세요.
- 일정이 하나도 없으면 빈 배열 []을 반환하세요.
- JSON 배열 외의 다른 텍스트는 절대 출력하지 마세요.

쪽지 원문:
"""
${text}
"""`;
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (!date) return null;
  const time = (v) => (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, '0') : null);
  const startTime = time(raw.startTime);
  return {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '(제목 없음)',
    date,
    startTime,
    endTime: time(raw.endTime),
    allDay: raw.allDay === true || !startTime,
    location: typeof raw.location === 'string' ? raw.location : null,
    memo: typeof raw.memo === 'string' ? raw.memo : '',
    needsConfirmation: raw.needsConfirmation === true,
  };
}

router.post('/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Gemini API 키가 설정되지 않았습니다. .env의 GEMINI_API_KEY를 확인하세요.',
    });
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: '쪽지 내용을 입력해 주세요.' });
  }
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(buildPrompt(text));
    const rawText = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(502).json({ error: 'Gemini 응답을 해석하지 못했습니다. 다시 시도해 주세요.' });
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : [];
    const events = list.map(normalizeEvent).filter(Boolean);
    res.json({ events });
  } catch (e) {
    console.error('[gemini]', e.message);
    if (isQuotaError(e)) {
      const retryAfter = parseRetryAfterSeconds(e.message);
      const when = retryAfter ? `약 ${retryAfter}초 후` : '잠시 후';
      return res.status(429).json({
        error: `Gemini 요청 한도를 초과했습니다. ${when} 다시 시도해 주세요.`,
        retryAfter,
      });
    }
    res.status(502).json({ error: 'Gemini 호출에 실패했습니다. API 키와 네트워크를 확인해 주세요.' });
  }
});

export default router;
