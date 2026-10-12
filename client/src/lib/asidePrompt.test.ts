import { describe, expect, test } from 'vitest';
import { buildAsidePurchasePrompt, purchaseTitleFromDraft } from './asidePrompt';
import type { ProcurementItem } from '../types';

describe('buildAsidePurchasePrompt', () => {
  const items: ProcurementItem[] = [
    { name: '색연필', spec: '12색', unit: '세트', qty: 2, unitPrice: 3500, vendor: '', sourceUrl: '' },
    { name: '스케치북', spec: '', unit: '개', qty: 3, unitPrice: 2000, vendor: '', sourceUrl: '' },
  ];

  test('품목이 없으면 안내 문구만 반환한다', () => {
    const text = buildAsidePurchasePrompt({ body: '본문' }, []);
    expect(text).toContain('품목 내역이 비어 있습니다');
  });

  test('특정 AI 이름 없이 Aside 브라우저의 에듀파인을 가리키며 시작한다', () => {
    const text = buildAsidePurchasePrompt({ body: '본문' }, items);
    expect(text.startsWith('Aside 브라우저에 로그인된 K-에듀파인의 품의등록 화면에')).toBe(true);
    expect(text).not.toMatch(/Claude|Codex|aside exec/);
  });

  test('메뉴 경로는 학교회계 → 사업관리 → 품의/정산 → 품의등록이다', () => {
    const text = buildAsidePurchasePrompt({ body: '본문' }, items);
    expect(text).toContain('학교회계 → 사업관리 → 품의/정산 → 품의등록');
    expect(text).not.toContain('사업담당');
  });

  test('예산 선택·품목 내역은 교사 몫으로 남기고 손대지 않게 한다', () => {
    const text = buildAsidePurchasePrompt({ body: '본문' }, items);
    expect(text).toContain('예산 선택과 품목 내역은 내가 직접 할 거야');
    expect(text).not.toContain('3,500원');
  });

  test('저장·결재요청·결재올림을 누르지 않고 제목·개요 입력 후 멈춘다', () => {
    const text = buildAsidePurchasePrompt({ body: '본문' }, items);
    expect(text).toContain('저장·결재요청·결재올림은 누르지 마');
    expect(text).toContain('거기서 멈추고');
  });

  test('본문은 [개요] 아래에 그대로 들어간다', () => {
    const body = '1. 물리학2 수업에 필요한 물품을 구입하고자 합니다.\n  가. 품의 개요  끝.';
    const text = buildAsidePurchasePrompt({ body }, items);
    expect(text.endsWith(`[개요]\n${body}`)).toBe(true);
  });

  test('제목은 기안문 목적 문장에서 "~ 물품 구입" 형태로 뽑는다', () => {
    const body = '1. 물리학2 수업에 필요한 물품을 구입하고자 합니다.\n  가. 품의 개요\n    1) 품목: 색연필 외 1종  끝.';
    const text = buildAsidePurchasePrompt({ body }, items);
    expect(text).toContain('제목에 "물리학2 수업에 필요한 물품 구입"을 입력해');
  });

  test('관련 근거 줄은 건너뛰고 목적 문장에서 제목을 뽑는다', () => {
    const body = '1. 관련: 2026학년도 예산 편성 계획\n\n2. 과학 실험 수업에 필요한 소모품을 구매하고자 함.\n  가. 품의 개요  끝.';
    expect(purchaseTitleFromDraft(body)).toBe('과학 실험 수업에 필요한 소모품 구입');
  });

  test('목적 문장에 구입·구매가 없으면 끝맺음을 떼고 "물품 구입"을 붙인다', () => {
    expect(purchaseTitleFromDraft('1. 학생 탐구 활동 지원을 하고자 합니다.')).toBe('학생 탐구 활동 지원 물품 구입');
  });

  test('목적 문장을 찾지 못하면 배송비를 뺀 대표 품명 요약으로 만든다', () => {
    const withShipping: ProcurementItem[] = [
      ...items,
      { name: '배송비', spec: '', unit: '건', qty: 1, unitPrice: 3000, vendor: '', sourceUrl: '' },
    ];
    const text = buildAsidePurchasePrompt({ body: '본문' }, withShipping);
    expect(text).toContain('제목에 "색연필 외 1종 구입"을 입력해');
  });

  test('제목을 주면 그 제목을 쓴다', () => {
    const text = buildAsidePurchasePrompt({ title: '물리 실험 소모품 구입', body: '본문' }, items);
    expect(text).toContain('제목에 "물리 실험 소모품 구입"을 입력해');
  });
});
