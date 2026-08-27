import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Heart, Sparkles, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApp } from '../context/AppContext';
import EmptyMiyo from '../components/EmptyMiyo';
import type { FeatureRequest } from '../types';

const MAX_LEN = 400; // 서버(server/routes/board.js)의 글자수 제한과 맞춘다

/** 투표수 내림차순, 동률이면 오래된 순 — 서버 정렬 기준과 동일하게 클라이언트에서도
 *  재정렬한다(낙관적 업데이트 직후 순서를 바로 반영하기 위해). */
function sortRequests(list: FeatureRequest[]): FeatureRequest[] {
  return [...list].sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt));
}

/** "미요쌤에게 원해요!" — 모든 로그인 사용자가 함께 보는 기능 요청 게시판. 다른
 *  화면과 달리 1인 전용 AppData가 아니라 전용 API(/api/board)로 직접 조회·등록한다. */
export default function BoardView() {
  const { showToast } = useApp();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { requests: rows } = await api.listFeatureRequests();
      setRequests(sortRequests(rows));
    } catch (e) {
      showToast('error', e instanceof ApiError ? e.message : '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const text = draft.trim();
    if (!text || text.length > MAX_LEN) return;
    setPosting(true);
    try {
      const { request } = await api.createFeatureRequest(text);
      setRequests((prev) => sortRequests([...prev, { ...request, votes: 0, voted: false, isMine: true }]));
      setDraft('');
    } catch (e) {
      showToast('error', e instanceof ApiError ? e.message : '등록하지 못했습니다.');
    } finally {
      setPosting(false);
    }
  }

  async function toggleVote(r: FeatureRequest) {
    setRequests((prev) =>
      sortRequests(
        prev.map((x) => (x.id === r.id ? { ...x, voted: !x.voted, votes: x.votes + (x.voted ? -1 : 1) } : x)),
      ),
    );
    try {
      if (r.voted) await api.unvoteFeatureRequest(r.id);
      else await api.voteFeatureRequest(r.id);
    } catch {
      showToast('error', '투표 처리에 실패했습니다.');
      void load(); // 실패 시 서버 상태로 되돌린다
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteFeatureRequest(id);
      setRequests((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      showToast('error', e instanceof ApiError ? e.message : '삭제하지 못했습니다.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <Sparkles size={18} className="text-mint-500" />
          미요쌤에게 원해요!
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          투표(원해요)가 많은 요청부터 먼저 개발해요. 다른 선생님이 올린 요청에도 투표할 수 있어요.
        </p>
      </div>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <p className="mb-2 rounded-xl bg-mint-50 px-3 py-2 text-xs leading-relaxed text-mint-700">
          다른 선생님들도 이해할 수 있도록 어떤 기능이 왜 필요한지 구체적으로 적어 주세요. 우리 학교만의
          특수한 상황보다는, 다른 학교 선생님도 함께 쓸 수 있는 범용적인 기능을 요청해 주세요.
        </p>
        <textarea
          className="min-h-24 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-mint-400 focus:ring-2 focus:ring-mint-100"
          placeholder="예: 방학 중에도 시간표 화면에서 급식 대신 방학 일정을 보여줬으면 좋겠어요. 지금은 급식 정보만 나와서…"
          value={draft}
          maxLength={MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {draft.length}/{MAX_LEN}
          </span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim() || posting}
            className="rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            요청하기
          </button>
        </div>
      </div>

      {!loading && requests.length === 0 && (
        <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-100">
          <EmptyMiyo message="아직 등록된 요청이 없습니다. 첫 요청을 남겨보세요." size={96} src="/nep-miyo.png" />
        </div>
      )}

      {requests.length > 0 && (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
            >
              <button
                type="button"
                onClick={() => void toggleVote(r)}
                aria-label={r.voted ? '원해요 취소' : '원해요'}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                  r.voted ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-400'
                }`}
              >
                <Heart size={16} fill={r.voted ? 'currentColor' : 'none'} />
                {r.votes}
              </button>

              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{r.text}</p>
                <span className="mt-1 block text-[11px] text-slate-400">
                  {format(parseISO(r.createdAt), 'yyyy/MM/dd HH:mm')}
                </span>
              </div>

              {r.isMine && (
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  aria-label="삭제"
                  className="shrink-0 rounded p-1 text-slate-300 transition hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
