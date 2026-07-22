import { useEffect, useRef, useState } from 'react';
import { Hourglass, Pause, Play, RotateCcw, Watch } from 'lucide-react';

function fmt(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Countdown() {
  const [inputMin, setInputMin] = useState(10);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null || prev <= 1) {
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const total = remaining ?? inputMin * 60;

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-700">
        <Hourglass size={17} className="text-mint-500" />
        카운트다운
      </h2>

      <div className="mb-4 text-center">
        <p
          className={`text-5xl font-bold tabular-nums ${
            finished ? 'animate-pulse text-rose-500' : 'text-slate-800'
          }`}
        >
          {fmt(total)}
        </p>
        {finished && <p className="mt-2 text-sm font-semibold text-rose-500">시간 종료!</p>}
      </div>

      {remaining === null && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <input
            type="number"
            min={1}
            max={180}
            value={inputMin}
            onChange={(e) => setInputMin(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
            className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm outline-none focus:border-mint-400"
          />
          <span className="text-sm text-slate-500">분</span>
        </div>
      )}

      <div className="flex justify-center gap-2">
        {!running ? (
          <button
            onClick={() => {
              setFinished(false);
              if (remaining === null || remaining === 0) setRemaining(inputMin * 60);
              setRunning(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            <Play size={15} /> 시작
          </button>
        ) : (
          <button
            onClick={() => setRunning(false)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            <Pause size={15} /> 일시정지
          </button>
        )}
        <button
          onClick={() => {
            setRunning(false);
            setRemaining(null);
            setFinished(false);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
        >
          <RotateCcw size={15} /> 리셋
        </button>
      </div>
    </section>
  );
}

function Stopwatch() {
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now() - elapsed;
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const totalSec = Math.floor(elapsed / 1000);
  const tenth = Math.floor((elapsed % 1000) / 100);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-700">
        <Watch size={17} className="text-mint-500" />
        스톱워치
      </h2>

      <p className="mb-6 text-center text-5xl font-bold tabular-nums text-slate-800">
        {fmt(totalSec)}
        <span className="text-2xl text-slate-400">.{tenth}</span>
      </p>

      <div className="flex justify-center gap-2">
        {!running ? (
          <button
            onClick={() => setRunning(true)}
            className="flex items-center gap-1.5 rounded-xl bg-mint-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            <Play size={15} /> 시작
          </button>
        ) : (
          <button
            onClick={() => setRunning(false)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            <Pause size={15} /> 일시정지
          </button>
        )}
        <button
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
        >
          <RotateCcw size={15} /> 리셋
        </button>
      </div>
    </section>
  );
}

export default function TimerView() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <Countdown />
      <Stopwatch />
    </div>
  );
}
