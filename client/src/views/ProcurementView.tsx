import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  Receipt,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { ExtractedProductItem, ProcurementHistoryEntry, ProcurementItem } from '../types';

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

function emptyDraft(): ExtractedProductItem {
  return { name: '', spec: '', unit: '개', qty: 1, unitPrice: 0, vendor: '' };
}

function currency(n: number) {
  return n.toLocaleString('ko-KR');
}

/** File/Blob을 base64(순수 데이터부)와 mimeType으로 변환한다. */
function readImageFile(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      resolve({ base64: dataUrl.slice(comma + 1), mimeType: file.type || 'image/png', dataUrl });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ProcurementView() {
  const { showToast } = useApp();
  const [preview, setPreview] = useState<{ dataUrl: string; base64: string; mimeType: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const [draft, setDraft] = useState<ExtractedProductItem | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [cart, setCart] = useState<ProcurementItem[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [header, setHeader] = useState({ title: '', purpose: '', budgetItem: '', requester: '' });

  const [history, setHistory] = useState<ProcurementHistoryEntry[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .procurementHistory()
      .then((r) => setHistory(r.requests))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    if (retryIn <= 0) return;
    const id = setInterval(() => setRetryIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [retryIn]);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('error', '이미지 파일만 첨부할 수 있습니다.');
      return;
    }
    const { base64, mimeType, dataUrl } = await readImageFile(file);
    setPreview({ base64, mimeType, dataUrl });
    setDraft(null);
    setDraftUrl('');
    setExtractError(null);
    void extract(base64, mimeType);
  }

  async function extract(base64: string, mimeType: string) {
    setExtracting(true);
    setExtractError(null);
    try {
      const { item } = await api.extractProduct(base64, mimeType);
      setDraft(item);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setRetryIn(e.retryAfter && e.retryAfter > 0 ? e.retryAfter : 30);
      }
      setExtractError(e instanceof Error ? e.message : '분석에 실패했습니다.');
      setDraft(emptyDraft());
    } finally {
      setExtracting(false);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) void handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function addToCart() {
    if (!draft) return;
    if (!draft.name.trim()) {
      showToast('error', '상품명을 입력해 주세요.');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        name: draft.name.trim(),
        spec: draft.spec.trim(),
        unit: draft.unit.trim() || '개',
        qty: draft.qty > 0 ? draft.qty : 1,
        unitPrice: draft.unitPrice >= 0 ? draft.unitPrice : 0,
        vendor: draft.vendor.trim(),
        sourceUrl: draftUrl.trim(),
      },
    ]);
    setPreview(null);
    setDraft(null);
    setDraftUrl('');
    showToast('success', '장바구니에 담았습니다.');
  }

  function updateCartItem(index: number, patch: Partial<ProcurementItem>) {
    setCart((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeCartItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  const total = cart.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  async function issue() {
    if (!header.title.trim()) {
      showToast('error', '품의서 제목을 입력해 주세요.');
      return;
    }
    if (cart.length === 0) {
      showToast('error', '장바구니에 품목을 1개 이상 담아 주세요.');
      return;
    }
    setIssuing(true);
    try {
      await api.issueProcurement({ ...header, title: header.title.trim(), items: cart });
      showToast('success', '품의서를 발행했습니다. 엑셀 파일을 확인해 주세요.');
      setIssueOpen(false);
      setCart([]);
      setHeader({ title: '', purpose: '', budgetItem: '', requester: '' });
      const r = await api.procurementHistory();
      setHistory(r.requests);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '품의서 발행에 실패했습니다.');
    } finally {
      setIssuing(false);
    }
  }

  async function downloadHistoryItem(entry: ProcurementHistoryEntry) {
    setDownloadingId(entry.id);
    try {
      await api.downloadProcurement(entry.id, entry.title);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '다운로드에 실패했습니다.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Receipt size={18} className="text-mint-500" />
          품의서 작성
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          G마켓·쿠팡·옥션·11번가 등에서 상품 페이지를 캡쳐해 붙여넣거나 업로드하면, 상품 정보를
          자동으로 인식해 K에듀파인 품의서 엑셀로 만들어 드립니다.
        </p>
      </div>

      {/* 이미지 입력 영역 */}
      <div
        onPaste={onPaste}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        tabIndex={0}
        className={`rounded-2xl border-2 border-dashed p-6 text-center outline-none transition ${
          dragOver ? 'border-mint-400 bg-mint-50/60' : 'border-slate-200 bg-white'
        }`}
      >
        {!preview ? (
          <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
            <ImagePlus size={28} className="text-slate-300" />
            <p className="text-sm">
              상품 캡쳐 이미지를 여기에 <strong>붙여넣기(Ctrl+V)</strong>하거나 드래그하세요.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              파일 선택
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <div className="grid gap-4 text-left sm:grid-cols-[160px_1fr]">
            <img
              src={preview.dataUrl}
              alt="캡쳐 미리보기"
              className="h-40 w-full rounded-xl object-cover ring-1 ring-slate-200"
            />
            <div className="space-y-2">
              {extracting && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Loader2 size={15} className="animate-spin" /> Gemini가 상품 정보를 분석 중입니다…
                </p>
              )}
              {extractError && (
                <p
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
                    retryIn > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {retryIn > 0 && <Clock size={15} />}
                  {extractError}
                  {retryIn > 0 && <span className="ml-auto font-semibold tabular-nums">{retryIn}초</span>}
                </p>
              )}
              {draft && !extracting && (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={`${inputCls} col-span-2`}
                      placeholder="상품명"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="규격/옵션"
                      value={draft.spec}
                      onChange={(e) => setDraft({ ...draft, spec: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="판매처"
                      value={draft.vendor}
                      onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="단위 (개/세트 등)"
                      value={draft.unit}
                      onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    />
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="수량"
                      value={draft.qty}
                      onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) || 0 })}
                    />
                    <input
                      type="number"
                      className={inputCls}
                      placeholder="단가"
                      value={draft.unitPrice}
                      onChange={(e) => setDraft({ ...draft, unitPrice: Number(e.target.value) || 0 })}
                    />
                    <input
                      className={`${inputCls} col-span-2`}
                      placeholder="상품 URL (선택)"
                      value={draftUrl}
                      onChange={(e) => setDraftUrl(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setPreview(null);
                        setDraft(null);
                      }}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-100"
                    >
                      취소
                    </button>
                    <button
                      onClick={addToCart}
                      className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600"
                    >
                      <ShoppingCart size={15} /> 장바구니 담기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 장바구니 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <ShoppingCart size={16} className="text-mint-500" />
            장바구니 ({cart.length})
          </h3>
          <button
            onClick={() => setIssueOpen(true)}
            disabled={cart.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
          >
            <FileSpreadsheet size={15} /> 품의서 발행
          </button>
        </div>

        {cart.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">담긴 상품이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {cart.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-slate-100 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <input
                    className={`${inputCls} sm:col-span-2`}
                    value={item.name}
                    onChange={(e) => updateCartItem(i, { name: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="규격"
                    value={item.spec}
                    onChange={(e) => updateCartItem(i, { spec: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="단위"
                    value={item.unit}
                    onChange={(e) => updateCartItem(i, { unit: e.target.value })}
                  />
                  <input
                    type="number"
                    className={inputCls}
                    value={item.qty}
                    onChange={(e) => updateCartItem(i, { qty: Number(e.target.value) || 0 })}
                  />
                  <input
                    type="number"
                    className={inputCls}
                    value={item.unitPrice}
                    onChange={(e) => updateCartItem(i, { unitPrice: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-600 tabular-nums">
                    {currency(item.qty * item.unitPrice)}원
                  </span>
                  <button
                    onClick={() => removeCartItem(i)}
                    className="rounded p-1 text-slate-300 hover:text-rose-400"
                    aria-label="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-end gap-2 pt-2 text-sm">
              <span className="text-slate-500">합계</span>
              <span className="text-base font-bold text-slate-800 tabular-nums">{currency(total)}원</span>
            </div>
          </div>
        )}
      </div>

      {/* 발행 이력 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-3 text-sm font-bold text-slate-700">발행 이력</h3>
        {history === null ? (
          <p className="py-4 text-center text-sm text-slate-400">불러오는 중…</p>
        ) : history.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">아직 발행한 품의서가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{h.title}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(h.created_at).toLocaleDateString('ko-KR')} · {currency(h.total_amount)}원
                  </p>
                </div>
                <button
                  onClick={() => void downloadHistoryItem(h)}
                  disabled={downloadingId === h.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  {downloadingId === h.id ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                  다시 받기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {issueOpen && (
        <IssueModal
          header={header}
          setHeader={setHeader}
          issuing={issuing}
          total={total}
          itemCount={cart.length}
          onClose={() => setIssueOpen(false)}
          onSubmit={() => void issue()}
        />
      )}
    </div>
  );
}

interface IssueModalProps {
  header: { title: string; purpose: string; budgetItem: string; requester: string };
  setHeader: (h: { title: string; purpose: string; budgetItem: string; requester: string }) => void;
  issuing: boolean;
  total: number;
  itemCount: number;
  onClose: () => void;
  onSubmit: () => void;
}

function IssueModal({ header, setHeader, issuing, total, itemCount, onClose, onSubmit }: IssueModalProps) {
  useEscapeKey(onClose);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Sparkles size={18} className="text-mint-500" />
            품의서 발행
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-slate-500">
            {itemCount}개 품목 · 합계 {currency(total)}원
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">품의서 제목 *</span>
            <input
              className={`${inputCls} w-full`}
              placeholder="예) 3학년 미술수업 재료 구입"
              value={header.title}
              onChange={(e) => setHeader({ ...header, title: e.target.value })}
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">목적/사유</span>
            <textarea
              className={`${inputCls} min-h-20 w-full resize-y`}
              value={header.purpose}
              onChange={(e) => setHeader({ ...header, purpose: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">예산과목</span>
              <input
                className={`${inputCls} w-full`}
                value={header.budgetItem}
                onChange={(e) => setHeader({ ...header, budgetItem: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">청구자</span>
              <input
                className={`${inputCls} w-full`}
                value={header.requester}
                onChange={(e) => setHeader({ ...header, requester: e.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onSubmit}
            disabled={issuing}
            className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
          >
            {issuing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {issuing ? '발행 중…' : '발행하고 엑셀 받기'}
          </button>
        </div>
      </div>
    </div>
  );
}
