import { Router } from 'express';
import { getCalendarApi } from '../lib/google.js';

const router = Router();
const TZ = 'Asia/Seoul';

function sendError(res, e, fallback) {
  const status = e.status || e.code || 500;
  const msg = e.status === 401 ? e.message : fallback;
  console.error('[calendar]', e.message);
  res.status(typeof status === 'number' && status >= 400 && status < 600 ? status : 500).json({ error: msg });
}

/** "HH:mm"에 분을 더한다 (23:59 상한) */
function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** YYYY-MM-DD 다음 날 */
function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 요청 본문 → Google Calendar 이벤트 리소스 */
function toResource({ title, date, endDate, startTime, endTime, allDay, location, description }) {
  const resource = {
    summary: title || '(제목 없음)',
    location: location || undefined,
    description: description || undefined,
  };
  if (allDay || !startTime) {
    resource.start = { date };
    resource.end = { date: nextDay(endDate || date) };
  } else {
    const end = endTime || addMinutes(startTime, 60);
    resource.start = { dateTime: `${date}T${startTime}:00`, timeZone: TZ };
    resource.end = { dateTime: `${endDate || date}T${end}:00`, timeZone: TZ };
  }
  return resource;
}

function mapEvent(item, calendarId) {
  return {
    id: item.id,
    calendarId,
    title: item.summary || '(제목 없음)',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    allDay: Boolean(item.start?.date),
    location: item.location || '',
    description: item.description || '',
  };
}

router.get('/calendars', async (req, res) => {
  try {
    const api = await getCalendarApi(req.userId);
    const { data } = await api.calendarList.list({ maxResults: 100 });
    const calendars = (data.items || [])
      .filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
      .map((c) => ({ id: c.id, name: c.summary, primary: Boolean(c.primary) }));
    res.json({ calendars });
  } catch (e) {
    sendError(res, e, '캘린더 목록을 불러오지 못했습니다.');
  }
});

router.get('/events', async (req, res) => {
  const { calendarId = 'primary', timeMin, timeMax } = req.query;
  try {
    const api = await getCalendarApi(req.userId);
    const { data } = await api.events.list({
      calendarId: String(calendarId),
      timeMin: String(timeMin),
      timeMax: String(timeMax),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    });
    res.json({ events: (data.items || []).map((i) => mapEvent(i, String(calendarId))) });
  } catch (e) {
    sendError(res, e, '일정을 불러오지 못했습니다.');
  }
});

router.post('/events', async (req, res) => {
  const { calendarId = 'primary' } = req.body;
  try {
    const api = await getCalendarApi(req.userId);
    const { data } = await api.events.insert({
      calendarId,
      requestBody: toResource(req.body),
    });
    res.json({ event: mapEvent(data, calendarId) });
  } catch (e) {
    sendError(res, e, '일정 등록에 실패했습니다.');
  }
});

router.patch('/events/:id', async (req, res) => {
  const { calendarId = 'primary' } = req.body;
  try {
    const api = await getCalendarApi(req.userId);
    const { data } = await api.events.patch({
      calendarId,
      eventId: req.params.id,
      requestBody: toResource(req.body),
    });
    res.json({ event: mapEvent(data, calendarId) });
  } catch (e) {
    sendError(res, e, '일정 수정에 실패했습니다.');
  }
});

router.delete('/events/:id', async (req, res) => {
  const { calendarId = 'primary' } = req.query;
  try {
    const api = await getCalendarApi(req.userId);
    await api.events.delete({ calendarId: String(calendarId), eventId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    sendError(res, e, '일정 삭제에 실패했습니다.');
  }
});

export default router;
