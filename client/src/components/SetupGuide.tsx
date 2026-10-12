import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { advanceOnboarding, canConfirmStep, SETUP_STEPS } from '../lib/onboarding';
import { tourPosition } from '../lib/tourPosition';
import type { ViewId } from '../types';

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };

export default function SetupGuide({ onNavigate, onDismiss }: {
  onNavigate: (view: ViewId) => void;
  onDismiss: () => void;
}) {
  const { data, update } = useData();
  const { status, showToast } = useApp();
  const progress = data.onboarding!;
  const index = Math.max(0, Math.min(progress.step, SETUP_STEPS.length - 1));
  const step = SETUP_STEPS[index];
  const ready = canConfirmStep(step.id, data, status);
  const panel = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ target: Rect | null; width: number; height: number; offset: number; cardHeight: number; editing: boolean }>({target:null,width:window.innerWidth,height:window.innerHeight,offset:0,cardHeight:280,editing:false});
  const [details, setDetails] = useState(false);
  const button = 'rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint-600';

  useEffect(() => {
    if (progress.started) onNavigate(step.view);
    setDetails(false);
  }, [progress.started, index, step.view, onNavigate]);

  useEffect(() => {
    let frame = 0;
    let positioned = false;
    let watched: HTMLElement | null = null;
    const resize = new ResizeObserver(() => schedule());
    function measure() {
      const editing = !!document.querySelector('[data-setup-dialog]');
      const target = progress.started ? document.getElementById(step.target) : null;
      if (target !== watched) {
        positioned = false;
        if (watched) resize.unobserve(watched);
        watched = target;
        if (target) resize.observe(target);
      }
      if (target && !positioned && !editing) {
        positioned = true;
        target.scrollIntoView({block:'start', behavior:'instant'});
        panel.current?.focus({preventScroll:true});
      }
      const rect = target?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const next = {
        target: rect ? {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height} : null,
        width:viewport?.width ?? window.innerWidth, height:viewport?.height ?? window.innerHeight,
        offset:viewport?.offsetTop ?? 0, cardHeight:panel.current?.offsetHeight || 280, editing,
      };
      setLayout(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); }
    const mutation = new MutationObserver(schedule);
    const main = document.querySelector('main');
    // Observe the app only: portal positioning must not retrigger its own observer.
    if (main) mutation.observe(main,{childList:true,subtree:true});
    if (panel.current) resize.observe(panel.current);
    window.addEventListener('resize',schedule);
    window.addEventListener('scroll',schedule,true);
    window.visualViewport?.addEventListener('resize',schedule);
    window.visualViewport?.addEventListener('scroll',schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect();
      window.removeEventListener('resize',schedule); window.removeEventListener('scroll',schedule,true);
      window.visualViewport?.removeEventListener('resize',schedule); window.visualViewport?.removeEventListener('scroll',schedule);
    };
  }, [progress.started, step.target]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[data-setup-dialog]')) onDismiss();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onDismiss]);

  function advance(confirmed: boolean) {
    const next = advanceOnboarding(progress, confirmed);
    update({ onboarding: next });
    if (next.completed) showToast('success', '처음 사용 안내를 마쳤어요. 환경 설정에서 언제든 다시 볼 수 있어요.');
  }
  const position = tourPosition(layout.target, layout.width, layout.height, layout.cardHeight);
  const welcome = !progress.started;
  return createPortal(
    <div style={{visibility:layout.editing ? 'hidden' : undefined}}>
      {!welcome && layout.target && <div data-tour-highlight aria-hidden="true" className="pointer-events-none fixed z-40 rounded-xl border-2 border-mint-500" style={{
        left:layout.target.left-6,top:layout.target.top-6,width:layout.target.width+12,height:layout.target.height+12,
        boxShadow:'0 0 0 9999px rgb(15 23 42 / 0.28)',
      }} />}
      {welcome && <div className="pointer-events-none fixed inset-0 z-40 bg-slate-900/30" />}
      <div ref={panel} id="setup-guide" role="dialog" aria-modal="false" aria-labelledby="setup-guide-title" tabIndex={-1}
        className="fixed z-[60] flex flex-col rounded-2xl border border-mint-200 bg-white shadow-2xl outline-none"
        style={welcome ? {width:Math.min(420,layout.width-24),left:'50%',top:'50%',transform:'translate(-50%, -50%)',maxHeight:'85dvh'} : {...position,top:position.top+layout.offset}}>
        <div className="flex shrink-0 items-start justify-between gap-2 px-5 pt-4">
          <div><p className="text-xs font-semibold text-mint-600">미요와 함께 · {welcome ? '처음 설정하기' : `${index+1} / ${SETUP_STEPS.length}`}</p>
            <h2 id="setup-guide-title" className="mt-1 text-base font-bold text-slate-800">{welcome ? '선생님, 미요 플래너에 오신 것을 환영해요!' : step.title}</h2></div>
          <button onClick={onDismiss} aria-label="처음 사용 안내 나중에 하기" className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18}/></button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 py-3 text-sm leading-relaxed text-slate-600" aria-live="polite">
          {welcome ? <p>설정할 곳을 하나씩 짚어 드릴게요. 강조된 입력칸에서 직접 설정한 뒤 ‘다음’을 눌러 주세요. 언제든 닫고 이어할 수 있어요.</p> : <>
            <p>{step.instructions[0]}</p>
            {step.id === 'school' && <p className="mt-1">검색 결과에서 우리 학교를 선택해 주세요.</p>}
            {step.id === 'periods' && <p className="mt-1">‘시간 편집’에서 교시별 시각도 확인해 주세요.</p>}
            {step.id === 'calendar' && <p className="mt-1">{status?.connected ? '연동되어 있어요. 아래에서 사용할 캘린더를 선택해 주세요.' : '강조된 영역의 ‘구글 계정 연동’을 눌러 연결해 주세요.'}</p>}
            {step.id === 'gemini' && <><p className="mt-1">발급한 키를 강조된 입력칸에 붙여넣고 ‘연결’을 눌러 주세요.</p><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-mint-700 underline underline-offset-4">Google AI Studio에서 키 발급 ↗</a></>}
            <button className="mt-2 block text-xs text-slate-500 underline underline-offset-2" aria-expanded={details} onClick={()=>setDetails(!details)}>{details ? '자세한 설명 접기' : '자세한 설명 보기'}</button>
            {details && <ol className="mt-2 list-decimal space-y-1 pl-4">{step.instructions.slice(1).map(text=><li key={text}>{text}</li>)}</ol>}
            {!layout.target && <button className="mt-2 text-mint-700 underline" onClick={()=>onNavigate(step.view)}>안내 위치로 이동</button>}
            {!ready && <p className="mt-2 text-xs text-slate-400">설정을 마치면 다음 버튼이 켜져요. 지금은 건너뛰어도 괜찮아요.</p>}
          </>}
        </div>
        <div className="shrink-0 border-t border-slate-100 px-4 py-3">
          {welcome ? <div className="flex justify-end gap-2"><button className={`${button} text-slate-500`} onClick={onDismiss}>나중에 하기</button><button className={`${button} bg-mint-600 text-white`} onClick={()=>update({onboarding:{...progress,started:true}})}>설정 시작하기 <ArrowRight size={14} className="inline"/></button></div> : <>
            <div className="flex items-center justify-between gap-2"><button className={`${button} text-slate-500 disabled:opacity-30`} disabled={index===0} onClick={()=>update({onboarding:{...progress,step:index-1}})}><ArrowLeft size={14} className="inline"/> 이전</button>
              <button className={`${button} bg-mint-600 text-white disabled:cursor-not-allowed disabled:opacity-40`} disabled={!ready || !layout.target} onClick={()=>advance(true)}>{index===SETUP_STEPS.length-1 ? '안내 마치기' : '다음'} <ArrowRight size={14} className="inline"/></button></div>
            <button className="mt-1 block w-full py-1 text-xs text-slate-400 hover:text-slate-600" onClick={()=>advance(false)}>{index===SETUP_STEPS.length-1 ? '알림 설정 없이 마치기' : '이 단계는 건너뛰기'}</button>
          </>}
        </div>
      </div>
    </div>, document.body,
  );
}
