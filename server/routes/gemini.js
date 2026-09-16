import { Router } from 'express';
import { isQuotaError, parseRetryAfterSeconds } from '../lib/geminiErrors.js';
import { encrypt, decrypt, deriveKey } from '../lib/crypto.js';
import { saveUserGeminiKey, getUserGeminiKeyEnc, deleteUserGeminiKey } from '../lib/db.js';
import { extractFromNote } from '../lib/noteExtractor.js';

const router = Router();

function encKey() {
  return deriveKey(process.env.TOKEN_ENC_KEY || 'dev-key');
}

// 사용자 Gemini 키 저장(암호화)
router.post('/key', async (req, res) => {
  const key = typeof req.body?.key === 'string' ? req.body.key.trim() : '';
  if (!key) return res.status(400).json({ error: 'Gemini API 키를 입력해 주세요.' });
  try {
    await saveUserGeminiKey(req.userId, encrypt(key, encKey()));
    res.json({ ok: true });
  } catch (e) {
    console.error('[gemini] 키 저장 실패:', e.message);
    res.status(500).json({ error: '키 저장에 실패했습니다.' });
  }
});

// 사용자 Gemini 키 연결 해제
router.delete('/key', async (req, res) => {
  try {
    await deleteUserGeminiKey(req.userId);
    res.json({ ok: true });
  } catch (e) {
    console.error('[gemini] 키 삭제 실패:', e.message);
    res.status(500).json({ error: '키 삭제에 실패했습니다.' });
  }
});

router.post('/parse', async (req, res) => {
  const { text } = req.body || {};
  try {
    const { events, todos } = await extractFromNote(req.userId, text);
    res.json({ events, todos });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
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
