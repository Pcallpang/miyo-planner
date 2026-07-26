import { useState, type FormEvent } from 'react';
import { Star } from 'lucide-react';
import SlidePanel from './SlidePanel';
import DateField from './DateField';
import { useApp } from '../context/AppContext';
import type { Todo, TodoCategory } from '../types';

const CATEGORIES: TodoCategory[] = ['업무', '교과', '개인'];

interface Props {
  /** 수정 시 기존 할 일, 추가 시 undefined */
  editing?: Todo;
  defaultCategory?: TodoCategory;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (todo: Todo) => void;
}

export default function TodoModal({ editing, defaultCategory = '업무', defaultDate, onClose, onSave }: Props) {
  const { showToast } = useApp();
  const [category, setCategory] = useState<TodoCategory>(editing?.category ?? defaultCategory);
  const [title, setTitle] = useState(editing?.text ?? '');
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? defaultDate ?? '');
  const [link, setLink] = useState(editing?.link ?? '');
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [important, setImportant] = useState(editing?.important ?? false);

  function submit(e: FormEvent, close: () => void) {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', '제목을 입력해 주세요.');
      return;
    }
    const next: Todo = {
      id: editing?.id ?? crypto.randomUUID(),
      text: title.trim(),
      category,
      done: editing?.done ?? false,
      dueDate: dueDate || undefined,
      link: link.trim() || undefined,
      memo: memo.trim() || undefined,
      important: important || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    // 마감일을 바꾸지 않았을 때만 긴급도 수동 고정을 유지한다.
    // 날짜가 바뀌면 옛 고정이 남아 헷갈리므로 자동 판정으로 되돌린다.
    if (editing?.urgentOverride !== undefined && (editing.dueDate ?? '') === dueDate) {
      next.urgentOverride = editing.urgentOverride;
    }
    onSave(next);
    close();
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';
  const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-700';

  return (
    <SlidePanel title={editing ? '할 일 수정' : '새 할 일 추가'} onClose={onClose}>
      {(close) => (
        <form onSubmit={(e) => submit(e, close)} className="space-y-4">
          <div>
            <span className={labelCls}>분류</span>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                    category === c ? 'bg-white text-mint-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>제목</label>
            <input
              className={inputCls}
              placeholder="할 일 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>마감일 설정</label>
            <DateField className={inputCls} value={dueDate} onChange={setDueDate} />
          </div>

          <div>
            <span className={labelCls}>우선순위</span>
            <button
              type="button"
              onClick={() => setImportant((v) => !v)}
              aria-pressed={important}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                important
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-500 hover:border-amber-200 hover:bg-amber-50/50'
              }`}
            >
              <Star size={16} fill={important ? 'currentColor' : 'none'} />
              중요함
            </button>
            <p className="mt-1.5 text-[11px] text-slate-400">
              긴급도는 마감일 기준으로 자동 판정됩니다 · 우선순위 매트릭스에서 끌어다 바꿀 수 있어요
            </p>
          </div>

          <div>
            <label className={labelCls}>관련 링크 (URL)</label>
            <input
              type="url"
              className={inputCls}
              placeholder="https://…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>메모</label>
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              placeholder="상세 내용을 입력하세요"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            저장
          </button>
        </form>
      )}
    </SlidePanel>
  );
}
