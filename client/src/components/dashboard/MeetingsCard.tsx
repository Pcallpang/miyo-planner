import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { FileText, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import type { Meeting } from '../../types';

interface Props {
  meetings: Meeting[];
  setMeetings: Dispatch<SetStateAction<Meeting[]>>;
}

const EMPTY = { title: '', date: '', time: '', memo: '', syncGoogle: false };

export default function MeetingsCard({ meetings, setMeetings }: Props) {
  const { status, settings, showToast, refreshEvents } = useApp();
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const connected = Boolean(status?.connected);
  const sorted = [...meetings].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));

  function openNew() {
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0, 10) });
    setEditing('new');
  }

  function openEdit(m: Meeting) {
    setForm({ title: m.title, date: m.date, time: m.time ?? '', memo: m.memo, syncGoogle: false });
    setEditing(m);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      showToast('error', '제목과 날짜를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      let googleEventId = editing !== 'new' && editing ? editing.googleEventId : undefined;
      const eventInput = {
        title: form.title.trim(),
        date: form.date,
        allDay: !form.time,
        startTime: form.time || null,
        endTime: null,
        description: form.memo.trim(),
        calendarId: settings.calendarId,
      };

      if (googleEventId && connected) {
        await api.updateEvent(googleEventId, eventInput);
        await refreshEvents();
      } else if (form.syncGoogle && connected) {
        const { event } = await api.createEvent(eventInput);
        googleEventId = event.id;
        await refreshEvents();
      }

      if (editing === 'new') {
        setMeetings((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            title: form.title.trim(),
            date: form.date,
            time: form.time || undefined,
            memo: form.memo.trim(),
            googleEventId,
          },
        ]);
        showToast('success', googleEventId ? '회의록이 저장되고 구글 캘린더에 등록되었습니다.' : '회의록이 저장되었습니다.');
      } else if (editing) {
        setMeetings((prev) =>
          prev.map((m) =>
            m.id === editing.id
              ? { ...m, title: form.title.trim(), date: form.date, time: form.time || undefined, memo: form.memo.trim(), googleEventId }
              : m,
          ),
        );
        showToast('success', '회의록이 수정되었습니다.');
      }
      setEditing(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Meeting) {
    if (!window.confirm(`'${m.title}'을(를) 삭제할까요?`)) return;
    if (m.googleEventId && connected) {
      try {
        await api.deleteEvent(m.googleEventId, settings.calendarId);
        await refreshEvents();
      } catch {
        showToast('error', '구글 캘린더 일정 삭제에는 실패했습니다. 캘린더에서 직접 확인해 주세요.');
      }
    }
    setMeetings((prev) => prev.filter((x) => x.id !== m.id));
  }

  const inputCls =
    'w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
          <FileText size={17} className="text-mint-500" />
          회의록 &amp; 일정
        </h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-mint-300 hover:text-mint-600"
        >
          <Plus size={12} /> 추가
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="mb-3 space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              {editing === 'new' ? '새 회의록·일정' : '수정'}
            </p>
            <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <input
            className={inputCls}
            placeholder="제목"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
          />
          <div className="flex gap-2">
            <input
              type="date"
              className={inputCls}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
            <input
              type="time"
              className={inputCls}
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>
          <textarea
            className={`${inputCls} min-h-16 resize-y`}
            placeholder="메모"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
          />
          {(editing === 'new' || !editing.googleEventId) && (
            <label
              className={`flex items-center gap-1.5 text-xs ${connected ? 'text-slate-600' : 'text-slate-300'}`}
            >
              <input
                type="checkbox"
                disabled={!connected}
                checked={form.syncGoogle}
                onChange={(e) => setForm((f) => ({ ...f, syncGoogle: e.target.checked }))}
                className="h-3.5 w-3.5 accent-mint-500"
              />
              구글 캘린더에도 등록
              {!connected && ' (연동 필요)'}
            </label>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-mint-500 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </form>
      )}

      <ul className="max-h-64 space-y-1.5 overflow-y-auto">
        {sorted.length === 0 && <li className="py-2 text-sm text-slate-400">등록된 항목이 없습니다.</li>}
        {sorted.map((m) => (
          <li key={m.id} className="group rounded-xl px-2 py-2 transition hover:bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm font-medium text-slate-700">{m.title}</span>
              <button
                onClick={() => openEdit(m)}
                className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-mint-500"
                aria-label="수정"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => void remove(m)}
                className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                aria-label="삭제"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {m.date.slice(5).replace('-', '/')}
              {m.time && ` ${m.time}`}
              {m.googleEventId && <span className="ml-1.5 text-mint-500">· 구글 연동됨</span>}
            </p>
            {m.memo && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{m.memo}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
