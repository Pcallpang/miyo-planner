import { useEffect, useRef, useState } from 'react';
import { ClipboardList, Clock, Download, FileText, ImagePlus, Loader2, Plus, Receipt, Trash2, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import DraftDocumentModal from '../components/DraftDocumentModal';
import type { ProcurementItem } from '../types';

const inputCls =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

function currency(n: number) {
  return n.toLocaleString('ko-KR');
}

function blankItem(): ProcurementItem {
  return { name: '', spec: '', unit: '개', qty: 1, unitPrice: 0, vendor: '', sourceUrl: '' };
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
  const [preview, setPreview] = useState<{ dataUrl: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState(0);
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPreview({ dataUrl });
    setExtractError(null);
    void extract(base64, mimeType);
  }

  async function extract(base64: string, mimeType: string) {
    setExtracting(true);
    setExtractError(null);
    try {
      const { items: extracted } = await api.extractProduct(base64, mimeType);
      if (extracted.length === 0) {
        setExtractError('이미지에서 상품 정보를 찾지 못했습니다. "행 추가"로 직접 입력해 주세요.');
        return;
      }
      setItems((prev) => [
        ...prev,
        ...extracted.map((it) => ({
          name: it.name,
          spec: it.spec,
          unit: it.unit || '개',
          qty: it.qty > 0 ? it.qty : 1,
          unitPrice: it.unitPrice >= 0 ? it.unitPrice : 0,
          vendor: it.vendor,
          sourceUrl: '',
        })),
      ]);
      showToast('success', `${extracted.length}개 상품을 인식해 품목 내역에 추가했습니다.`);
      setPreview(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setRetryIn(e.retryAfter && e.retryAfter > 0 ? e.retryAfter : 30);
      }
      setExtractError(e instanceof Error ? e.message : '분석에 실패했습니다.');
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

  function addBlankRow() {
    setItems((prev) => [...prev, blankItem()]);
  }

  function updateItem(index: number, patch: Partial<ProcurementItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

  async function download() {
    if (items.length === 0) {
      showToast('error', '품목을 1개 이상 담아 주세요.');
      return;
    }
    setDownloading(true);
    try {
      await api.downloadProcurementItems(items);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
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
          자동으로 인식해 아래 품목 내역에 담아 드립니다. 캡쳐 한 장에 상품이 여러 개 보이거나
          배송비가 보여도 전부 인식합니다.
        </p>
      </div>

      {/* 품목 내역: 이미지 입력 + 표를 한 카드에 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <ClipboardList size={16} className="text-mint-500" />
            품목 내역 ({items.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={addBlankRow}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <Plus size={15} /> 행 추가
            </button>
            <button
              onClick={() => setDraftOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <FileText size={15} /> 기안문 생성
            </button>
            <button
              onClick={() => void download()}
              disabled={items.length === 0 || downloading}
              className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              품목 내역 다운로드
            </button>
          </div>
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
          className={`mb-4 rounded-2xl border-2 border-dashed p-6 text-center outline-none transition ${
            dragOver ? 'border-mint-400 bg-mint-50/60' : 'border-slate-200 bg-slate-50/50'
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
                className="mt-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
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
              {extractError && (
                <p
                  className={`mt-1 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
                    retryIn > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  {retryIn > 0 && <Clock size={15} />}
                  {extractError}
                  {retryIn > 0 && <span className="ml-auto font-semibold tabular-nums">{retryIn}초</span>}
                </p>
              )}
            </div>
          ) : (
            <div className="relative mx-auto max-w-xs">
              <img
                src={preview.dataUrl}
                alt="캡쳐 미리보기"
                className="h-40 w-full rounded-xl object-cover ring-1 ring-slate-200"
              />
              {!extracting && (
                <button
                  onClick={() => setPreview(null)}
                  className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-slate-400 shadow ring-1 ring-slate-200 hover:text-rose-400"
                  aria-label="닫기"
                >
                  <X size={14} />
                </button>
              )}
              {extracting ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
                  <Loader2 size={15} className="animate-spin" /> 상품 정보를 분석 중입니다…
                </p>
              ) : (
                extractError && (
                  <p
                    className={`mt-3 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
                      retryIn > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {retryIn > 0 && <Clock size={15} />}
                    {extractError}
                    {retryIn > 0 && <span className="ml-auto font-semibold tabular-nums">{retryIn}초</span>}
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            담긴 품목이 없습니다. 이미지를 인식시키거나 "행 추가"로 직접 입력해 주세요.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <div className="min-w-[720px] space-y-2">
                <div className="grid grid-cols-[2fr_1fr_0.8fr_0.7fr_0.9fr_1fr_auto] gap-2 px-3 text-[11px] font-medium text-slate-400">
                  <span>품명</span>
                  <span>규격</span>
                  <span>단위</span>
                  <span>수량</span>
                  <span>단가</span>
                  <span>총액</span>
                  <span></span>
                </div>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[2fr_1fr_0.8fr_0.7fr_0.9fr_1fr_auto] items-center gap-2 rounded-xl border border-slate-100 p-3"
                  >
                    <input
                      className={`${inputCls} min-w-0`}
                      placeholder="품명"
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                    />
                    <input
                      className={`${inputCls} min-w-0`}
                      placeholder="규격"
                      value={item.spec}
                      onChange={(e) => updateItem(i, { spec: e.target.value })}
                    />
                    <input
                      className={`${inputCls} min-w-0`}
                      placeholder="단위"
                      value={item.unit}
                      onChange={(e) => updateItem(i, { unit: e.target.value })}
                    />
                    <input
                      type="number"
                      className={`${inputCls} min-w-0`}
                      value={item.qty}
                      onChange={(e) => updateItem(i, { qty: Number(e.target.value) || 0 })}
                    />
                    <input
                      type="number"
                      className={`${inputCls} min-w-0`}
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) || 0 })}
                    />
                    <span className="text-sm font-semibold text-slate-600 tabular-nums">
                      {currency(item.qty * item.unitPrice)}원
                    </span>
                    <button
                      onClick={() => removeItem(i)}
                      className="justify-self-end rounded p-1 text-slate-300 hover:text-rose-400"
                      aria-label="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-500">합계</span>
              <span className="text-base font-bold text-slate-800 tabular-nums">{currency(total)}원</span>
            </div>
          </div>
        )}
      </div>

      {draftOpen && <DraftDocumentModal items={items} onClose={() => setDraftOpen(false)} />}
    </div>
  );
}
