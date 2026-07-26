import { useState, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import {
  CalendarClock,
  Eye,
  EyeOff,
  LayoutGrid,
  Link as LinkIcon,
  Pencil,
  Pin,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import {
  QUADRANTS,
  clearUrgentOverride,
  hasUrgentOverride,
  moveToQuadrant,
  quadrantOfTodo,
  type QuadrantId,
} from '../lib/eisenhower';
import TodoModal from '../components/TodoModal';
import EmptyMiyo from '../components/EmptyMiyo';
import type { Todo, TodoCategory } from '../types';

const CATEGORY_DOT: Record<TodoCategory, string> = {
  업무: 'bg-mint-400',
  교과: 'bg-emerald-400',
  개인: 'bg-amber-400',
};

const QUADRANT_STYLE: Record<QuadrantId, { ring: string; head: string; badge: string }> = {
  do: { ring: 'ring-rose-200', head: 'text-rose-600', badge: 'bg-rose-50' },
  plan: { ring: 'ring-mint-200', head: 'text-mint-700', badge: 'bg-mint-50' },
  quick: { ring: 'ring-amber-200', head: 'text-amber-600', badge: 'bg-amber-50' },
  later: { ring: 'ring-slate-200', head: 'text-slate-500', badge: 'bg-slate-50' },
};

export default function MatrixView() {
  const { settings, showToast } = useApp();
  const { data, update } = useData();
  const todos = data.todos;
  const setTodos: Dispatch<SetStateAction<Todo[]>> = (next) =>
    update((prev) => ({ todos: typeof next === 'function' ? next(prev.todos) : next }));

  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<QuadrantId | null>(null);
  const [openMemoId, setOpenMemoId] = useState<string | null>(null);

  const urgentDays = settings.urgentDays;
  const visible = showDone ? todos : todos.filter((t) => !t.done);

  function replace(next: Todo) {
    setTodos((prev) => prev.map((t) => (t.id === next.id ? next : t)));
  }

  function drop(e: DragEvent, target: QuadrantId) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    if (!id) return;
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    if (quadrantOfTodo(todo, urgentDays) === target) return;
    replace(moveToQuadrant(todo, target, urgentDays));
  }

  function toggleImportant(todo: Todo) {
    replace({ ...todo, important: !todo.important });
  }

  function unpin(todo: Todo) {
    replace(clearUrgentOverride(todo));
    showToast('info', '마감일 기준 자동 판정으로 되돌렸습니다.');
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <LayoutGrid size={18} className="text-mint-500" />
            우선순위 매트릭스
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            끌어다 옮겨서 분류하세요 · 긴급도는 마감 {urgentDays}일 전부터 자동 (환경 설정에서 변경)
          </p>
        </div>
        <button
          onClick={() => setShowDone((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600"
        >
          {showDone ? <EyeOff size={13} /> : <Eye size={13} />}
          완료 항목 {showDone ? '숨기기' : '보기'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {QUADRANTS.map((q) => {
          const items = visible.filter((t) => quadrantOfTodo(t, urgentDays) === q.id);
          const style = QUADRANT_STYLE[q.id];
          const active = dragOver === q.id;
          return (
            <section
              key={q.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(q.id);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === q.id ? null : cur))}
              onDrop={(e) => drop(e, q.id)}
              className={`flex min-h-52 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 transition ${
                active ? 'ring-2 ring-mint-400 ring-offset-2' : style.ring
              }`}
            >
              <div className="mb-2.5 flex items-baseline justify-between">
                <h3 className={`text-sm font-bold ${style.head}`}>{q.title}</h3>
                <span className="text-[11px] text-slate-400">{q.hint}</span>
              </div>

              <ul className="flex-1 space-y-1">
                {items.length === 0 && (
                  <li className={`rounded-xl ${style.badge} px-3 py-6 text-center text-xs text-slate-400`}>
                    여기로 끌어다 놓으세요
                  </li>
                )}
                {items.map((todo) => {
                  const hasMemo = Boolean(todo.memo?.trim());
                  const memoOpen = hasMemo && openMemoId === todo.id;
                  return (
                    <li
                      key={todo.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', todo.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(todo.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      className={`group cursor-grab rounded-xl border border-slate-100 bg-white transition hover:border-mint-200 hover:bg-slate-50 active:cursor-grabbing ${
                        dragId === todo.id ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => replace({ ...todo, done: !todo.done })}
                          className="h-4 w-4 shrink-0 accent-mint-500"
                        />
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_DOT[todo.category]}`} />
                        <button
                          type="button"
                          onClick={() => hasMemo && setOpenMemoId(memoOpen ? null : todo.id)}
                          className={`min-w-0 flex-1 truncate text-left text-sm ${
                            todo.done ? 'text-slate-300 line-through' : 'text-slate-700'
                          } ${hasMemo ? 'cursor-pointer' : 'cursor-grab'}`}
                        >
                          {todo.text}
                          {hasMemo && <StickyNote size={11} className="ml-1 inline text-mint-400" />}
                        </button>

                        {hasUrgentOverride(todo) && (
                          <button
                            type="button"
                            onClick={() => unpin(todo)}
                            title="긴급도가 수동 고정됨 · 눌러서 자동으로 되돌리기"
                            aria-label="긴급도 수동 고정 해제"
                            className="shrink-0 rounded p-0.5 text-mint-500 transition hover:text-rose-400"
                          >
                            <Pin size={12} />
                          </button>
                        )}
                        {todo.link && (
                          <a
                            href={todo.link}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-slate-300 transition hover:text-mint-500"
                            aria-label="관련 링크 열기"
                          >
                            <LinkIcon size={12} />
                          </a>
                        )}
                        {todo.dueDate && (
                          <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-slate-400">
                            <CalendarClock size={10} />
                            {todo.dueDate.slice(5).replace('-', '/')}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleImportant(todo)}
                          aria-label={todo.important ? '중요 해제' : '중요로 표시'}
                          className={`shrink-0 rounded p-0.5 transition ${
                            todo.important
                              ? 'text-amber-400 hover:text-amber-500'
                              : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                          }`}
                        >
                          <Star size={13} fill={todo.important ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(todo)}
                          aria-label="수정"
                          className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-mint-500"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTodos((prev) => prev.filter((t) => t.id !== todo.id))}
                          aria-label="삭제"
                          className="shrink-0 rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {memoOpen && (
                        <p className="mx-2.5 mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs whitespace-pre-wrap text-slate-500">
                          {todo.memo}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="mt-6">
          <EmptyMiyo message="할 일을 추가하면 여기에 분류됩니다." size={72} />
        </div>
      )}

      {editing && (
        <TodoModal
          editing={editing}
          defaultCategory={editing.category}
          onClose={() => setEditing(null)}
          onSave={(todo) => replace(todo)}
        />
      )}
    </div>
  );
}
