// server/routes/messengerAlerts.js
import { Router } from 'express';
import { extractFromNote } from '../lib/noteExtractor.js';
import { maskPhoneNumbers, messageHash } from '../lib/messengerAlerts.js';
import { insertMessengerAlert, listMessengerAlerts, deleteMessengerAlert } from '../lib/db.js';

const router = Router();

// StretchPet 등 로컬 감시 프로그램이 브리티 새 쪽지를 보내는 엔드포인트.
// 여기서 곧바로 캘린더/To-Do에 등록하지 않는다 — "확인 대기" 카드로만 저장한다.
router.post('/ingest', async (req, res) => {
  const { sender, receivedAt, body } = req.body || {};
  if (typeof body !== 'string' || !body.trim()) {
    return res.status(400).json({ error: '쪽지 본문이 없습니다.' });
  }
  const maskedBody = maskPhoneNumbers(body);
  const dedupHash = messageHash({ sender: sender ?? '', receivedAt: receivedAt ?? '', body: maskedBody });
  try {
    const { events, todos } = await extractFromNote(req.userId, maskedBody);
    if (events.length === 0 && todos.length === 0) {
      return res.json({ stored: false, reason: 'no-schedule-found' });
    }
    const saved = await insertMessengerAlert(req.userId, {
      dedupHash,
      sender: typeof sender === 'string' ? sender : null,
      receivedAt: typeof receivedAt === 'string' ? receivedAt : null,
      bodyExcerpt: maskedBody.slice(0, 500),
      events,
      todos,
    });
    res.json({ stored: Boolean(saved) });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('[messenger-alert] ingest 실패:', e.message);
    res.status(502).json({ error: 'Gemini 호출에 실패했습니다.' });
  }
});

router.get('/', async (req, res) => {
  const alerts = await listMessengerAlerts(req.userId);
  res.json({ alerts });
});

// 등록을 마쳤거나 무시하기로 한 카드를 지운다.
router.delete('/:id', async (req, res) => {
  const rowCount = await deleteMessengerAlert(req.params.id, req.userId);
  res.json({ ok: rowCount > 0 });
});

export default router;
