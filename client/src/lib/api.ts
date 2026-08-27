import type {
  CalendarInfo,
  EventInput,
  ExtractedProductItem,
  FeatureRequest,
  GEvent,
  Meal,
  ParsedEvent,
  ParsedTodo,
  ProcurementItem,
  School,
  SchoolScheduleItem,
  ServerStatus,
} from '../types';

export class ApiError extends Error {
  status: number;
  /** 429 응답 시 재시도까지 대기할 초 (없으면 undefined) */
  retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...init,
    });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 개발 서버가 실행 중인지 확인해 주세요.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body.error || '요청에 실패했습니다.', res.status, body.retryAfter);
  }
  return body as T;
}

/** 파일 이름을 Content-Disposition에서 뽑아낸다. 실패하면 fallback을 쓴다. */
function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* noop */
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

/** 엑셀 등 바이너리 파일을 내려받아 브라우저 저장 다이얼로그를 띄운다. */
async function downloadFile(url: string, init: RequestInit | undefined, fallbackName: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 개발 서버가 실행 중인지 확인해 주세요.', 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || '다운로드에 실패했습니다.', res.status, body.retryAfter);
  }
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackName);
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function schoolQuery(school: School, from: string, to: string) {
  return new URLSearchParams({
    atptCode: school.atptCode,
    schoolCode: school.schoolCode,
    from,
    to,
  }).toString();
}

export const api = {
  status: () => request<ServerStatus>('/api/status'),

  getData: () => request<{ state: import('../types').AppData }>('/api/data'),
  /** keepalive: 탭이 백그라운드로 가거나 닫히는 순간에도 요청이 살아남게 한다(초과근무 기록 유실 방지). */
  putData: (state: Partial<import('../types').AppData>, opts?: { keepalive?: boolean }) =>
    request<{ ok: true }>('/api/data', {
      method: 'PUT',
      body: JSON.stringify({ state }),
      keepalive: opts?.keepalive,
    }),

  authUrl: () => request<{ url: string }>('/api/auth/url'),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  disconnect: () => request<{ ok: true }>('/api/auth/disconnect', { method: 'POST' }),

  /** 자리배치 앱 자동 로그인용 구글 id_token */
  seatingToken: () => request<{ idToken: string; appUrl: string }>('/api/seating/token'),

  calendars: () => request<{ calendars: CalendarInfo[] }>('/api/calendar/calendars'),

  events: (calendarId: string, timeMin: string, timeMax: string) =>
    request<{ events: GEvent[] }>(
      `/api/calendar/events?calendarId=${encodeURIComponent(calendarId)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
    ),

  createEvent: (input: EventInput) =>
    request<{ event: GEvent }>('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateEvent: (id: string, input: EventInput) =>
    request<{ event: GEvent }>(`/api/calendar/events/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteEvent: (id: string, calendarId: string) =>
    request<{ ok: true }>(
      `/api/calendar/events/${encodeURIComponent(id)}?calendarId=${encodeURIComponent(calendarId)}`,
      { method: 'DELETE' },
    ),

  parseNote: (text: string) =>
    request<{ events: ParsedEvent[]; todos: ParsedTodo[] }>('/api/gemini/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  searchSchools: (name: string) =>
    request<{ schools: School[] }>(`/api/school/search?name=${encodeURIComponent(name)}`),

  meals: (school: School, from: string, to: string) =>
    request<{ meals: Meal[] }>(`/api/school/meals?${schoolQuery(school, from, to)}`),

  schoolSchedule: (school: School, from: string, to: string) =>
    request<{ schedule: SchoolScheduleItem[] }>(`/api/school/schedule?${schoolQuery(school, from, to)}`),

  setGeminiKey: (key: string) =>
    request<{ ok: true }>('/api/gemini/key', { method: 'POST', body: JSON.stringify({ key }) }),
  deleteGeminiKey: () => request<{ ok: true }>('/api/gemini/key', { method: 'DELETE' }),

  extractProduct: (image: string, mimeType: string) =>
    request<{ items: ExtractedProductItem[] }>('/api/procurement/extract', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType }),
    }),

  downloadProcurementItems: (items: ProcurementItem[]) =>
    downloadFile(
      '/api/procurement/download',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) },
      '품목내역.xlsx',
    ),

  listFeatureRequests: () => request<{ requests: FeatureRequest[] }>('/api/board'),

  createFeatureRequest: (text: string) =>
    request<{ request: FeatureRequest }>('/api/board', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  deleteFeatureRequest: (id: string) =>
    request<{ ok: true }>(`/api/board/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  voteFeatureRequest: (id: string) =>
    request<{ ok: true }>(`/api/board/${encodeURIComponent(id)}/vote`, { method: 'POST' }),

  unvoteFeatureRequest: (id: string) =>
    request<{ ok: true }>(`/api/board/${encodeURIComponent(id)}/vote`, { method: 'DELETE' }),
};
