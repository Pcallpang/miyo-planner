import { formatKoreanCurrency } from './koreanNumber';
import type { ProcurementItem } from '../types';

const SUB_LETTERS = ['가', '나', '다', '라', '마', '바'];

/** 항목 부호 + 본문을 규칙에 맞게 조립한다. 여러 줄 텍스트는 이어지는 줄을 본문 시작 위치에 맞춰 들여쓴다. */
function markedLine(indent: number, marker: string, text: string): string {
  const [first, ...rest] = text.split('\n');
  const contIndent = ' '.repeat(indent + marker.length + 1);
  const lines = [`${' '.repeat(indent)}${marker} ${first}`, ...rest.map((r) => contIndent + r)];
  return lines.join('\n');
}

function withPlaceholder(value: string, placeholder: string): string {
  return value.trim() || placeholder;
}

/** 한글 완성형 음절은 모노스페이스 폰트에서 폭이 2칸이므로 들여쓰기 계산 시 2로 센다. */
function visualWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += /[가-힣]/.test(ch) ? 2 : 1;
  }
  return width;
}

/** 마지막 항목이 아니면 종결 표기(마침표 등)를 떼어낸다. */
function stripTerminalPunctuation(text: string): string {
  return text.trim().replace(/[.!?]+$/, '');
}

/** "1부", "1부." 등 사용자가 입력한 마지막 붙임 항목을 규정된 종결 표기(".")로 정리한다. */
function normalizeLastAttachment(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * 붙임 블록: 첫 줄은 "붙임  1. ...", 이어지는 줄은 "1." 시작 위치(전각 폭 기준)에 맞춰 들여쓴다.
 * 마지막 항목 앞까지는 마침표를 붙이지 않고, 마지막 항목에만 마침표와 "  끝."을 붙인다.
 */
function attachmentsBlock(attachments: string[]): string | null {
  const list = attachments.map((a) => a.trim()).filter(Boolean);
  if (list.length === 0) return null;
  const prefix = '붙임';
  const contIndent = ' '.repeat(visualWidth(prefix) + 2);
  const lines = list.map((a, i) =>
    i === list.length - 1 ? `${i + 1}. ${normalizeLastAttachment(a)}` : `${i + 1}. ${stripTerminalPunctuation(a)}`,
  );
  lines[lines.length - 1] += '  끝.';
  return lines.map((l, i) => (i === 0 ? `${prefix}  ${l}` : `${contIndent}${l}`)).join('\n');
}

/** 본문 + 붙임을 합치고 '끝.' 규정을 적용한다: 붙임이 있으면 붙임 마지막 줄에, 없으면 본문 마지막 글자 뒤에 "  끝." */
function finalize(body: string, attachments: string[]): string {
  const attach = attachmentsBlock(attachments);
  if (attach) return `${body}\n\n${attach}`;
  const lines = body.split('\n');
  lines[lines.length - 1] += '  끝.';
  return lines.join('\n');
}

export interface EventDraftFields {
  basis: string;
  purpose: string;
  dateText: string;
  place: string;
  target: string;
  mainContent: string;
  budget: number;
  attachments: string[];
}

/** 행사 기안문을 규칙대로 조립한다 (AI 미사용, 결정론적 템플릿 조립). */
export function buildEventDraft(fields: EventDraftFields): string {
  const parts: string[] = [];
  let n = 1;

  if (fields.basis.trim()) {
    parts.push(markedLine(0, `${n++}.`, `관련: ${fields.basis.trim()}`));
  }

  const purposeLines = [markedLine(0, `${n}.`, withPlaceholder(fields.purpose, '[목적 개요를 입력해 주세요]'))];
  const subs = [
    { label: '일시', value: fields.dateText.trim() },
    { label: '장소', value: fields.place.trim() },
    { label: '대상 및 인원', value: fields.target.trim() },
    { label: '주요 내용', value: fields.mainContent.trim() },
    { label: '소요 예산', value: fields.budget > 0 ? formatKoreanCurrency(fields.budget) : '' },
  ].filter((s) => s.value);
  subs.forEach((s, i) => purposeLines.push(markedLine(2, `${SUB_LETTERS[i]}.`, `${s.label}: ${s.value}`)));
  parts.push(purposeLines.join('\n'));

  return finalize(parts.join('\n\n'), fields.attachments);
}

export interface PurchaseDraftFields {
  basis: string;
  purposeText: string;
  vendor: string;
  attachments: string[];
}

/** "배송비"는 실제 구매 품목이 아니므로 "외 N종" 요약 대상에서 제외한다. */
function itemSummary(items: ProcurementItem[]): string {
  if (items.length === 0) return '[품목 내역을 먼저 담아 주세요]';
  const goods = items.filter((it) => it.name.trim() !== '배송비');
  const list = goods.length > 0 ? goods : items;
  return list.length === 1 ? list[0].name : `${list[0].name} 외 ${list.length - 1}종`;
}

/** 물품 기안문을 규칙대로 조립한다. items가 비어 있으면 안내 문구만 반환한다. */
export function buildPurchaseDraft(fields: PurchaseDraftFields, items: ProcurementItem[]): string {
  if (items.length === 0) {
    return '[품목 내역이 비어 있습니다. 먼저 상품을 담아 주세요.]';
  }

  const totalAmount = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const summary = itemSummary(items);
  const parts: string[] = [];
  let n = 1;

  if (fields.basis.trim()) {
    parts.push(markedLine(0, `${n++}.`, `관련: ${fields.basis.trim()}`));
  }

  const defaultPurpose = '물리학2 수업에 필요한 물품을 구입하고자 합니다.';
  const lines = [markedLine(0, `${n}.`, fields.purposeText.trim() || defaultPurpose)];
  lines.push(markedLine(2, '가.', '품의 개요'));
  const overviewItems = [
    { label: '품목', value: summary },
    { label: '총 금액', value: formatKoreanCurrency(totalAmount) },
    { label: '구매처', value: fields.vendor.trim() },
  ].filter((s) => s.value);
  overviewItems.forEach((s, i) => lines.push(markedLine(4, `${i + 1})`, `${s.label}: ${s.value}`)));
  parts.push(lines.join('\n'));

  return finalize(parts.join('\n\n'), fields.attachments);
}
