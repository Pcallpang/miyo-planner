import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeExtractedItems, validateIssueBody, buildProcurementWorkbook } from './procurementExcel.js';

test('normalizeExtractedItems는 배열 응답에서 필수 필드를 채워 정규화한다', () => {
  const items = normalizeExtractedItems([{ name: ' 색연필 ', unitPrice: '3500' }, { name: '스케치북', unitPrice: 2000 }]);
  assert.equal(items.length, 2);
  assert.equal(items[0].name, '색연필');
  assert.equal(items[0].unit, '개');
  assert.equal(items[0].qty, 1);
  assert.equal(items[0].unitPrice, 3500);
  assert.equal(items[1].name, '스케치북');
});

test('normalizeExtractedItems는 단일 객체 응답도 받아들인다', () => {
  const items = normalizeExtractedItems({ name: '색연필', unitPrice: 3500 });
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '색연필');
});

test('normalizeExtractedItems는 상품명 없는 항목을 걸러내고, 빈 입력은 빈 배열', () => {
  assert.deepEqual(normalizeExtractedItems([{ name: '  ' }, { name: '스케치북', unitPrice: 1000 }]).map((i) => i.name), ['스케치북']);
  assert.deepEqual(normalizeExtractedItems(null), []);
});

test('validateIssueBody는 제목이 없으면 에러', () => {
  const result = validateIssueBody({ items: [{ name: 'a', qty: 1, unitPrice: 100 }] });
  assert.ok(result.error);
});

test('validateIssueBody는 품목이 비어 있으면 에러', () => {
  const result = validateIssueBody({ title: '제목' });
  assert.ok(result.error);
});

test('validateIssueBody는 정상 입력을 정규화하고 합계를 계산한다', () => {
  const result = validateIssueBody({
    title: '3학년 미술 재료',
    items: [
      { name: '색연필', qty: 2, unitPrice: 3500 },
      { name: '스케치북', qty: '3', unitPrice: '2000' },
    ],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].amount, 7000);
  assert.equal(result.items[1].amount, 6000);
  assert.equal(result.totalAmount, 13000);
});

test('buildProcurementWorkbook은 sample 템플릿의 2행부터 품목을 채운다', async () => {
  const request = {
    items: [
      { name: '색연필', spec: '12색', unit: '세트', qty: 2, unitPrice: 3500 },
      { name: '스케치북', spec: '', unit: '개', qty: 3, unitPrice: 2000 },
    ],
  };
  const workbook = await buildProcurementWorkbook(request);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.getCell('A2').value, '색연필');
  assert.equal(sheet.getCell('B2').value, '12색');
  assert.equal(sheet.getCell('C2').value, '세트');
  assert.equal(sheet.getCell('D2').value, 2);
  assert.equal(sheet.getCell('E2').value, 3500);
  assert.equal(sheet.getCell('A3').value, '스케치북');
  assert.equal(sheet.getCell('D3').value, 3);
});
