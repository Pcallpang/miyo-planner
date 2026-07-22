import { Router } from 'express';
import { getAppState, saveAppState } from '../lib/db.js';
import { defaultAppState, mergeAppState } from '../lib/appState.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const stored = await getAppState(req.userId);
    res.json({ state: mergeAppState(defaultAppState(), stored) });
  } catch (e) { console.error('[data]', e.message); res.status(503).json({ error: '데이터를 불러오지 못했습니다.' }); }
});

router.put('/', async (req, res) => {
  const patch = req.body?.state;
  if (!patch || typeof patch !== 'object') return res.status(400).json({ error: '잘못된 요청입니다.' });
  try {
    const current = mergeAppState(defaultAppState(), await getAppState(req.userId));
    await saveAppState(req.userId, mergeAppState(current, patch));
    res.json({ ok: true });
  } catch (e) { console.error('[data]', e.message); res.status(503).json({ error: '저장하지 못했습니다.' }); }
});

export default router;
