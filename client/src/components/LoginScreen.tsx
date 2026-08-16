import { LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { connectGoogle } = useApp();
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f8f7]">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <img src="/miyo.png" alt="미요" width={104} height={104} className="mx-auto mb-3" draggable={false} />
          <h1 className="text-xl font-bold text-mint-700">미요 플래너</h1>
          <p className="mt-2 mb-6 text-sm leading-relaxed text-slate-500">
            미요 플래너는 학교 선생님을 위한 하루 일정·업무 관리 서비스입니다. 시간표, 할 일, 회의록,
            급식·학사일정, 품의서 작성, 초과근무 기록까지 한 곳에서 정리하고, 구글 캘린더와 연동해
            일정을 관리할 수 있습니다.
          </p>
          <button
            onClick={() => void connectGoogle()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            <LogIn size={16} /> Google 계정으로 시작하기
          </button>
        </div>
      </div>
      <footer className="px-4 pb-6 text-center text-xs text-slate-400">
        <a href="/privacy.html" className="underline-offset-2 hover:text-mint-600 hover:underline">
          개인정보처리방침
        </a>
      </footer>
    </div>
  );
}
