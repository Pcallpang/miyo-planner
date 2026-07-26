import { useState, type FormEvent } from 'react';
import { Check, School as SchoolIcon, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { School } from '../types';

/** 나이스에서 학교를 검색해 설정에 등록한다. */
export default function SchoolPicker() {
  const { settings, setSettings, showToast } = useApp();
  const selected = settings.school;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    const name = query.trim();
    if (name.length < 2) {
      showToast('error', '학교명을 두 글자 이상 입력해 주세요.');
      return;
    }
    setSearching(true);
    try {
      const { schools } = await api.searchSchools(name);
      setResults(schools);
      if (schools.length === 0) showToast('info', '검색 결과가 없습니다. 학교명을 확인해 주세요.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '학교를 검색하지 못했습니다.');
    } finally {
      setSearching(false);
    }
  }

  function pick(school: School) {
    setSettings((prev) => ({ ...prev, school }));
    setResults(null);
    setQuery('');
    showToast('success', `${school.name}으로 설정했습니다.`);
  }

  function clear() {
    setSettings((prev) => {
      const next = { ...prev };
      delete next.school;
      return next;
    });
    showToast('info', '학교 설정을 해제했습니다.');
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100';

  return (
    <div className="py-4">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">우리 학교</p>
          <p className="mt-0.5 text-xs text-slate-400">
            등록하면 급식과 학사일정을 나이스에서 자동으로 가져옵니다.
          </p>
        </div>
      </div>

      {selected ? (
        <div className="flex items-center gap-2.5 rounded-xl bg-mint-50 px-3.5 py-3 ring-1 ring-mint-200">
          <SchoolIcon size={16} className="shrink-0 text-mint-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-mint-800">{selected.name}</p>
            <p className="truncate text-xs text-mint-600/80">
              {[selected.region, selected.kind].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            onClick={clear}
            className="shrink-0 rounded-lg p-1 text-mint-600/70 transition hover:bg-mint-100 hover:text-rose-500"
            aria-label="학교 설정 해제"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <form onSubmit={search} className="flex gap-2">
          <input
            className={inputCls}
            placeholder="학교명 검색 (예: 선인고등학교)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={searching}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-50"
          >
            <Search size={14} />
            {searching ? '검색 중…' : '검색'}
          </button>
        </form>
      )}

      {results && results.length > 0 && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-2">
          {results.map((s) => (
            <li key={`${s.atptCode}-${s.schoolCode}`}>
              <button
                onClick={() => pick(s)}
                className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{s.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[s.region, s.kind, s.address].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Check size={14} className="shrink-0 text-mint-500 opacity-0 transition group-hover:opacity-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
