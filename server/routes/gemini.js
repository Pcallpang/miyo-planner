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
  return `당신은 학교 행정 쪽지·안내문을 분석해 (1)일정과 (2)해야 할 일(To-Do)을 추출하는 교사 비서입니다.
오늘 날짜는 ${date} (${weekday})입니다. '다음 주 화요일', '내일' 같은 상대적 표현은 이 날짜를 기준으로 실제 날짜로 변환하세요.

아래 쪽지 원문에서 일정과 할 일을 추출해 다음 JSON **객체**로만 응답하세요:
{
  "events": [ 일정 배열 ],
  "todos": [ 할 일 배열 ]
}

events 각 항목 스키마:
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

todos 각 항목 스키마 (교사가 직접 준비·처리해야 하는 행동 항목):
{
  "text": "할 일 (한국어, 간결하게)",
  "category": "업무" | "교과" | "개인",
  "dueDate": "YYYY-MM-DD 또는 null (마감·기한이 있으면)"
}

category 분류 기준:
- "업무": 공문·제출물·행정 처리·회의 준비·설문·명단 제출 등 학교 행정/업무
- "교과": 수업 준비·평가·채점·교재·수행평가·시험 출제 등 교과 수업 관련
- "개인": 위에 해당하지 않는 개인적인 준비·기타

규칙:
- 일정(날짜/행사)은 events로, 교사가 능동적으로 해야 하는 행동은 todos로 넣으세요. 하나의 문장이 둘 다에 해당하면 양쪽에 넣어도 됩니다.
- 해당 항목이 없으면 그 배열은 빈 배열 []로 두세요.
- events가 날짜를 추정했으면 needsConfirmation을 true로 하세요.
- JSON 객체 외의 다른 텍스트는 절대 출력하지 마세요.

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

const TODO_CATEGORIES = ['업무', '교과', '개인'];

function normalizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  const category = TODO_CATEGORIES.includes(raw.category) ? raw.category : '업무';
  const dueDate = typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null;
  return { text, category, dueDate };
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
    const eventList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : [];
    const todoList = Array.isArray(parsed?.todos) ? parsed.todos : [];
    const events = eventList.map(normalizeEvent).filter(Boolean);
    const todos = todoList.map(normalizeTodo).filter(Boolean);
    res.json({ events, todos });
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
