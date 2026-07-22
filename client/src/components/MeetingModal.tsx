import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { Meeting } from '../types';

interface Props {
  /** 수정 시 기존 회의, 추가 시 undefined */
  editing?: Meeting;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
  /** 로컬 상태에 반영(추가 또는 수정) */
  onCommit: (meeting: Meeting, isNew: boolean) => void;
}

export default function MeetingModal({ editing, defaultDate, onClose, onCommit }: Props) {
  const { status, settings, showToast, refreshEvents } = useApp();
  const connected = Boolean(status?.connected);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? defaultDate ?? '');
  const [time, setTime] = useState(editing?.time ?? '');
  const [link, setLink] = useState(editing?.link ?? '');
  const [memo, setMemo] = useState(editing?.memo ?? '');
  const [syncGoogle, setSyncGoogle] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) {
      showToast('error', '제목과 일정 날짜를 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      let googleEventId = editing?.googleEventId;
      const eventInput = {
        title: title.trim(),
        date,
        allDay: !time,
        startTime: time || null,
        endTime: null,
        description: memo.trim(),
        calendarId: settings.calendarId,
      };
      if (googleEventId && connected) {
        await api.updateEvent(googleEventId, eventInput);
        await refreshEvents();
      } else if (syncGoogle && connected) {
        const { event } = await api.createEvent(eventInput);
        googleEventId = event.id;
        await refreshEvents();
      }

      const meeting: Meeting = {
        id: editing?.id ?? crypto.randomUUID(),
        title: title.trim(),
        date,
        time: time || undefined,
        memo: memo.trim(),
        link: link.trim() || undefined,
        googleEventId,
      };
      onCommit(meeting, !editing);
      showToast(
        'success',
        editing ? '회의록이 수정되었습니다.' : googleEventId ? '회의록이 저장되고 구글 캘린더에 등록되었습니다.' : '회의록이 저장되었습니다.',
      );
      onClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';
  const labelCls = 'mb-1.5 block text-sm font-semibold text-slate-700';

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{editing ? '회의 수정' : '새 회의 추가'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>제목</label>
            <input
              className={inputCls}
              placeholder="회의 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>일정 및 시간 설정</label>
            <div className="flex gap-2">
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
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
            <label className={labelCls}>회의록 내용</label>
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              placeholder="상세 내용을 입력하세요"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {(!editing || !editing.googleEventId) && (
            <label className={`flex items-center gap-1.5 text-xs ${connected ? 'text-slate-600' : 'text-slate-300'}`}>
              <input
                type="checkbox"
                disabled={!connected}
                checked={syncGoogle}
                onChange={(e) => setSyncGoogle(e.target.checked)}
                className="h-3.5 w-3.5 accent-mint-500"
              />
              구글 캘린더에도 등록{!connected && ' (연동 필요)'}
            </label>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </form>
      </div>
    </div>
  );
}
