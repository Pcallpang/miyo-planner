import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { addDays, format } from 'date-fns';
import {
  CalendarClock,
  ChevronDown,
  Link as LinkIcon,
  ListChecks,
  Pencil,
  Plus,
  Star,
  StickyNote,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import DateField from '../DateField';
import EmptyMiyo from '../EmptyMiyo';
import TodayEvents from './TodayEvents';
import { sortTodosByDueDate } from '../../lib/todoSort';
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
  /** "추가" 버튼 클릭 시 현재 탭 분류로 모달을 연다 */
  onAdd: (category: TodoCategory) => void;
  onEdit: (todo: Todo) => void;
}

export default function TodoCard({ todos, setTodos, onAdd, onEdit }: Props) {
  const [tab, setTab] = useState<TodoCategory>('업무');
  const [templateOpen, setTemplateOpen] = useState(false);
  /** 메모를 펼쳐 놓은 할 일 id */
  const [openMemoId, setOpenMemoId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [deadline, setDeadline] = useState('');

  const visible = sortTodosByDueDate(todos.filter((t) => t.category === tab));
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
            <DateField
              className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-mint-400"
              value={deadline}
              onChange={setDeadline}
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

      <TodayEvents />

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
        {visible.length === 0 && (
          <li>
            <EmptyMiyo message="항목이 없습니다." size={52} src="/sachungi-miyo.png" />
          </li>
        )}
        {visible.map((todo) => {
          const hasMemo = Boolean(todo.memo?.trim());
          const memoOpen = hasMemo && openMemoId === todo.id;
          return (
            <li key={todo.id} className="group rounded-xl transition hover:bg-slate-50">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => {
                    if (todo.done) {
                      setTodos((prev) =>
                        prev.map((t) => (t.id === todo.id ? { ...t, done: false } : t)),
                      );
                      return;
                    }
                    // 체크 표시(취소선)가 보이도록 잠깐 기다렸다가 목록에서 지운다.
                    setTodos((prev) =>
                      prev.map((t) => (t.id === todo.id ? { ...t, done: true } : t)),
                    );
                    window.setTimeout(() => {
                      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
                    }, 300);
                  }}
                  className={`h-4 w-4 shrink-0 rounded border-2 accent-mint-500 ${CATEGORY_COLORS[todo.category]}`}
                />
                <div
                  onClick={() => onEdit(todo)}
                  className="relative flex min-w-0 flex-1 cursor-pointer items-center gap-1 text-left"
                >
                  {todo.important && (
                    <Star size={11} className="shrink-0 text-amber-400" fill="currentColor" />
                  )}
                  <span
                    className={`line-clamp-2 min-w-0 text-sm break-words transition-colors duration-300 ${
                      todo.done ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {todo.text}
                  </span>
                  {hasMemo && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMemoId(memoOpen ? null : todo.id);
                      }}
                      aria-expanded={memoOpen}
                      aria-label="메모 보기"
                      className="flex shrink-0 items-center gap-0.5 p-0.5"
                    >
                      <StickyNote size={11} className="text-mint-400" />
                      <ChevronDown
                        size={12}
                        className={`text-slate-300 transition-transform duration-200 ${
                          memoOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  )}
                  <span
                    className={`pointer-events-none absolute top-1/2 left-0 h-px w-full origin-left bg-slate-400 transition-transform duration-300 ease-out ${
                      todo.done ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </div>
                {todo.link && (
                  <a
                    href={todo.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-slate-300 transition hover:text-mint-500"
                    aria-label="관련 링크 열기"
                  >
                    <LinkIcon size={13} />
                  </a>
                )}
                {todo.dueDate && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                    <CalendarClock size={11} />
                    {todo.dueDate.slice(5).replace('-', '/')}
                  </span>
                )}
                <button
                  onClick={() => onEdit(todo)}
                  className="shrink-0 rounded p-1 text-slate-300 transition hover:text-mint-500"
                  aria-label="수정"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setTodos((prev) => prev.filter((t) => t.id !== todo.id))}
                  className="shrink-0 rounded p-1 text-slate-300 transition hover:text-rose-400"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {memoOpen && (
                <p className="mr-2 mb-1.5 ml-9 rounded-lg bg-slate-50 px-3 py-2 text-xs whitespace-pre-wrap text-slate-500">
                  {todo.memo}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        onClick={() => onAdd(tab)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-mint-300 py-2.5 text-sm font-medium text-mint-600 transition hover:bg-mint-50"
      >
        <Plus size={16} /> 추가
      </button>
    </section>
  );
}
