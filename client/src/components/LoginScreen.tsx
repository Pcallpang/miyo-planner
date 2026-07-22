import { LogIn } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { connectGoogle } = useApp();
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f8f7] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <img src="/miyo.png" alt="미요" width={104} height={104} className="mx-auto mb-3" draggable={false} />
        <h1 className="text-xl font-bold text-mint-700">미요 플래너</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">구글 계정으로 로그인해 시작하세요.</p>
        <button
          onClick={() => void connectGoogle()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600"
        >
          <LogIn size={16} /> Google로 로그인
        </button>
      </div>
    </div>
  );
}
