import { useEffect, useState } from 'react';
import {
  AlertTriangle, CalendarPlus, CheckCircle2, ClipboardList, Inbox, ListChecks, Loader2, MessageCircle, X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DateField from './DateField';
import type { MessengerAlert, ParsedEvent, TodoCategory } from '../types';

type CardStatus = { state: 'idle' | 'saving' | 'done' } | { state: 'error'; message: string };

interface EventCard {
  alertId: string;
  index: number; // 같은 alert 안에서 몇 번째 이벤트인지
  event: ParsedEvent;
  status: CardStatus;
  toCalendar: boolean;
  toMeeting: boolean;
  toTodo: boolean;
  todoCategory: TodoCategory;
}

const TODO_BADGE: Record<TodoCategory, string> = {
  업무: 'bg-mint-100 text-mint-700',
  교과: 'bg-emerald-100 text-emerald-700',
  개인: 'bg-amber-100 text-amber-700',
};

interface Props {
  onClose: () => void;
  /** 알림 하나가 처리·무시돼서 대기 목록이 바뀔 때마다 호출한다 — 사이드바/더보기의
   *  숫자 배지가 다음 자동 확인(15초)까지 기다리지 않고 바로 갱신되게 하기 위해서다. */
  onAlertsChanged?: () => void;
}

export default function MessengerAlertModal({ onClose, onAlertsChanged }: Props) {
  const { status, settings, refreshEvents } = useApp();
  const { update } = useData();
  useEscapeKey(onClose);

  const [alerts, setAlerts] = useState<MessengerAlert[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cards, setCards] = useState<EventCard[]>([]);
  const [addedTodoKeys, setAddedTodoKeys] = useState<Set<string>>(new Set());

  const connected = Boolean(status?.connected);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { alerts } = await api.listMessengerAlerts();
        if (cancelled) return;
        setAlerts(alerts);
        setCards(
          alerts.flatMap((a) =>
            a.events.map((event, index) => ({
              alertId: a.id,
              index,
              event,
              status: { state: 'idle' } as CardStatus,
              toCalendar: true,
              toMeeting: false,
              toTodo: false,
              todoCategory: '업무' as TodoCategory,
            })),
          ),
        );
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // cardsSnapshot/addedTodoKeysSnapshot은 호출부가 방금 계산한 최신 값을 넘긴다.
  // 컴포넌트 state(cards/addedTodoKeys)를 클로저로 직접 읽지 않는 것이 핵심 —
  // setCards/setAddedTodoKeys 직후 같은 함수 안에서 호출해도 그 값이 그대로 반영되어야
  // "마지막 항목 처리 → 자동 해제"가 stale closure 없이 항상 성립한다.
  function remainingCount(alertId: string, cardsSnapshot: EventCard[], addedTodoKeysSnapshot: Set<string>): number {
    const alert = alerts?.find((a) => a.id === alertId);
    if (!alert) return 0;
    const pendingEvents = cardsSnapshot.filter((c) => c.alertId === alertId && c.status.state !== 'done').length;
    const pendingTodos = alert.todos.filter((_, i) => !addedTodoKeysSnapshot.has(`${alertId}:${i}`)).length;
    return pendingEvents + pendingTodos;
  }

  async function dismissIfDone(alertId: string, cardsSnapshot: EventCard[], addedTodoKeysSnapshot: Set<string>) {
    if (remainingCount(alertId, cardsSnapshot, addedTodoKeysSnapshot) > 0) return;
    try {
      await api.dismissMessengerAlert(alertId);
    } catch {
      /* 실패해도 다음에 열 때 다시 시도하면 된다 — 사용자를 막지 않는다. */
    }
    setAlerts((prev) => (prev ? prev.filter((a) => a.id !== alertId) : prev));
    onAlertsChanged?.();
  }

  async function ignoreAlert(alertId: string) {
    try {
      await api.dismissMessengerAlert(alertId);
    } catch {
      /* noop */
    }
    setAlerts((prev) => (prev ? prev.filter((a) => a.id !== alertId) : prev));
    setCards((prev) => prev.filter((c) => c.alertId !== alertId));
    onAlertsChanged?.();
  }

  function updateCard(key: string, patch: Partial<EventCard>) {
    setCards((prev) =>
      prev.map((c) => (`${c.alertId}:${c.index}` === key ? { ...c, ...patch, status: { state: 'idle' } } : c)),
    );
  }

  async function registerCard(key: string) {
    const card = cards.find((c) => `${c.alertId}:${c.index}` === key);
    if (!card || card.status.state === 'done') return;
    const ev = card.event;
    if (!card.toCalendar && !card.toMeeting && !card.toTodo) {
      setCards((prev) =>
        prev.map((c) =>
          `${c.alertId}:${c.index}` === key
            ? { ...c, status: { state: 'error', message: '캘린더·회의록&일정·TO-DO 중 하나를 선택해 주세요.' } }
            : c,
        ),
      );
      return;
    }
    setCards((prev) => prev.map((c) => (`${c.alertId}:${c.index}` === key ? { ...c, status: { state: 'saving' } } : c)));
    try {
      if (card.toCalendar) {
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
      }
      if (card.toMeeting) {
        update((prev) => ({
          meetings: [
            ...prev.meetings,
            {
              id: crypto.randomUUID(),
              title: ev.title.trim(),
              date: ev.date,
              time: ev.allDay ? undefined : (ev.startTime ?? undefined),
              memo: ev.memo,
              link: undefined,
            },
          ],
        }));
      }
      if (card.toTodo) {
        update((prev) => ({
          todos: [
            ...prev.todos,
            {
              id: crypto.randomUUID(),
              text: ev.title.trim(),
              category: card.todoCategory,
              done: false,
              dueDate: ev.date,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }
      // setCards의 updater가 이 시점에 아직 flush되지 않았을 수도 있으므로(특히
      // toCalendar가 false라 위에서 await를 거치지 않은 경로), updatedCards의
      // 폴백 시드는 빈 배열이 아니라 "현재 클로저의 cards + 이번 변경"으로 잡는다.
      // 이렇게 하면 최악의 경우에도 concurrency fix 이전 동작과 최소한 동일하게
      // 안전하다 — dismissIfDone이 아직 등록되지 않은 다른 카드를 done으로 잘못
      // 세지 않는다.
      let updatedCards: EventCard[] = cards.map((c) =>
        `${c.alertId}:${c.index}` === key ? { ...c, status: { state: 'done' } as CardStatus } : c,
      );
      setCards((prev) => {
        updatedCards = prev.map((c) =>
          `${c.alertId}:${c.index}` === key ? { ...c, status: { state: 'done' } as CardStatus } : c,
        );
        return updatedCards;
      });
      if (card.toCalendar) await refreshEvents();
      await dismissIfDone(card.alertId, updatedCards, addedTodoKeys);
    } catch (e) {
      setCards((prev) =>
        prev.map((c) =>
          `${c.alertId}:${c.index}` === key
            ? { ...c, status: { state: 'error', message: e instanceof Error ? e.message : '등록 실패' } }
            : c,
        ),
      );
    }
  }

  async function addTodo(alertId: string, todoIndex: number, todo: MessengerAlert['todos'][number]) {
    try {
      update((prev) => ({
        todos: [
          ...prev.todos,
          {
            id: crypto.randomUUID(),
            text: todo.text,
            category: todo.category,
            done: false,
            dueDate: todo.dueDate ?? undefined,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
      // registerCard와 동일한 이유로, 폴백 시드는 빈 Set이 아니라 현재 클로저의
      // addedTodoKeys + 이번 항목으로 잡는다.
      let updatedKeys: Set<string> = new Set(addedTodoKeys).add(`${alertId}:${todoIndex}`);
      setAddedTodoKeys((prev) => {
        updatedKeys = new Set(prev).add(`${alertId}:${todoIndex}`);
        return updatedKeys;
      });
      await dismissIfDone(alertId, cards, updatedKeys);
    } catch (e) {
      // 이 컴포넌트에는 TO-DO 단위 에러 UI가 없다 — 실패 시 added 처리하지 않고
      // 콘솔에만 남겨 사용자가 버튼을 다시 눌러 재시도할 수 있게 한다.
      console.error(e);
    }
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
            <MessageCircle size={18} className="text-mint-500" />
            메신저 알리미
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-sm text-slate-500">
            브리티 메신저에서 자동으로 감지된 쪽지입니다. 확인·수정 후 직접 등록 버튼을 눌러야
            반영됩니다.
          </p>
          {loadError && (
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-rose-500">
              <AlertTriangle size={15} />
              <span>{loadError}</span>
            </div>
          )}
          {alerts && alerts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
              <Inbox size={28} />
              <p className="text-sm">확인 대기 중인 쪽지가 없습니다.</p>
            </div>
          )}
          {!connected && alerts && alerts.length > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              구글 계정이 연동되어 있지 않아 캘린더에는 등록할 수 없습니다. 먼저 상단의 &lsquo;구글 계정
              연동&rsquo;을 진행해 주세요.
            </p>
          )}

          {alerts?.map((alert) => {
            const alertCards = cards.filter((c) => c.alertId === alert.id);
            return (
              <div key={alert.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      브리티
                    </span>
                    {alert.sender && <span className="text-xs text-slate-400">{alert.sender}</span>}
                  </div>
                  <button
                    onClick={() => void ignoreAlert(alert.id)}
                    className="text-xs font-medium text-slate-400 underline-offset-2 hover:underline"
                  >
                    무시
                  </button>
                </div>
                <p className="mb-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                  {alert.bodyExcerpt}
                </p>

                <div className="space-y-3">
                  {alertCards.map(({ alertId, index, event: ev, status: st, toCalendar, toMeeting, toTodo }) => {
                    const key = `${alertId}:${index}`;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3 ${st.state === 'done' ? 'border-mint-200 bg-mint-50/60' : 'border-slate-200'}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <input
                            className={`${inputCls} flex-1 font-semibold`}
                            value={ev.title}
                            onChange={(e) => updateCard(key, { event: { ...ev, title: e.target.value } })}
                          />
                          {ev.needsConfirmation && st.state !== 'done' && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                              <AlertTriangle size={12} /> 날짜·시간 확인 필요
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <DateField
                            className={inputCls}
                            value={ev.date}
                            onChange={(v) => updateCard(key, { event: { ...ev, date: v } })}
                          />
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={ev.allDay}
                              onChange={(e) => updateCard(key, { event: { ...ev, allDay: e.target.checked } })}
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
                                onChange={(e) => updateCard(key, { event: { ...ev, startTime: e.target.value || null } })}
                              />
                              <span className="text-slate-400">~</span>
                              <input
                                type="time"
                                className={inputCls}
                                value={ev.endTime ?? ''}
                                onChange={(e) => updateCard(key, { event: { ...ev, endTime: e.target.value || null } })}
                              />
                            </>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={toCalendar}
                              onChange={(e) => updateCard(key, { toCalendar: e.target.checked })}
                              disabled={st.state === 'done'}
                              className="h-4 w-4 accent-mint-500"
                            />
                            <CalendarPlus size={14} className="text-slate-400" />
                            캘린더
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={toMeeting}
                              onChange={(e) => updateCard(key, { toMeeting: e.target.checked })}
                              disabled={st.state === 'done'}
                              className="h-4 w-4 accent-mint-500"
                            />
                            <ClipboardList size={14} className="text-slate-400" />
                            회의록&amp;일정
                          </label>
                          <label className="flex items-center gap-1.5 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              checked={toTodo}
                              onChange={(e) => updateCard(key, { toTodo: e.target.checked })}
                              disabled={st.state === 'done'}
                              className="h-4 w-4 accent-mint-500"
                            />
                            <ListChecks size={14} className="text-slate-400" />
                            TO-DO
                          </label>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          {st.state === 'error' && <span className="text-xs text-rose-500">{st.message}</span>}
                          {st.state === 'done' ? (
                            <span className="flex items-center gap-1.5 text-sm font-medium text-mint-600">
                              <CheckCircle2 size={16} /> 등록 완료
                            </span>
                          ) : (
                            <button
                              onClick={() => void registerCard(key)}
                              disabled={(!connected && toCalendar) || st.state === 'saving'}
                              className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
                            >
                              {st.state === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
                              등록
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {alert.todos.map((todo, i) =>
                    addedTodoKeys.has(`${alert.id}:${i}`) ? null : (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TODO_BADGE[todo.category]}`}>
                          {todo.category}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{todo.text}</span>
                        {todo.dueDate && <span className="shrink-0 text-xs text-slate-400">{todo.dueDate.slice(5).replace('-', '/')}</span>}
                        <button
                          onClick={() => void addTodo(alert.id, i, todo)}
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-mint-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-mint-600"
                        >
                          <ListChecks size={12} />
                          TO-DO 추가
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
