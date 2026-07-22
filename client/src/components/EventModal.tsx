import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { eventToForm } from '../lib/events';
import { useApp } from '../context/AppContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import DateField from './DateField';
import type { GEvent } from '../types';

interface Props {
  /** 수정 시 기존 이벤트, 추가 시 undefined */
  event?: GEvent;
  /** 추가 시 기본 날짜 (YYYY-MM-DD) */
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EventModal({ event, defaultDate, onClose, onSaved }: Props) {
  const { settings, showToast, refreshEvents } = useApp();
  useEscapeKey(onClose);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    event
      ? eventToForm(event)
      : {
          title: '',
          date: defaultDate ?? new Date().toISOString().slice(0, 10),
          allDay: true,
          startTime: '',
          endTime: '',
          location: '',
          description: '',
        },
  );

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('error', '제목을 입력해 주세요.');
      return;
    }
    if (!form.allDay && !form.startTime) {
      showToast('error', '시작 시간을 입력하거나 종일 일정으로 설정해 주세요.');
      return;
    }
    setSaving(true);
    const input = {
      title: form.title.trim(),
      date: form.date,
      allDay: form.allDay,
      startTime: form.allDay ? null : form.startTime,
      endTime: form.allDay ? null : form.endTime || null,
      location: form.location.trim(),
      description: form.description.trim(),
      calendarId: event?.calendarId ?? settings.calendarId,
    };
    try {
      if (event) {
        await api.updateEvent(event.id, input);
        showToast('success', '일정이 수정되었습니다.');
      } else {
        await api.createEvent(input);
        showToast('success', '구글 캘린더에 일정이 등록되었습니다.');
      }
      await refreshEvents();
      onSaved();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    if (!window.confirm(`'${event.title}' 일정을 구글 캘린더에서 삭제할까요?`)) return;
    setSaving(true);
    try {
      await api.deleteEvent(event.id, event.calendarId);
      showToast('success', '일정이 삭제되었습니다.');
      await refreshEvents();
      onSaved();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{event ? '일정 수정' : '일정 추가'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className={inputCls}
            placeholder="일정 제목"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <DateField className={inputCls} value={form.date} onChange={(v) => set('date', v)} />
            <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => set('allDay', e.target.checked)}
                className="h-4 w-4 accent-mint-500"
              />
              종일
            </label>
          </div>
          {!form.allDay && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                className={inputCls}
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
              />
              <span className="text-slate-400">~</span>
              <input
                type="time"
                className={inputCls}
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
              />
            </div>
          )}
          <input
            className={inputCls}
            placeholder="장소 (선택)"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            placeholder="메모 (선택)"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />

          <div className="flex justify-between pt-2">
            {event ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
                className="rounded-xl px-3 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
              >
                삭제
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
              >
                {saving ? '저장 중…' : event ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
