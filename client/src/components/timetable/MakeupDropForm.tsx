import { useState } from 'react';

interface Props {
  top: number;
  left: number;
  onCancel: () => void;
  onSave: (subject: string, room: string) => void;
}

/** 보강 카드를 칸에 드롭했을 때 그 칸 근처에 뜨는 작은 입력창. 과목·교실을 입력해
 *  저장하면 기존 "칸 클릭 → 보강 저장"과 완전히 같은 데이터가 남는다. */
export default function MakeupDropForm({ top, left, onCancel, onSave }: Props) {
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      <div
        style={{ top, left }}
        className="fixed z-50 w-56 rounded-xl border border-violet-200 bg-white p-3 shadow-xl"
      >
        <p className="mb-2 text-xs font-semibold text-violet-600">보강 추가</p>
        <div className="mb-2 flex gap-1.5">
          <input
            autoFocus
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            placeholder="과목"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <input
            className="w-16 shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
            placeholder="반"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onSave(subject.trim(), room.trim())}
            disabled={!subject.trim()}
            className="flex-1 rounded-lg bg-violet-500 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            취소
          </button>
        </div>
      </div>
    </>
  );
}
