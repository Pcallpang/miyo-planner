import { useState } from 'react';
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

  /** 드래그로 옮기는 중인 메모 id. 카드 자체는 outline이 아니라 grip 아이콘만 드래그 핸들로 쓴다. */
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  function reorderMemo(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setMemos((prev) => {
      const from = prev.findIndex((m) => m.id === draggedId);
      const to = prev.findIndex((m) => m.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo, i) => (
            <div
              key={memo.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedId && draggedId !== memo.id) setDragOverId(memo.id);
              }}
              onDragLeave={() => setDragOverId((id) => (id === memo.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                reorderMemo(memo.id);
                setDraggedId(null);
                setDragOverId(null);
              }}
              className={`group flex flex-col rounded-2xl p-4 shadow-sm ring-1 transition ${
                dragOverId === memo.id ? 'ring-2 ring-mint-400' : 'ring-slate-100'
              } ${draggedId === memo.id ? 'opacity-40' : ''} ${CARD_TINTS[i % CARD_TINTS.length]}`}
            >
              <div className="mb-1 flex items-center">
                <span
                  draggable
                  onDragStart={() => setDraggedId(memo.id)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
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
          ))}
        </div>
      )}
    </div>
  );
}
