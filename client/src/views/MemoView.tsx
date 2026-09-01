import { useRef, useState, type DragEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { GripVertical, NotebookPen, Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import EmptyMiyo from '../components/EmptyMiyo';
import type { MemoNote } from '../types';

const CARD_TINTS = ['bg-mint-50', 'bg-sky-50', 'bg-amber-50', 'bg-rose-50', 'bg-violet-50'];

export default function MemoView() {
  const { data, update } = useData();
  const memos = data.memos;
  const setMemos = (updater: (prev: MemoNote[]) => MemoNote[]) =>
    update((prev) => ({ memos: updater(prev.memos) }));

  /** 드래그 중인 메모 id. */
  const [draggedId, setDraggedId] = useState<string | null>(null);
  /** 드래그 중 실시간으로 미리보는 순서(id 목록). 드래그 중이 아니면 null — 이때는 memos 원래 순서를 쓴다. */
  const [liveOrder, setLiveOrder] = useState<string[] | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const orderedMemos = liveOrder
    ? (liveOrder.map((id) => memos.find((m) => m.id === id)).filter(Boolean) as MemoNote[])
    : memos;

  function addMemo() {
    setMemos((prev) => [
      { id: crypto.randomUUID(), text: '', updatedAt: new Date().toISOString() },
      ...prev,
    ]);
  }

  function updateMemo(id: string, text: string) {
    setMemos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text, updatedAt: new Date().toISOString() } : m)),
    );
  }

  function removeMemo(id: string) {
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }

  function startDrag(id: string, e: DragEvent<HTMLSpanElement>) {
    setDraggedId(id);
    setLiveOrder(memos.map((m) => m.id));
    const card = cardRefs.current.get(id);
    if (card) {
      const rect = card.getBoundingClientRect();
      // 손잡이가 아니라 카드 전체가 커서를 따라 이동하는 것처럼 보이도록 드래그 미리보기 이미지를 카드로 지정한다.
      e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
    }
    e.dataTransfer.effectAllowed = 'move';
  }

  /** 드래그 중인 카드가 targetId 카드 위를 지날 때, 커서의 좌우 위치를 보고 그 카드의 앞/뒤 중 더 가까운 자리로 끼워 넣는다. */
  function dragOverCard(targetId: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const insertAfter = e.clientX - rect.left > rect.width / 2;
    setLiveOrder((prev) => {
      if (!prev) return prev;
      const from = prev.indexOf(draggedId);
      const targetIndex = prev.indexOf(targetId);
      if (from === -1 || targetIndex === -1) return prev;
      let to = insertAfter ? targetIndex + 1 : targetIndex;
      if (to > from) to -= 1; // splice로 먼저 빼낸 뒤 넣을 자리이므로 보정
      if (to === from) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  /** 카드 사이 여백 등 빈 공간에 놓아도 맨 뒤로 들어가게. */
  function dragOverEmpty(e: DragEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !draggedId) return;
    e.preventDefault();
    setLiveOrder((prev) => {
      if (!prev) return prev;
      const from = prev.indexOf(draggedId);
      if (from === -1 || from === prev.length - 1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.push(moved);
      return next;
    });
  }

  function commitDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (liveOrder) {
      setMemos((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        return liveOrder.map((id) => byId.get(id)).filter((m): m is MemoNote => Boolean(m));
      });
    }
    setDraggedId(null);
    setLiveOrder(null);
  }

  function cancelDrag() {
    setDraggedId(null);
    setLiveOrder(null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <NotebookPen size={18} className="text-mint-500" />
          간단 메모
          <span className="text-sm font-normal text-slate-400">자동 저장됩니다</span>
        </h2>
        <button
          onClick={addMemo}
          className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600"
        >
          <Plus size={15} /> 새 메모
        </button>
      </div>

      {memos.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-100">
          <EmptyMiyo
            message="아직 메모가 없습니다. ‘새 메모’를 눌러 시작하세요."
            size={96}
            src="/nep-miyo.png"
          />
        </div>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onDragOver={dragOverEmpty}
          onDrop={commitDrop}
        >
          {orderedMemos.map((memo) => {
            const tintIndex = memos.findIndex((m) => m.id === memo.id);
            return (
              <div
                key={memo.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(memo.id, el);
                  else cardRefs.current.delete(memo.id);
                }}
                onDragOver={(e) => dragOverCard(memo.id, e)}
                onDrop={commitDrop}
                className={`group flex flex-col rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 transition-opacity ${
                  draggedId === memo.id ? 'opacity-30' : ''
                } ${CARD_TINTS[tintIndex % CARD_TINTS.length]}`}
              >
                <div className="mb-1 flex items-center">
                  <span
                    draggable
                    onDragStart={(e) => startDrag(memo.id, e)}
                    onDragEnd={cancelDrag}
                    className="cursor-grab rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-slate-500 active:cursor-grabbing"
                    aria-label="메모 순서 변경"
                  >
                    <GripVertical size={14} />
                  </span>
                </div>
                <textarea
                  className="min-h-36 flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="메모를 입력하세요…"
                  value={memo.text}
                  onChange={(e) => updateMemo(memo.id, e.target.value)}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {format(parseISO(memo.updatedAt), 'MM/dd HH:mm')}
                  </span>
                  <button
                    onClick={() => removeMemo(memo.id)}
                    className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                    aria-label="메모 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
