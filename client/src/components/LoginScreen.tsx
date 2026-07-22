import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, Sun } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';

export default function LoginScreen() {
  const { refreshStatus } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await api.sessionLogin(password);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f8f7] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-mint-100 text-mint-600">
            <Sun size={20} />
          </span>
          <span className="text-lg font-bold tracking-tight text-mint-700">미요 플래너</span>
        </div>

        <h1 className="text-base font-semibold text-slate-700">비밀번호를 입력하세요</h1>
        <p className="mt-1 mb-5 text-sm text-slate-400">이 앱은 비밀번호로 보호되어 있습니다.</p>

        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:border-mint-400 focus-within:ring-2 focus-within:ring-mint-100">
            <KeyRound size={16} className="shrink-0 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoFocus
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </div>
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-mint-500 py-2.5 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            로그인
          </button>
        </form>
      </div>
    </div>
  );
}
