import { LogIn, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { connectGoogle } = useApp();
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f8f7] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-mint-100 text-mint-600">
            <Sun size={20} />
          </span>
          <span className="text-lg font-bold text-mint-700">미요 플래너</span>
        </div>
        <p className="mb-5 text-sm text-slate-500">구글 계정으로 로그인해 시작하세요.</p>
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
