// server/routes/messengerAlerts.js
import { Router } from 'express';
import { extractFromNote } from '../lib/noteExtractor.js';
import { maskPhoneNumbers, messageHash } from '../lib/messengerAlerts.js';
import {
  insertMessengerAlert, listMessengerAlerts, deleteMessengerAlert, messengerAlertExists,
} from '../lib/db.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// StretchPet 등 로컬 감시 프로그램이 브리티 새 쪽지를 보내는 엔드포인트.
// 여기서 곧바로 캘린더/To-Do에 등록하지 않는다 — "확인 대기" 카드로만 저장한다.
router.post('/ingest', async (req, res) => {
  const { sender, receivedAt, body } = req.body || {};
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: '쪽지 본문이 없습니다.' });
  }
  const maskedBody = maskPhoneNumbers(body);
  const maskedSender = typeof sender === 'string' ? maskPhoneNumbers(sender) : null;
  const dedupHash = messageHash({ sender: maskedSender ?? '', receivedAt: receivedAt ?? '', body: maskedBody });
  try {
    // 이미 저장된 쪽지면 Gemini를 다시 호출하지 않는다 (비용 절약, 재시도 큐 대비).
    if (await messengerAlertExists(req.userId, dedupHash)) {
      return res.json({ stored: false, reason: 'duplicate' });
    }
    const { events, todos } = await extractFromNote(req.userId, maskedBody);
    const hasSchedule = events.length > 0 || todos.length > 0;
    // 일정/할 일이 없어도 항상 저장해서 목록에 띄운다 — 선생님이 "이 메시지는
    // 이미 확인했지만 등록할 건 없더라"를 스스로 판단하고 무시할 수 있어야
    // 한다. 자동으로 걸러버리면 "감지는 됐는데 안 보여서 놓친 건지" 알 방법이
    // 없어진다(사용자 요청으로 명시적 절충).
    const saved = await insertMessengerAlert(req.userId, {
      dedupHash,
      sender: maskedSender,
      receivedAt: typeof receivedAt === 'string' ? receivedAt : null,
      bodyExcerpt: maskedBody.slice(0, 500),
      events,
      todos,
    });
    res.json({
      stored: Boolean(saved),
      reason: hasSchedule ? undefined : 'no-schedule-found',
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[messenger-alert] ingest 실패:', e.message);
    res.status(502).json({ error: 'Gemini 호출에 실패했습니다.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const alerts = await listMessengerAlerts(req.userId);
    res.json({ alerts });
  } catch (e) {
    console.error('[messenger-alert] 목록 조회 실패:', e.message);
    res.status(503).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

// 등록을 마쳤거나 무시하기로 한 카드를 지운다.
router.delete('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }
  try {
    const rowCount = await deleteMessengerAlert(req.params.id, req.userId);
    res.json({ ok: rowCount > 0 });
  } catch (e) {
    console.error('[messenger-alert] 삭제 실패:', e.message);
    res.status(503).json({ error: '삭제에 실패했습니다.' });
  }
});

export default router;
