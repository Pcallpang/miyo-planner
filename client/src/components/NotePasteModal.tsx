import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarPlus, CheckCircle2, Clock, ListChecks, Loader2, Sparkles, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import type { ParsedEvent, ParsedTodo, Todo, TodoCategory } from '../types';

type CardStatus = { state: 'idle' | 'saving' | 'done' } | { state: 'error'; message: string };

interface Card {
  event: ParsedEvent;
  status: CardStatus;
}

const TODO_BADGE: Record<TodoCategory, string> = {
  업무: 'bg-mint-100 text-mint-700',
  교과: 'bg-emerald-100 text-emerald-700',
  개인: 'bg-amber-100 text-amber-700',
};

export default function NotePasteModal({ onClose }: { onClose: () => void }) {
  const { status, settings, showToast, refreshEvents } = useApp();
  const { update } = useData();
  const [text, setText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[] | null>(null);
  const [addedTodos, setAddedTodos] = useState<ParsedTodo[]>([]);
  const [retryIn, setRetryIn] = useState(0); // 429 한도 초과 시 남은 대기 초

  const connected = Boolean(status?.connected);

  // 한도 초과 대기 카운트다운
  useEffect(() => {
    if (retryIn <= 0) return;
    const id = setInterval(() => setRetryIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [retryIn]);

  async function analyze() {
    if (!text.trim()) {
      showToast('error', '쪽지 내용을 붙여넣어 주세요.');
      return;
    }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const { events, todos } = await api.parseNote(text);
      if (events.length === 0 && todos.length === 0) {
        setAnalyzeError('쪽지에서 일정·할 일을 찾지 못했습니다. 내용을 확인해 주세요.');
        setCards(null);
        return;
      }
      // 추출된 할 일을 업무/교과/개인으로 분류해 데일리 To-Do에 자동 추가
      if (todos.length > 0) {
        const newTodos: Todo[] = todos.map((t) => ({
          id: crypto.randomUUID(),
          text: t.text,
          category: t.category,
          done: false,
          dueDate: t.dueDate ?? undefined,
          createdAt: new Date().toISOString(),
        }));
        update((prev) => ({ todos: [...prev.todos, ...newTodos] }));
        showToast('success', `할 일 ${todos.length}개를 데일리 To-Do에 자동 추가했습니다.`);
      }
      setAddedTodos(todos);
      setCards(events.map((event) => ({ event, status: { state: 'idle' } })));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setRetryIn(e.retryAfter && e.retryAfter > 0 ? e.retryAfter : 30);
      }
      setAnalyzeError(e instanceof Error ? e.message : '분석에 실패했습니다.');
    } finally {
      setAnalyzing(false);
    }
  }

  function updateEvent(index: number, patch: Partial<ParsedEvent>) {
    setCards((prev) =>
      prev
        ? prev.map((c, i) =>
            i === index ? { ...c, event: { ...c.event, ...patch }, status: { state: 'idle' } } : c,
          )
        : prev,
    );
  }

  async function registerOne(index: number, refresh = true): Promise<boolean> {
    const card = cards?.[index];
    if (!card || card.status.state === 'done') return true;
    const ev = card.event;
    if (!ev.title.trim() || !ev.date) {
      setCards((prev) =>
        prev
          ? prev.map((c, i) =>
              i === index ? { ...c, status: { state: 'error', message: '제목과 날짜를 입력해 주세요.' } } : c,
            )
          : prev,
      );
      return false;
    }
    setCards((prev) =>
      prev ? prev.map((c, i) => (i === index ? { ...c, status: { state: 'saving' } } : c)) : prev,
    );
    try {
      await api.createEvent({
        title: ev.title.trim(),
        date: ev.date,
        allDay: ev.allDay || !ev.startTime,
        startTime: ev.allDay ? null : ev.startTime,
        endTime: ev.allDay ? null : ev.endTime,
        location: ev.location ?? '',
        description: ev.memo,
        calendarId: settings.calendarId,
      });
      setCards((prev) =>
        prev ? prev.map((c, i) => (i === index ? { ...c, status: { state: 'done' } } : c)) : prev,
      );
      if (refresh) await refreshEvents();
      return true;
    } catch (e) {
      setCards((prev) =>
        prev
          ? prev.map((c, i) =>
              i === index
                ? { ...c, status: { state: 'error', message: e instanceof Error ? e.message : '등록 실패' } }
                : c,
            )
          : prev,
      );
      return false;
    }
  }

  async function registerAll() {
    if (!cards) return;
    let ok = 0;
    for (let i = 0; i < cards.length; i++) {
      if (await registerOne(i, false)) ok++;
    }
    await refreshEvents();
    showToast(ok === cards.length ? 'success' : 'error', `${cards.length}건 중 ${ok}건 등록되었습니다.`);
  }

  const inputCls =
    'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Sparkles size={18} className="text-mint-500" />
            쪽지 붙여넣기
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!cards && (
            <>
              <p className="text-sm text-slate-500">
                학교에서 받은 안내문·공지·쪽지를 그대로 붙여넣으면 Gemini가 일정을 추출해 드립니다.
                추출 결과를 확인·수정한 뒤 직접 등록 버튼을 눌러야 캘린더에 반영됩니다.
              </p>
              <textarea
                className="min-h-48 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none transition focus:border-mint-400 focus:bg-white focus:ring-2 focus:ring-mint-100"
                placeholder="예) 다음 주 화요일 15:00 3층 회의실에서 학년부 협의회가 있습니다…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
              {analyzeError && (
                <div
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${
                    retryIn > 0 ? 'bg-amber-50 text-amber-700' : 'text-rose-500'
                  }`}
                >
                  {retryIn > 0 ? <Clock size={15} /> : <AlertTriangle size={15} />}
                  <span>{analyzeError}</span>
                  {retryIn > 0 && (
                    <span className="ml-auto font-semibold tabular-nums">{retryIn}초</span>
                  )}
                </div>
              )}
            </>
          )}

          {cards && (
            <>
              {/* 자동 분류되어 데일리 To-Do에 추가된 할 일 */}
              {addedTodos.length > 0 && (
                <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-mint-700">
                    <ListChecks size={16} />
                    데일리 To-Do에 자동 추가됨 ({addedTodos.length})
                  </p>
                  <ul className="space-y-1.5">
                    {addedTodos.map((t, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TODO_BADGE[t.category]}`}>
                          {t.category}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{t.text}</span>
                        {t.dueDate && (
                          <span className="shrink-0 text-xs text-slate-400">
                            {t.dueDate.slice(5).replace('-', '/')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-slate-400">
                    체크리스트에서 확인·수정할 수 있습니다.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  {cards.length > 0
                    ? `${cards.length}건의 일정을 찾았습니다. 내용을 확인·수정한 뒤 등록하세요.`
                    : '등록할 일정은 없습니다.'}
                </p>
                <button
                  onClick={() => setCards(null)}
                  className="text-xs font-medium text-slate-400 underline-offset-2 hover:underline"
                >
                  다시 입력
                </button>
              </div>
              {!connected && (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  구글 계정이 연동되어 있지 않아 등록할 수 없습니다. 먼저 상단의 &lsquo;구글 계정
                  연동&rsquo;을 진행해 주세요.
                </p>
              )}
              {cards.map(({ event: ev, status: st }, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 ${
                    st.state === 'done' ? 'border-mint-200 bg-mint-50/60' : 'border-slate-200'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <input
                      className={`${inputCls} flex-1 font-semibold`}
                      value={ev.title}
                      onChange={(e) => updateEvent(i, { title: e.target.value })}
                    />
                    {ev.needsConfirmation && st.state !== 'done' && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        <AlertTriangle size={12} /> 날짜·시간 확인 필요
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      className={inputCls}
                      value={ev.date}
                      onChange={(e) => updateEvent(i, { date: e.target.value })}
                    />
                    <label className="flex items-center gap-1.5 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={ev.allDay}
                        onChange={(e) => updateEvent(i, { allDay: e.target.checked })}
                        className="h-4 w-4 accent-mint-500"
                      />
                      종일
                    </label>
                    {!ev.allDay && (
                      <>
                        <input
                          type="time"
                          className={inputCls}
                          value={ev.startTime ?? ''}
                          onChange={(e) => updateEvent(i, { startTime: e.target.value || null })}
                        />
                        <span className="text-slate-400">~</span>
                        <input
                          type="time"
                          className={inputCls}
                          value={ev.endTime ?? ''}
                          onChange={(e) => updateEvent(i, { endTime: e.target.value || null })}
                        />
                      </>
                    )}
                    <input
                      className={`${inputCls} min-w-32 flex-1`}
                      placeholder="장소"
                      value={ev.location ?? ''}
                      onChange={(e) => updateEvent(i, { location: e.target.value })}
                    />
                  </div>
                  {ev.memo && <p className="mt-2 text-xs leading-relaxed text-slate-500">{ev.memo}</p>}

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {st.state === 'error' && (
                      <span className="text-xs text-rose-500">{st.message}</span>
                    )}
                    {st.state === 'done' ? (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-mint-600">
                        <CheckCircle2 size={16} /> 등록 완료
                      </span>
                    ) : (
                      <button
                        onClick={() => void registerOne(i)}
                        disabled={!connected || st.state === 'saving'}
                        className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
                      >
                        {st.state === 'saving' ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <CalendarPlus size={15} />
                        )}
                        캘린더에 등록
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {!cards ? (
            <button
              onClick={() => void analyze()}
              disabled={analyzing || retryIn > 0}
              className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
            >
              {analyzing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : retryIn > 0 ? (
                <Clock size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {analyzing ? '분석 중…' : retryIn > 0 ? `${retryIn}초 후 재시도 가능` : 'Gemini로 일정 추출'}
            </button>
          ) : (
            <button
              onClick={() => void registerAll()}
              disabled={!connected || cards.every((c) => c.status.state === 'done')}
              className="flex items-center gap-2 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
            >
              <CalendarPlus size={16} />
              모두 등록
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
