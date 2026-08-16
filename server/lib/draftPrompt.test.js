import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeneralDraftPrompt, buildPurchaseDraftPrompt } from './draftPrompt.js';

test('buildGeneralDraftPrompt는 일시·금액을 이미 완성된 문자열로 그대로 포함한다', () => {
  const prompt = buildGeneralDraftPrompt({
    basis: '',
    purpose: '학년말 학예회를 개최하고자 함',
    dateText: '2026. 8. 20.(목) 14:00 ~ 16:00',
    place: '강당',
    target: '전교생 및 학부모',
    mainContent: '학급별 발표',
    detailPlan: '',
    budget: 450000,
    expectedEffect: '',
    attachments: ['세부 운영 계획서 1부', '참가자 명단 1부'],
  });
  assert.match(prompt, /2026\. 8\. 20\.\(목\) 14:00 ~ 16:00/);
  assert.match(prompt, /금450,000원\(금사십오만원\)/);
  assert.match(prompt, /1\. 세부 운영 계획서 1부/);
  assert.match(prompt, /2\. 참가자 명단 1부/);
  assert.match(prompt, /유형 1\(일반 기안문\)/);
});

test('buildPurchaseDraftPrompt는 품목 표·총금액·품목요약을 서버가 계산해 포함한다', () => {
  const items = [
    { name: '색연필', spec: '12색', unit: '세트', qty: 2, unitPrice: 3500 },
    { name: '스케치북', spec: '', unit: '개', qty: 3, unitPrice: 2000 },
  ];
  const prompt = buildPurchaseDraftPrompt(
    { basis: '', purposeText: '', vendor: '쿠팡', budgetItem: '학교운영비', attachments: [] },
    items,
  );
  assert.match(prompt, /색연필 외 1종/);
  assert.match(prompt, /금13,000원\(금일만삼천원\)/);
  assert.match(prompt, /\| 1 \| 색연필 \| 12색 \| 2세트 \| 3,500 \| 7,000 \|/);
  assert.match(prompt, /\| 2 \| 스케치북 \| - \| 3개 \| 2,000 \| 6,000 \|/);
  assert.match(prompt, /유형 2\(물품\/용역 품의서\)/);
});
