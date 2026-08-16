import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isQuotaError, parseRetryAfterSeconds } from '../lib/geminiErrors.js';
import { decrypt, deriveKey } from '../lib/crypto.js';
import {
  getUserGeminiKeyEnc,
  createProcurementRequest,
  getProcurementHistory,
  getProcurementRequestById,
} from '../lib/db.js';
import { normalizeExtractedItems, validateIssueBody, buildProcurementWorkbook } from '../lib/procurementExcel.js';

const router = Router();

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

const EXTRACT_PROMPT = `당신은 쇼핑몰(G마켓/쿠팡/옥션/11번가 등) 상품 페이지 캡쳐 이미지를 보고 물품구매 품의서 작성에 필요한 정보를 추출하는 학교 행정 비서입니다.
이미지 한 장에 상품이 여러 개 보일 수 있습니다(장바구니 화면, 검색 결과, 여러 옵션 등). 보이는 상품을 전부 각각 추출해
다음 JSON **배열**로만 응답하세요 (상품이 1개뿐이어도 배열 안에 객체 1개로 응답):
[
  {
    "name": "상품명 (간결하게, 핵심 옵션명 포함 가능)",
    "spec": "규격/옵션 (색상·사이즈 등, 없으면 빈 문자열)",
    "unit": "단위 (개/세트/box/묶음 등, 알 수 없으면 \"개\")",
    "qty": 수량(숫자, 이미지에 명시되어 있지 않으면 1),
    "unitPrice": 낱개 단가(숫자, 원 단위, 콤마·통화기호 제외),
    "vendor": "판매 사이트명 (G마켓/쿠팡/옥션/11번가 등, 알 수 없으면 빈 문자열)"
  }
]
배열 외의 다른 텍스트는 절대 출력하지 마세요.`;

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

router.post('/extract', async (req, res) => {
  const { image, mimeType } = req.body || {};
  const geminiKey = await resolveGeminiKey(req.userId);
  if (!geminiKey) {
    return res.status(503).json({
      error: 'Gemini API 키가 없습니다. 환경 설정에서 본인의 Gemini API 키를 연결해 주세요.',
    });
  }
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: '이미지를 첨부해 주세요.' });
  }
  const type = ALLOWED_MIME.includes(mimeType) ? mimeType : 'image/png';
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent([
      EXTRACT_PROMPT,
      { inlineData: { mimeType: type, data: image } },
    ]);
    const rawText = result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return res.status(502).json({ error: 'Gemini 응답을 해석하지 못했습니다. 다시 시도해 주세요.' });
    }
    const items = normalizeExtractedItems(parsed);
    res.json({ items });
  } catch (e) {
    console.error('[procurement]', e.message);
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

function setExcelDownloadHeaders(res, title) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const safeTitle = (title || '품의서').replace(/["\\]/g, '');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="procurement.xlsx"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.xlsx`,
  );
}

router.post('/issue', async (req, res) => {
  const parsed = validateIssueBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { id, createdAt } = await createProcurementRequest(req.userId, parsed, parsed.items);
    const workbook = await buildProcurementWorkbook({ ...parsed, id, created_at: createdAt });
    setExcelDownloadHeaders(res, parsed.title);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('[procurement] 발행 실패:', e.message);
    res.status(500).json({ error: '품의서 발행에 실패했습니다.' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const requests = await getProcurementHistory(req.userId);
    res.json({ requests });
  } catch (e) {
    console.error('[procurement] 이력 조회 실패:', e.message);
    res.status(500).json({ error: '이력을 불러오지 못했습니다.' });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const request = await getProcurementRequestById(req.params.id, req.userId);
    if (!request) return res.status(404).json({ error: '품의서를 찾을 수 없습니다.' });
    const workbook = await buildProcurementWorkbook(request);
    setExcelDownloadHeaders(res, request.title);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('[procurement] 다운로드 실패:', e.message);
    res.status(500).json({ error: '다운로드에 실패했습니다.' });
  }
});

export default router;
