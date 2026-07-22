import type { CalendarInfo, EventInput, GEvent, ParsedEvent, ServerStatus } from '../types';

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

export const api = {
  status: () => request<ServerStatus>('/api/status'),

  sessionLogin: (password: string) =>
    request<{ ok: true }>('/api/session/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  sessionLogout: () => request<{ ok: true }>('/api/session/logout', { method: 'POST' }),

  authUrl: () => request<{ url: string }>('/api/auth/url'),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),

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
    request<{ events: ParsedEvent[] }>('/api/gemini/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};
