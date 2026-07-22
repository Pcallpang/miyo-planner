import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarClock, ListChecks, Plus, Trash2, Wand2, X } from 'lucide-react';
import type { Todo, TodoCategory } from '../../types';

const CATEGORIES: TodoCategory[] = ['업무', '교과', '개인'];

const CATEGORY_COLORS: Record<TodoCategory, string> = {
  업무: 'text-mint-600 border-mint-400',
  교과: 'text-emerald-600 border-emerald-400',
  개인: 'text-amber-600 border-amber-400',
};

interface Props {
  todos: Todo[];
  setTodos: Dispatch<SetStateAction<Todo[]>>;
}

export default function TodoCard({ todos, setTodos }: Props) {
  const [tab, setTab] = useState<TodoCategory>('업무');
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');

  const visible = todos.filter((t) => t.category === tab);
  const countOf = (c: TodoCategory) => todos.filter((t) => t.category === c && !t.done).length;

  function addTodo(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setTodos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: text.trim(),
        category: tab,
        done: false,
        dueDate: dueDate || undefined,
        createdAt: new Date().toISOString(),
      },
    ]);
    setText('');
    setDueDate('');
  }

  function applyTemplate(e: FormEvent) {
    e.preventDefault();
    if (!goal.trim() || !deadline) return;
    const end = new Date(`${deadline}T00:00:00`);
    const today = format(new Date(), 'yyyy-MM-dd');
    const steps: { offset: number; label: string }[] = [
      { offset: -7, label: '자료 조사·준비 시작' },
      { offset: -3, label: '중간 점검' },
      { offset: -1, label: '최종 확인' },
      { offset: 0, label: '제출/실행' },
    ];
    const items: Todo[] = steps
      .map(({ offset, label }) => ({
        due: format(addDays(end, offset), 'yyyy-MM-dd'),
        label,
      }))
      .filter(({ due }) => due >= today)
      .map(({ due, label }) => ({
        id: crypto.randomUUID(),
        text: `[${goal.trim()}] ${label}`,
        category: tab,
        done: false,
        dueDate: due,
        createdAt: new Date().toISOString(),
      }));
    if (items.length > 0) setTodos((prev) => [...prev, ...items]);
    setGoal('');
    setDeadline('');
    setTemplateOpen(false);
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
          <ListChecks size={17} className="text-mint-500" />
          데일리 To-Do
        </h2>
        <button
          onClick={() => setTemplateOpen((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600"
        >
          {templateOpen ? <X size={12} /> : <Wand2 size={12} />}
          역산 템플릿
        </button>
      </div>

      {templateOpen && (
        <form onSubmit={applyTemplate} className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <input
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-mint-400"
            placeholder="목표 (예: 수행평가 채점)"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="date"
              className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-mint-400"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-mint-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-mint-600"
            >
              생성
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            마감일 기준 D-7 준비 · D-3 점검 · D-1 확인 · 당일 제출 To-Do를 자동 생성합니다.
          </p>
        </form>
      )}

      <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
              tab === c ? 'bg-white text-mint-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {c} ({countOf(c)})
          </button>
        ))}
      </div>

      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
        {visible.length === 0 && <li className="py-2 text-sm text-slate-400">항목이 없습니다.</li>}
        {visible.map((todo) => (
          <li
            key={todo.id}
            className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() =>
                setTodos((prev) =>
                  prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
                )
              }
              className={`h-4 w-4 shrink-0 rounded border-2 accent-mint-500 ${CATEGORY_COLORS[todo.category]}`}
            />
            <span
              className={`flex-1 text-sm ${todo.done ? 'text-slate-300 line-through' : 'text-slate-700'}`}
            >
              {todo.text}
            </span>
            {todo.dueDate && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                <CalendarClock size={11} />
                {todo.dueDate.slice(5).replace('-', '/')}
              </span>
            )}
            <button
              onClick={() => setTodos((prev) => prev.filter((t) => t.id !== todo.id))}
              className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
              aria-label="삭제"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={addTodo} className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100"
          placeholder="할 일 추가…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="date"
          className="w-32 rounded-xl border border-slate-200 px-2 py-2 text-xs text-slate-500 outline-none focus:border-mint-400"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          title="마감일 (선택)"
        />
        <button
          type="submit"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-500 text-white transition hover:bg-mint-600"
          aria-label="추가"
        >
          <Plus size={16} />
        </button>
      </form>
    </section>
  );
}
