import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, FileText, RotateCcw, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DateField from './DateField';
import { buildEventDraft, buildPurchaseDraft } from '../lib/draftTemplate';
import type { ProcurementItem } from '../types';

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';
const labelCls = 'mb-1 block text-sm font-medium text-slate-600';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function currency(n: number) {
  return n.toLocaleString('ko-KR');
}

/** YYYY-MM-DD와 시간을 공문서 표기(2026. 8. 16.(일) 14:00 ~ 16:30)로 조립한다. */
function buildDateText(date: string, startTime: string, endTime: string): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const dateStr = `${y}. ${m}. ${d}.(${weekday})`;
  if (startTime && endTime) return `${dateStr} ${startTime} ~ ${endTime}`;
  if (startTime) return `${dateStr} ${startTime}`;
  return dateStr;
}

function attachmentsFromText(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

type DocType = 'event' | 'purchase';

interface Props {
  items: ProcurementItem[];
  onClose: () => void;
}

export default function DraftDocumentModal({ items, onClose }: Props) {
  const { showToast } = useApp();
  useEscapeKey(onClose);

  const [docType, setDocType] = useState<DocType>(items.length > 0 ? 'purchase' : 'event');
  const [copied, setCopied] = useState(false);

  // 행사 기안문 필드
  const [basis, setBasis] = useState('');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [place, setPlace] = useState('');
  const [target, setTarget] = useState('');
  const [mainContent, setMainContent] = useState('');
  const [budget, setBudget] = useState(0);
  const [attachmentsText, setAttachmentsText] = useState('');

  // 물품 기안문 필드
  const [purposeText, setPurposeText] = useState('');
  const [vendor, setVendor] = useState('');

  const itemsTotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  const generated = useMemo(() => {
    if (docType === 'event') {
      return buildEventDraft({
        basis,
        purpose,
        dateText: buildDateText(date, startTime, endTime),
        place,
        target,
        mainContent,
        budget,
        attachments: attachmentsFromText(attachmentsText),
      });
    }
    return buildPurchaseDraft(
      { basis, purposeText, vendor, attachments: attachmentsFromText(attachmentsText) },
      items,
    );
  }, [
    docType,
    basis,
    purpose,
    date,
    startTime,
    endTime,
    place,
    target,
    mainContent,
    budget,
    purposeText,
    vendor,
    attachmentsText,
    items,
  ]);

  // 사용자가 미리보기를 직접 수정하기 전까지는 입력 폼에 맞춰 실시간으로 갱신된다.
  const [previewText, setPreviewText] = useState(generated);
  const [edited, setEdited] = useState(false);

  useEffect(() => {
    if (!edited) setPreviewText(generated);
  }, [generated, edited]);

  function selectDocType(t: DocType) {
    setDocType(t);
    setEdited(false);
  }

  function resetPreview() {
    setPreviewText(generated);
    setEdited(false);
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('error', '복사에 실패했습니다. 직접 선택해 복사해 주세요.');
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4">
      <div className="flex h-[85vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <FileText size={18} className="text-mint-500" />
            기안문 생성
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* 왼쪽: 입력 폼 */}
          <div className="w-full shrink-0 overflow-y-auto border-b border-slate-100 px-6 py-5 md:w-[420px] md:border-r md:border-b-0">
            <div className="mb-4 flex gap-2">
              {(
                [
                  { id: 'purchase', label: '물품 기안문' },
                  { id: 'event', label: '행사 기안문' },
                ] as { id: DocType; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectDocType(t.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    docType === t.id ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {docType === 'event' && (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className={labelCls}>관련 근거 (선택)</span>
                  <input className={`${inputCls} w-full`} value={basis} onChange={(e) => setBasis(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>목적 개요 *</span>
                  <textarea
                    className={`${inputCls} min-h-16 w-full resize-y`}
                    placeholder="예) 학년말 학예회를 개최하고자 함"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label className="block text-sm">
                    <span className={labelCls}>일시(날짜)</span>
                    <DateField className={`${inputCls} w-full`} value={date} onChange={setDate} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-sm">
                      <span className={labelCls}>시작 시간</span>
                      <input
                        type="time"
                        className={`${inputCls} w-full`}
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className={labelCls}>종료 시간</span>
                      <input
                        type="time"
                        className={`${inputCls} w-full`}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <label className="block text-sm">
                  <span className={labelCls}>장소</span>
                  <input className={`${inputCls} w-full`} value={place} onChange={(e) => setPlace(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>대상 및 인원</span>
                  <input className={`${inputCls} w-full`} value={target} onChange={(e) => setTarget(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>주요 내용</span>
                  <textarea
                    className={`${inputCls} min-h-16 w-full resize-y`}
                    value={mainContent}
                    onChange={(e) => setMainContent(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>소요 예산 (선택, 원)</span>
                  <input
                    type="number"
                    className={`${inputCls} w-full`}
                    value={budget || ''}
                    onChange={(e) => setBudget(Number(e.target.value) || 0)}
                  />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>붙임 (선택, 한 줄에 하나씩)</span>
                  <textarea
                    className={`${inputCls} min-h-14 w-full resize-y`}
                    placeholder={'세부 운영 계획서 1부\n참가자 명단 1부'}
                    value={attachmentsText}
                    onChange={(e) => setAttachmentsText(e.target.value)}
                  />
                </label>
              </div>
            )}

            {docType === 'purchase' && (
              <div className="space-y-3">
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    items.length === 0 ? 'bg-amber-50 text-amber-700' : 'bg-mint-50 text-mint-700'
                  }`}
                >
                  {items.length === 0
                    ? '품목 내역이 비어 있습니다. 먼저 상품을 담아 주세요.'
                    : `${items.length}개 품목 · 합계 ${currency(itemsTotal)}원 — 품목 요약과 총 금액에 반영됩니다.`}
                </div>
                <label className="block text-sm">
                  <span className={labelCls}>관련 근거 (선택)</span>
                  <input className={`${inputCls} w-full`} value={basis} onChange={(e) => setBasis(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>목적 문구 (선택 — 비우면 기본 문구 자동 생성)</span>
                  <textarea
                    className={`${inputCls} min-h-16 w-full resize-y`}
                    placeholder="예) 물리학2 수업에 필요한 물품을 구입하고자 합니다."
                    value={purposeText}
                    onChange={(e) => setPurposeText(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>구매처</span>
                  <input className={`${inputCls} w-full`} value={vendor} onChange={(e) => setVendor(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>붙임 (선택, 한 줄에 하나씩)</span>
                  <textarea
                    className={`${inputCls} min-h-14 w-full resize-y`}
                    placeholder={'견적서 1부\n물품 규격서 1부'}
                    value={attachmentsText}
                    onChange={(e) => setAttachmentsText(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {/* 오른쪽: 실시간 미리보기 (직접 수정 가능) */}
          <div className="flex min-h-[320px] flex-1 flex-col bg-slate-50 px-6 py-5 md:min-h-0">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400">
                {edited ? '미리보기 — 직접 수정 중입니다' : '미리보기 — 입력하는 대로 바로 반영됩니다'}
              </p>
              {edited && (
                <button
                  onClick={resetPreview}
                  className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-mint-600"
                >
                  <RotateCcw size={12} /> 자동 생성으로 되돌리기
                </button>
              )}
            </div>
            <textarea
              value={previewText}
              onChange={(e) => {
                setPreviewText(e.target.value);
                setEdited(true);
              }}
              className="flex-1 resize-none overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 outline-none focus:border-mint-400 focus:ring-2 focus:ring-mint-100"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            닫기
          </button>
          <button
            onClick={() => void copyResult()}
            className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      </div>
    </div>
  );
}
