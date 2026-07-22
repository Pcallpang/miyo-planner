import { type Dispatch, type SetStateAction } from 'react';
import { FileText, Link as LinkIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import EmptyMiyo from '../EmptyMiyo';
import type { Meeting } from '../../types';

interface Props {
  meetings: Meeting[];
  setMeetings: Dispatch<SetStateAction<Meeting[]>>;
  onAdd: () => void;
  onEdit: (m: Meeting) => void;
}

export default function MeetingsCard({ meetings, setMeetings, onAdd, onEdit }: Props) {
  const { status, settings, showToast, refreshEvents } = useApp();
  const connected = Boolean(status?.connected);
  const sorted = [...meetings].sort((a, b) =>
    (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')),
  );

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

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
        <FileText size={17} className="text-mint-500" />
        회의록 &amp; 일정
      </h2>

      <ul className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
        {sorted.length === 0 && (
          <li>
            <EmptyMiyo message="등록된 항목이 없습니다." size={52} />
          </li>
        )}
        {sorted.map((m) => (
          <li key={m.id} className="group rounded-xl px-2 py-2 transition hover:bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm font-medium text-slate-700">{m.title}</span>
              {m.link && (
                <a
                  href={m.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1 text-slate-300 transition hover:text-mint-500"
                  aria-label="관련 링크 열기"
                >
                  <LinkIcon size={13} />
                </a>
              )}
              <button
                onClick={() => onEdit(m)}
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

      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-mint-300 py-2.5 text-sm font-medium text-mint-600 transition hover:bg-mint-50"
      >
        <Plus size={16} /> 추가
      </button>
    </section>
  );
}
