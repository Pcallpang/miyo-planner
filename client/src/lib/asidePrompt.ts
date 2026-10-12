import { itemSummary } from './draftTemplate';
import type { ProcurementItem } from '../types';

export interface AsidePurchasePromptFields {
  /** 비우면 기안문 목적 문장에서 "~ 물품 구입" 형태로 뽑는다. */
  title?: string;
  /** 품의 개요(내용) 칸에 들어갈 본문 — 기안문 미리보기 글을 그대로 넘긴다. */
  body: string;
}

/**
 * 물품 기안문의 목적 문장("1. 물리학2 수업에 필요한 물품을 구입하고자 합니다.")에서
 * 품의 제목("물리학2 수업에 필요한 물품 구입")을 뽑는다. "1. 관련:" 줄은 건너뛴다. 못 뽑으면 빈 문자열.
 */
export function purchaseTitleFromDraft(draft: string): string {
  const purposeLine = draft
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^\d+\.\s/.test(l) && !/^\d+\.\s*관련/.test(l));
  if (!purposeLine) return '';

  const text = purposeLine
    .replace(/^\d+\.\s*/, '')
    .replace(/\s*끝\.$/, '')
    .replace(/[.!?]+$/, '')
    .trim();
  if (!text) return '';

  const buy = text.match(/^(.+?)[을를]?\s*(?:구입|구매)/);
  if (buy) return `${buy[1].trim()} 구입`;

  const stem = text
    .replace(/\s*(?:하고자 합니다|하고자 함|하려고 합니다|합니다|함)$/, '')
    .trim()
    .replace(/[을를]$/, '');
  return stem ? `${stem} 물품 구입` : '';
}

/**
 * K-에듀파인 품의등록 화면에 제목·개요 입력을 맡기는 요청문을 조립한다 (AI 미사용, 결정론적 템플릿 조립).
 * Aside 자체 AI, Aside에 연결한 Claude Code·Codex 어디에 붙여넣어도 통하도록 특정 AI의 이름·명령을 쓰지 않는다.
 * 예산 선택·품목 내역·저장은 교사가 직접 하므로, AI는 제목·개요만 입력하고 멈추도록 금지 사항을 본문에 직접 담는다.
 */
export function buildAsidePurchasePrompt(fields: AsidePurchasePromptFields, items: ProcurementItem[]): string {
  if (items.length === 0) {
    return '[품목 내역이 비어 있습니다. 먼저 상품을 담아 주세요.]';
  }

  const title = fields.title?.trim() || purchaseTitleFromDraft(fields.body) || `${itemSummary(items)} 구입`;

  return [
    'Aside 브라우저에 로그인된 K-에듀파인의 품의등록 화면에 제목과 개요를 입력해 줘. 로그인은 내가 이미 해 두었어.',
    '',
    '[할 일]',
    '1. 학교회계 → 사업관리 → 품의/정산 → 품의등록으로 들어가 신규 품의를 열어. 메뉴를 못 찾으면 멈추고 나에게 물어봐.',
    `2. 제목에 "${title}"을 입력해.`,
    '3. 개요(내용) 칸에 아래 [개요]를 그대로 붙여넣어.',
    '4. 제목과 개요를 입력했으면 거기서 멈추고, 입력한 내용을 나에게 알려 줘.',
    '',
    '[꼭 지킬 것]',
    '- 예산 선택과 품목 내역은 내가 직접 할 거야. 예산 선택 창을 열거나 품목 행을 추가하지 마.',
    '- 저장·결재요청·결재올림은 누르지 마. 저장은 내가 예산과 품목을 넣은 뒤 직접 할게.',
    '- 개요 문구를 바꾸거나 없는 내용을 지어내서 채우지 마.',
    '- 별도 창이 열리면 그 창으로 바꿔서 작업해.',
    '- 입력이 안 되는 칸이 있으면 멈추고 알려 줘.',
    '',
    '[개요]',
    fields.body.trim(),
  ].join('\n');
}
