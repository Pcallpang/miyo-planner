import { Router } from 'express';
import {
  listFeatureRequests, createFeatureRequest, deleteFeatureRequest,
  voteFeatureRequest, unvoteFeatureRequest,
} from '../lib/db.js';

const router = Router();
const MAX_LEN = 400; // 클라이언트 글자수 제한과 맞춘다

router.get('/', async (req, res) => {
  try {
    const requests = await listFeatureRequests(req.userId);
    res.json({ requests });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '요청 목록을 불러오지 못했습니다.' }); }
});

router.post('/', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: '내용을 입력해 주세요.' });
  if (text.length > MAX_LEN) return res.status(400).json({ error: `${MAX_LEN}자 이내로 입력해 주세요.` });
  try {
    const request = await createFeatureRequest(req.userId, text);
    res.json({ request });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '등록하지 못했습니다.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await deleteFeatureRequest(req.params.id, req.userId);
    if (!n) return res.status(403).json({ error: '본인이 작성한 요청만 삭제할 수 있습니다.' });
    res.json({ ok: true });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '삭제하지 못했습니다.' }); }
});

router.post('/:id/vote', async (req, res) => {
  try {
    await voteFeatureRequest(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '투표하지 못했습니다.' }); }
});

router.delete('/:id/vote', async (req, res) => {
  try {
    await unvoteFeatureRequest(req.params.id, req.userId);
    res.json({ ok: true });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '투표를 취소하지 못했습니다.' }); }
});

export default router;
