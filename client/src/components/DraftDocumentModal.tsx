import { useEffect, useState } from 'react';
import { Check, Clipboard, Clock, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DateField from './DateField';
import type { DraftInput, ProcurementItem } from '../types';

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

type DocType = 'general' | 'purchase';

interface Props {
  items: ProcurementItem[];
  onClose: () => void;
}

export default function DraftDocumentModal({ items, onClose }: Props) {
  const { showToast } = useApp();
  useEscapeKey(onClose);

  const [docType, setDocType] = useState<DocType>(items.length > 0 ? 'purchase' : 'general');
  const [generating, setGenerating] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const [resultText, setResultText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 유형 1 필드
  const [basis, setBasis] = useState('');
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [place, setPlace] = useState('');
  const [target, setTarget] = useState('');
  const [mainContent, setMainContent] = useState('');
  const [detailPlan, setDetailPlan] = useState('');
  const [budget, setBudget] = useState(0);
  const [expectedEffect, setExpectedEffect] = useState('');
  const [attachmentsText, setAttachmentsText] = useState('');

  // 유형 2 필드
  const [purposeText, setPurposeText] = useState('');
  const [vendor, setVendor] = useState('');
  const [budgetItem, setBudgetItem] = useState('');

  const itemsTotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  useEffect(() => {
    if (retryIn <= 0) return;
    const id = setInterval(() => setRetryIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [retryIn]);

  async function generate() {
    if (docType === 'general' && !purpose.trim()) {
      showToast('error', '목적 개요를 입력해 주세요.');
      return;
    }
    if (docType === 'purchase' && items.length === 0) {
      showToast('error', '품목 내역에 품목을 먼저 담아 주세요.');
      return;
    }
    const input: DraftInput =
      docType === 'general'
        ? {
            type: 'general',
            basis,
            purpose,
            dateText: buildDateText(date, startTime, endTime),
            place,
            target,
            mainContent,
            detailPlan,
            budget,
            expectedEffect,
            attachments: attachmentsFromText(attachmentsText),
          }
        : {
            type: 'purchase',
            basis,
            purposeText,
            vendor,
            budgetItem,
            attachments: attachmentsFromText(attachmentsText),
            items,
          };

    setGenerating(true);
    try {
      const { text } = await api.generateDraft(input);
      setResultText(text);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setRetryIn(e.retryAfter && e.retryAfter > 0 ? e.retryAfter : 30);
      }
      showToast('error', e instanceof Error ? e.message : '기안문 생성에 실패했습니다.');
    } finally {
      setGenerating(false);
    }
  }

  async function copyResult() {
    if (!resultText) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('error', '복사에 실패했습니다. 직접 선택해 복사해 주세요.');
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <FileText size={18} className="text-mint-500" />
            기안문 생성
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!resultText && (
            <div className="flex gap-2">
              {(
                [
                  { id: 'general', label: '일반 기안문' },
                  { id: 'purchase', label: '물품·용역 품의서' },
                ] as { id: DocType; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDocType(t.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    docType === t.id ? 'bg-mint-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {!resultText && docType === 'general' && (
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
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-sm">
                  <span className={labelCls}>일시(날짜)</span>
                  <DateField className={`${inputCls} w-full`} value={date} onChange={setDate} />
                </label>
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
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className={labelCls}>장소</span>
                  <input className={`${inputCls} w-full`} value={place} onChange={(e) => setPlace(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>대상 및 인원</span>
                  <input className={`${inputCls} w-full`} value={target} onChange={(e) => setTarget(e.target.value)} />
                </label>
              </div>
              <label className="block text-sm">
                <span className={labelCls}>주요 내용</span>
                <textarea
                  className={`${inputCls} min-h-16 w-full resize-y`}
                  value={mainContent}
                  onChange={(e) => setMainContent(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className={labelCls}>세부 추진 계획 (선택)</span>
                <textarea
                  className={`${inputCls} min-h-16 w-full resize-y`}
                  value={detailPlan}
                  onChange={(e) => setDetailPlan(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
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
                  <span className={labelCls}>기대 효과 (선택)</span>
                  <input
                    className={`${inputCls} w-full`}
                    value={expectedEffect}
                    onChange={(e) => setExpectedEffect(e.target.value)}
                  />
                </label>
              </div>
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

          {!resultText && docType === 'purchase' && (
            <div className="space-y-3">
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  items.length === 0 ? 'bg-amber-50 text-amber-700' : 'bg-mint-50 text-mint-700'
                }`}
              >
                {items.length === 0
                  ? '품목 내역이 비어 있습니다. 먼저 상품을 담아 주세요.'
                  : `${items.length}개 품목 · 합계 ${currency(itemsTotal)}원 — 위 품목 내역 표를 그대로 사용합니다.`}
              </div>
              <label className="block text-sm">
                <span className={labelCls}>관련 근거 (선택)</span>
                <input className={`${inputCls} w-full`} value={basis} onChange={(e) => setBasis(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className={labelCls}>목적 문구 (선택 — 비우면 AI가 자동 작성)</span>
                <textarea
                  className={`${inputCls} min-h-16 w-full resize-y`}
                  placeholder="예) 2026학년도 2학기 물리학Ⅱ 실험 실습을 위하여 다음과 같이 물품을 구입하고자 합니다."
                  value={purposeText}
                  onChange={(e) => setPurposeText(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className={labelCls}>구매처</span>
                  <input className={`${inputCls} w-full`} value={vendor} onChange={(e) => setVendor(e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className={labelCls}>예산 비목</span>
                  <input
                    className={`${inputCls} w-full`}
                    value={budgetItem}
                    onChange={(e) => setBudgetItem(e.target.value)}
                  />
                </label>
              </div>
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

          {retryIn > 0 && (
            <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <Clock size={15} />
              요청 한도를 초과했습니다. {retryIn}초 후 다시 시도할 수 있습니다.
            </p>
          )}

          {resultText && (
            <div className="space-y-2">
              <textarea
                readOnly
                className="h-96 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700 outline-none"
                value={resultText}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {resultText ? (
            <>
              <button
                onClick={() => setResultText(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              >
                다시 작성
              </button>
              <button
                onClick={() => void copyResult()}
                className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
              >
                {copied ? <Check size={16} /> : <Clipboard size={16} />}
                {copied ? '복사됨' : '복사'}
              </button>
            </>
          ) : (
            <button
              onClick={() => void generate()}
              disabled={generating || retryIn > 0}
              className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? '생성 중…' : '기안문 생성'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
