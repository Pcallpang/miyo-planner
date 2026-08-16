import { describe, expect, test } from 'vitest';
import { buildEventDraft, buildPurchaseDraft } from './draftTemplate';
import type { ProcurementItem } from '../types';

describe('buildEventDraft', () => {
  test('관련 근거가 없으면 목적부터 1번으로 시작한다', () => {
    const text = buildEventDraft({
      basis: '',
      purpose: '학년말 학예회를 개최하고자 함',
      dateText: '2026. 8. 20.(목) 14:00 ~ 16:00',
      place: '강당',
      target: '전교생 및 학부모',
      mainContent: '학급별 발표',
      detailPlan: '',
      budget: 0,
      expectedEffect: '',
      attachments: [],
    });
    assertStartsWithPurpose(text);
    expect(text).toContain('1. 학년말 학예회를 개최하고자 함');
    expect(text).toContain('  가. 일시: 2026. 8. 20.(목) 14:00 ~ 16:00');
    expect(text).toContain('  나. 장소: 강당');
    expect(text.trimEnd().endsWith('학급별 발표  끝.')).toBe(true);

    function assertStartsWithPurpose(t: string) {
      expect(t.startsWith('1.')).toBe(true);
    }
  });

  test('관련 근거가 있으면 관련이 1번, 목적이 2번이 된다', () => {
    const text = buildEventDraft({
      basis: '2026학년도 학사일정 계획',
      purpose: '학년말 학예회를 개최하고자 함',
      dateText: '',
      place: '',
      target: '',
      mainContent: '',
      detailPlan: '',
      budget: 0,
      expectedEffect: '',
      attachments: [],
    });
    expect(text.startsWith('1. 2026학년도 학사일정 계획')).toBe(true);
    expect(text).toContain('2. 학년말 학예회를 개최하고자 함');
  });

  test('소요 예산은 금액이 있을 때만 한글 병기로 표시된다', () => {
    const text = buildEventDraft({
      basis: '',
      purpose: '목적',
      dateText: '',
      place: '',
      target: '',
      mainContent: '',
      detailPlan: '',
      budget: 450000,
      expectedEffect: '',
      attachments: [],
    });
    expect(text).toContain('소요 예산: 금450,000원(금사십오만원)');
  });

  test('붙임이 있으면 끝.이 붙임 마지막 줄에 붙는다', () => {
    const text = buildEventDraft({
      basis: '',
      purpose: '목적',
      dateText: '',
      place: '',
      target: '',
      mainContent: '',
      detailPlan: '',
      budget: 0,
      expectedEffect: '',
      attachments: ['세부 운영 계획서 1부', '참가자 명단 1부'],
    });
    expect(text).toContain('붙임  1. 세부 운영 계획서 1부.');
    expect(text).toContain('2. 참가자 명단 1부.  끝.');
    expect(text.includes('목적  끝.')).toBe(false);
  });
});

describe('buildPurchaseDraft', () => {
  const items: ProcurementItem[] = [
    { name: '색연필', spec: '12색', unit: '세트', qty: 2, unitPrice: 3500, vendor: '', sourceUrl: '' },
    { name: '스케치북', spec: '', unit: '개', qty: 3, unitPrice: 2000, vendor: '', sourceUrl: '' },
  ];

  test('품목이 없으면 안내 문구만 반환한다', () => {
    const text = buildPurchaseDraft({ basis: '', purposeText: '', vendor: '', budgetItem: '', attachments: [] }, []);
    expect(text).toContain('품목 내역이 비어 있습니다');
  });

  test('목적 문구를 비우면 품목·구매처 기반 기본 문구가 생성된다', () => {
    const text = buildPurchaseDraft(
      { basis: '', purposeText: '', vendor: '쿠팡', budgetItem: '학교운영비', attachments: [] },
      items,
    );
    expect(text).toContain('색연필 외 1종 구입을 위하여 다음과 같이 물품을 구입하고자 합니다.');
    expect(text).toContain('총 금액: 금13,000원(금일만삼천원)');
    expect(text).toContain('구매처: 쿠팡');
    expect(text).toContain('예산 비목: 학교운영비');
  });

  test('구매 세부 내역 표가 정확히 만들어진다', () => {
    const text = buildPurchaseDraft(
      { basis: '', purposeText: '목적 문구', vendor: '', budgetItem: '', attachments: [] },
      items,
    );
    expect(text).toContain('| 1 | 색연필 | 12색 | 2세트 | 3,500 | 7,000 |');
    expect(text).toContain('| 2 | 스케치북 | - | 3개 | 2,000 | 6,000 |');
  });

  test('표로 끝나면 끝.이 새 줄에 붙는다(붙임 없을 때)', () => {
    const text = buildPurchaseDraft(
      { basis: '', purposeText: '목적 문구', vendor: '', budgetItem: '', attachments: [] },
      items,
    );
    expect(text.trimEnd().endsWith('|  |\n\n  끝.')).toBe(true);
  });
});
