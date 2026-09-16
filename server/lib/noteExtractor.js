import { GoogleGenerativeAI } from '@google/generative-ai';
import { decrypt, deriveKey } from './crypto.js';
import { getUserGeminiKeyEnc } from './db.js';

function encKey() {
  return deriveKey(process.env.TOKEN_ENC_KEY || 'dev-key');
}

/** 로그인 사용자의 Gemini 키(있으면) 또는 서버 기본 키를 반환. 없으면 null. */
async function resolveGeminiKey(userId) {
  const enc = await getUserGeminiKeyEnc(userId);
  if (enc) {
    try {
      return decrypt(enc, encKey());
    } catch {
      /* 복호화 실패 시 서버 키로 폴백 */
    }
  }
  return process.env.GEMINI_API_KEY || null;
}

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

export function normalizeEvent(raw) {
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

export function normalizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  const category = TODO_CATEGORIES.includes(raw.category) ? raw.category : '업무';
  const dueDate = typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null;
  return { text, category, dueDate };
}

/**
 * 쪽지 원문에서 일정·할 일을 추출한다.
 * 사용자에게 그대로 보여줄 수 있는 실패는 err.status(400/502/503)를 붙여 던진다.
 * Gemini 호출 자체의 실패(쿼터 초과 등)는 status 없이 원래 에러를 그대로 던진다
 * — 호출자가 geminiErrors.js의 isQuotaError로 따로 판별한다.
 */
export async function extractFromNote(userId, text) {
  const geminiKey = await resolveGeminiKey(userId);
  if (!geminiKey) {
    const err = new Error('Gemini API 키가 없습니다. 환경 설정에서 본인의 Gemini API 키를 연결해 주세요.');
    err.status = 503;
    throw err;
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    const err = new Error('쪽지 내용을 입력해 주세요.');
    err.status = 400;
    throw err;
  }
  const genAI = new GoogleGenerativeAI(geminiKey);
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
    const err = new Error('Gemini 응답을 해석하지 못했습니다. 다시 시도해 주세요.');
    err.status = 502;
    throw err;
  }
  const eventList = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.events) ? parsed.events : [];
  const todoList = Array.isArray(parsed?.todos) ? parsed.todos : [];
  return {
    events: eventList.map(normalizeEvent).filter(Boolean),
    todos: todoList.map(normalizeTodo).filter(Boolean),
  };
}
