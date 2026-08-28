import { Router } from 'express';
import {
  listFeatureRequests, createFeatureRequest, deleteFeatureRequest, deleteFeatureRequestAsAdmin,
  setFeatureRequestCompleted, voteFeatureRequest, unvoteFeatureRequest, getUserById,
} from '../lib/db.js';
import { isAdminEmail } from '../lib/admin.js';

const router = Router();
const MAX_LEN = 400; // 클라이언트 글자수 제한과 맞춘다

/** 요청자가 관리자(=미요쌤)인지 확인한다. */
async function checkAdmin(req) {
  const user = await getUserById(req.userId);
  return isAdminEmail(user?.email);
}

router.get('/', async (req, res) => {
  try {
    const [requests, isAdmin] = await Promise.all([
      listFeatureRequests(req.userId),
      checkAdmin(req),
    ]);
    res.json({ requests, isAdmin });
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
    const admin = await checkAdmin(req);
    const n = admin
      ? await deleteFeatureRequestAsAdmin(req.params.id)
      : await deleteFeatureRequest(req.params.id, req.userId);
    if (!n) return res.status(403).json({ error: '본인이 작성한 요청만 삭제할 수 있습니다.' });
    res.json({ ok: true });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '삭제하지 못했습니다.' }); }
});

/** 완료 표시 토글 — 관리자(=미요쌤) 전용. */
router.patch('/:id/complete', async (req, res) => {
  try {
    if (!(await checkAdmin(req))) return res.status(403).json({ error: '완료 처리 권한이 없습니다.' });
    const completed = Boolean(req.body?.completed);
    const n = await setFeatureRequestCompleted(req.params.id, completed);
    if (!n) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    res.json({ ok: true });
  } catch (e) { console.error('[board]', e.message); res.status(503).json({ error: '완료 처리에 실패했습니다.' }); }
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
