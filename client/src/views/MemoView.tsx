import { format, parseISO } from 'date-fns';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { MemoNote } from '../types';

const CARD_TINTS = ['bg-mint-50', 'bg-sky-50', 'bg-amber-50', 'bg-rose-50', 'bg-violet-50'];

export default function MemoView() {
  const { data, update } = useData();
  const memos = data.memos;
  const setMemos = (updater: (prev: MemoNote[]) => MemoNote[]) =>
    update({ memos: updater(data.memos) });

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
        <p className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
          아직 메모가 없습니다. &lsquo;새 메모&rsquo;를 눌러 시작하세요.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memos.map((memo, i) => (
            <div
              key={memo.id}
              className={`group flex flex-col rounded-2xl p-4 shadow-sm ring-1 ring-slate-100 ${CARD_TINTS[i % CARD_TINTS.length]}`}
            >
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
