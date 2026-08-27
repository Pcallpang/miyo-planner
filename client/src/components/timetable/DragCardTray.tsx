import { Trash2 } from 'lucide-react';

interface Props {
  onCardDragStart: (kind: 'lunch' | 'makeup' | 'cancel') => void;
  onCardDragEnd: () => void;
  onTrashDragEnter: () => void;
  onTrashDragLeave: () => void;
  onTrashDrop: () => void;
  trashActive: boolean;
}

const CARD_STYLES: Record<'lunch' | 'makeup' | 'cancel', string> = {
  lunch: 'border-amber-200 bg-amber-50 text-amber-700',
  makeup: 'border-violet-200 bg-violet-50 text-violet-700',
  cancel: 'border-slate-300 bg-slate-100 text-slate-600',
};

const CARD_LABELS: Record<'lunch' | 'makeup' | 'cancel', string> = {
  lunch: '점심시간',
  makeup: '보강',
  cancel: '휴강',
};

/** 시간표 아래 카드 트레이. 점심시간 카드는 교시 사이 틈에, 보강·휴강 카드는
 *  칸 위에 드래그해서 놓는다. 이미 들어간 점심시간 줄·보강·휴강, 또는 배정된
 *  수업 칸을 옆 휴지통으로 드래그하면 지워진다. */
export default function DragCardTray({
  onCardDragStart,
  onCardDragEnd,
  onTrashDragEnter,
  onTrashDragLeave,
  onTrashDrop,
  trashActive,
}: Props) {
  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
      {(['lunch', 'makeup', 'cancel'] as const).map((kind) => (
        <div
          key={kind}
          draggable
          onDragStart={() => onCardDragStart(kind)}
          onDragEnd={onCardDragEnd}
          className={`flex-1 cursor-grab select-none rounded-xl border px-3 py-2 text-center text-xs font-semibold active:cursor-grabbing ${CARD_STYLES[kind]}`}
        >
          {CARD_LABELS[kind]}
        </div>
      ))}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={onTrashDragEnter}
        onDragLeave={onTrashDragLeave}
        onDrop={onTrashDrop}
        title="점심시간·보강·휴강이나 배정된 수업 칸을 여기로 드래그하면 삭제돼요"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
          trashActive ? 'border-rose-400 bg-rose-100 text-rose-600' : 'border-slate-200 bg-white text-slate-400'
        }`}
      >
        <Trash2 size={16} />
      </div>
    </div>
  );
}
