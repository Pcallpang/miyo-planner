interface Props {
  onCardDragStart: (kind: 'lunch' | 'makeup' | 'cancel') => void;
  onCardDragEnd: () => void;
  onTrayDrop: () => void;
  lunchDropActive: boolean;
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
 *  칸 위에 드래그해서 놓는다. 이미 끼운 점심시간 줄을 다시 이 트레이로 드래그하면
 *  없앨 수 있다(그때는 lunchDropActive가 true가 되어 트레이가 옅게 강조된다). */
export default function DragCardTray({ onCardDragStart, onCardDragEnd, onTrayDrop, lunchDropActive }: Props) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onTrayDrop}
      className={`mt-3 flex gap-2 rounded-xl border-t border-slate-100 pt-3 transition ${
        lunchDropActive ? 'bg-rose-50/60' : ''
      }`}
    >
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
    </div>
  );
}
