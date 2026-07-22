import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  /** close()를 호출하면 슬라이드 아웃 후 닫힌다. */
  children: (close: () => void) => ReactNode;
}

const DURATION = 300; // ms — transition duration과 동일

/** 오른쪽에서 슬라이드로 나오는 패널. ESC·오버레이 클릭으로 닫으면 슬라이드 아웃 후 언마운트. */
export default function SlidePanel({ title, onClose, children }: Props) {
  const [open, setOpen] = useState(false);

  // 마운트 직후 슬라이드 인
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(onClose, DURATION);
  }, [onClose]);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={close}
      />
      <div
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            onClick={close}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100"
            aria-label="닫기 (ESC)"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children(close)}</div>
      </div>
    </div>
  );
}
