import { useState, type FormEvent } from 'react';
import SlidePanel from './SlidePanel';
import DateField from './DateField';
import { useApp } from '../context/AppContext';
import type { Todo, TodoCategory } from '../types';

const CATEGORIES: TodoCategory[] = ['업무', '교과', '개인'];

interface Props {
  defaultCategory?: TodoCategory;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  onSave: (todo: Todo) => void;
}

export default function TodoModal({ defaultCategory = '업무', defaultDate, onClose, onSave }: Props) {
  const { showToast } = useApp();
  const [category, setCategory] = useState<TodoCategory>(defaultCategory);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDate ?? '');
  const [link, setLink] = useState('');
  const [memo, setMemo] = useState('');

  function submit(e: FormEvent, close: () => void) {
    e.preventDefault();
    if (!title.trim()) {
      showToast('error', '제목을 입력해 주세요.');
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      text: title.trim(),
      category,
      done: false,
      dueDate: dueDate || undefined,
      link: link.trim() || undefined,
      memo: memo.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    close();
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';
  const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-700';

  return (
    <SlidePanel title="새 할 일 추가" onClose={onClose}>
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
