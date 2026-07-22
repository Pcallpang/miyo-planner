import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarClock, Link as LinkIcon, Pencil, Plus, Trash2, Wand2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import TodoModal from '../components/TodoModal';
import DateField from '../components/DateField';
import TodayEvents from '../components/dashboard/TodayEvents';
import type { Todo, TodoCategory } from '../types';

const CATEGORIES: TodoCategory[] = ['업무', '교과', '개인'];

const TAB_ACTIVE: Record<TodoCategory, string> = {
  업무: 'text-mint-600 border-mint-500',
  교과: 'text-emerald-600 border-emerald-500',
  개인: 'text-amber-600 border-amber-500',
};

export default function ChecklistView() {
  const { showToast } = useApp();
  const { data, update } = useData();
  const todos = data.todos;
  const setTodos: Dispatch<SetStateAction<Todo[]>> = (next) =>
    update((prev) => ({ todos: typeof next === 'function' ? next(prev.todos) : next }));

  const [tab, setTab] = useState<TodoCategory>('업무');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');
  const [modal, setModal] = useState<{ editing?: Todo } | null>(null);

  const visible = todos.filter((t) => t.category === tab);
  const countOf = (c: TodoCategory) => todos.filter((t) => t.category === c && !t.done).length;

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
      .map(({ offset, label }) => ({ due: format(addDays(end, offset), 'yyyy-MM-dd'), label }))
      .filter(({ due }) => due >= today)
      .map(({ due, label }) => ({
        id: crypto.randomUUID(),
        text: `[${goal.trim()}] ${label}`,
        category: tab,
        done: false,
        dueDate: due,
        createdAt: new Date().toISOString(),
      }));
    if (items.length > 0) {
      setTodos((prev) => [...prev, ...items]);
      showToast('success', `${items.length}개의 준비 To-Do를 생성했습니다.`);
    }
    setGoal('');
    setDeadline('');
    setTemplateOpen(false);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">데일리 To-Do</h1>
          <button
            onClick={() => setTemplateOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600"
          >
            {templateOpen ? <X size={12} /> : <Wand2 size={12} />}
            역산 템플릿
          </button>
        </div>

        {templateOpen && (
          <form onSubmit={applyTemplate} className="mb-4 space-y-2 rounded-xl bg-slate-50 p-4">
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mint-400"
              placeholder="목표 (예: 수행평가 채점)"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div className="flex gap-2">
              <DateField
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mint-400"
                value={deadline}
                onChange={setDeadline}
              />
              <button
                type="submit"
                className="rounded-lg bg-mint-500 px-4 py-2 text-xs font-semibold text-white hover:bg-mint-600"
              >
                생성
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              마감일 기준 D-7 준비 · D-3 점검 · D-1 확인 · 당일 제출 To-Do를 자동 생성합니다.
            </p>
          </form>
        )}

        <TodayEvents />

        {/* 언더라인 탭 */}
        <div className="mb-2 flex gap-6 border-b border-slate-100">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`-mb-px border-b-2 px-1 pb-2.5 text-sm font-semibold transition ${
                tab === c ? TAB_ACTIVE[c] : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {c} ({countOf(c)})
            </button>
          ))}
        </div>

        <ul className="mb-4 divide-y divide-slate-50">
          {visible.length === 0 && <li className="py-6 text-center text-sm text-slate-400">항목이 없습니다.</li>}
          {visible.map((todo) => (
            <li key={todo.id} className="group flex items-center gap-3 py-3">
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() =>
                  setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)))
                }
                className="h-5 w-5 shrink-0 rounded-md accent-mint-500"
              />
              {/* 체크 시 가운데 줄이 그어지는 애니메이션 */}
              <span className="relative min-w-0 flex-1">
                <span
                  className={`block truncate text-sm transition-colors duration-300 ${
                    todo.done ? 'text-slate-300' : 'text-slate-700'
                  }`}
                  title={todo.memo || undefined}
                >
                  {todo.text}
                </span>
                <span
                  className={`pointer-events-none absolute top-1/2 left-0 h-px w-full origin-left bg-slate-400 transition-transform duration-300 ease-out ${
                    todo.done ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
              </span>
              {todo.link && (
                <a
                  href={todo.link}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-slate-300 transition hover:text-mint-500"
                  aria-label="관련 링크 열기"
                >
                  <LinkIcon size={15} />
                </a>
              )}
              {todo.dueDate && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                  <CalendarClock size={13} />
                  {todo.dueDate.slice(5).replace('-', '/')}
                </span>
              )}
              <button
                onClick={() => setModal({ editing: todo })}
                className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-mint-500"
                aria-label="수정"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setTodos((prev) => prev.filter((t) => t.id !== todo.id))}
                className="shrink-0 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                aria-label="삭제"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setModal({})}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-mint-300 py-3 text-sm font-medium text-mint-600 transition hover:bg-mint-50"
        >
          <Plus size={16} /> 추가
        </button>
      </section>

      {modal && (
        <TodoModal
          editing={modal.editing}
          defaultCategory={tab}
          onClose={() => setModal(null)}
          onSave={(todo) =>
            setTodos((prev) =>
              modal.editing ? prev.map((t) => (t.id === todo.id ? todo : t)) : [...prev, todo],
            )
          }
        />
      )}
    </div>
  );
}
