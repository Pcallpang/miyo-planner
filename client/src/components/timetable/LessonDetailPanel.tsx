import SlidePanel from '../SlidePanel';

interface Props {
  subject: string;
  className: string; // 패널을 연 반 — 표시에만 쓰고 메모는 subject로만 저장
  total: number; // 이 반의 총 차시(반마다 다를 수 있음)
  current: number;
  notes: string[]; // 과목 전체가 공유하는 메모
  onClose: () => void;
  onSaveNote: (index: number, value: string) => void; // index: 0부터
}

/** 과목 하나의 차시별 계획을 적는 슬라이드 패널. 메모는 반과 무관하게 과목 전체가 공유한다. */
export default function LessonDetailPanel({
  subject,
  className,
  total,
  current,
  notes,
  onClose,
  onSaveNote,
}: Props) {
  return (
    <SlidePanel title={`${subject} 차시 계획`} onClose={onClose}>
      {() => (
        <div className="space-y-3">
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            지금 보는 반: {className || '반 미지정'}
            <br />
            메모는 같은 과목의 모든 반에 함께 적용됩니다.
          </p>
          <ul className="space-y-1.5">
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className={`flex items-center gap-2 rounded-lg p-1.5 ${i < current ? 'bg-mint-50' : ''}`}>
                <span className="w-14 shrink-0 text-xs font-medium text-slate-500">{i + 1}차시</span>
                <input
                  type="text"
                  value={notes[i] ?? ''}
                  onChange={(e) => onSaveNote(i, e.target.value)}
                  placeholder="이 차시에 배울 내용"
                  className="w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-mint-400"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </SlidePanel>
  );
}
