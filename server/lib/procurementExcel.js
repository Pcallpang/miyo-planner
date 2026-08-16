import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { TEMPLATE_PATH, ITEM_TABLE } from './procurementTemplate.js';

/** 캡쳐 이미지에서 Gemini가 반환한 상품 1개짜리 원시 JSON을 검증·정규화한다. */
function normalizeExtractedItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const qtyNum = Number(raw.qty);
  const priceNum = Number(raw.unitPrice);
  const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? Math.round(qtyNum) : 1;
  const unitPrice = Number.isFinite(priceNum) && priceNum >= 0 ? Math.round(priceNum) : 0;
  return {
    name,
    spec: typeof raw.spec === 'string' ? raw.spec.trim() : '',
    unit: typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : '개',
    qty,
    unitPrice,
    vendor: typeof raw.vendor === 'string' ? raw.vendor.trim() : '',
  };
}

/** 캡쳐 이미지 하나에 상품이 여러 개 보일 수 있으므로 Gemini 응답을 배열로 받아 정규화한다. */
export function normalizeExtractedItems(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : raw ? [raw] : [];
  return list.map(normalizeExtractedItem).filter((item) => item !== null);
}

/** 다운로드 요청 바디의 품목 목록을 검증·정규화한다. 실패 시 { error } 반환. */
export function validateItems(body) {
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0) return { error: '품목을 1개 이상 담아 주세요.' };

  const items = [];
  for (const raw of rawItems) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const qty = Number(raw?.qty);
    const unitPrice = Number(raw?.unitPrice);
    if (!name || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: '품목 정보(상품명·수량·단가)를 확인해 주세요.' };
    }
    items.push({
      name,
      spec: typeof raw.spec === 'string' ? raw.spec.trim() : '',
      unit: typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : '개',
      qty: Math.round(qty),
      unitPrice: Math.round(unitPrice),
    });
  }

  return { items };
}

/** 품목 목록을 K에듀파인 "품목내역" 양식(sample/)에 채운 워크북을 만든다. */
export async function buildProcurementWorkbook(items) {
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(TEMPLATE_PATH)) {
    await workbook.xlsx.readFile(TEMPLATE_PATH);
  } else {
    // sample/ 에 양식 파일이 없으면 동일한 헤더로 새 시트를 만든다.
    const sheet = workbook.addWorksheet('품목내역');
    sheet.getRow(1).values = ['내용', '규격', '단위', '수량', '예상단가'];
  }
  const sheet = workbook.worksheets[0];

  const { startRow, columns } = ITEM_TABLE;
  items.forEach((item, i) => {
    const row = startRow + i;
    sheet.getCell(`${columns.content}${row}`).value = item.name;
    sheet.getCell(`${columns.spec}${row}`).value = item.spec || '';
    sheet.getCell(`${columns.unit}${row}`).value = item.unit || '개';
    sheet.getCell(`${columns.qty}${row}`).value = item.qty;
    sheet.getCell(`${columns.unitPrice}${row}`).value = item.unitPrice;
  });
  return workbook;
}
