import { useState } from 'react';
import { Clock, LogOut, Settings as SettingsIcon, Unplug } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { api } from '../lib/api';
import { defaultAppData } from '../lib/appData';
import { clearAppData, defaultSettings } from '../lib/storage';
import SchoolPicker from '../components/SchoolPicker';
import PeriodTimesModal from '../components/PeriodTimesModal';

/** 바탕화면 위젯(네이티브 프로그램) 설치 파일 다운로드 링크. 새 버전을 배포하면
 *  GitHub Releases에 새 태그로 올리고 이 값을 갱신한다. */
const NATIVE_WIDGET_DOWNLOAD_URL =
  'https://github.com/Pcallpang/miyo-planner/releases/download/native-widget-v1.0.0/Setup.1.0.0.exe';

export default function SettingsView() {
  const { status, settings, setSettings, calendars, connectGoogle, disconnectGoogle, showToast, refreshStatus } =
    useApp();
  const { update } = useData();
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [editingPeriodTimes, setEditingPeriodTimes] = useState(false);

  async function appLogout() {
    await api.logout();
    await refreshStatus();
  }

  async function saveGeminiKey() {
    if (!geminiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await api.setGeminiKey(geminiKeyInput.trim());
      setGeminiKeyInput('');
      await refreshStatus();
      showToast('success', 'Gemini API 키가 연결되었습니다.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '키 저장에 실패했습니다.');
    } finally {
      setSavingKey(false);
    }
  }

  async function removeGeminiKey() {
    try {
      await api.deleteGeminiKey();
      await refreshStatus();
      showToast('info', 'Gemini API 키 연결을 해제했습니다.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '해제에 실패했습니다.');
    }
  }

  function setPeriodCount(count: number) {
    const n = Math.max(1, Math.min(10, count));
    setSettings((prev) => {
      const times = [...prev.periodTimes];
      const defaults = defaultSettings().periodTimes;
      while (times.length < n) {
        const last = times[times.length - 1];
        times.push(
          defaults[times.length] ?? {
            start: last ? last.end : '09:00',
            end: last ? last.end : '09:50',
          },
        );
      }
      return { ...prev, periodCount: n, periodTimes: times };
    });
  }

  function resetData() {
    if (!window.confirm('시간표·메모·To-Do·설정 등 앱에 저장된 모든 데이터를 초기화할까요?\n(구글 캘린더의 일정은 삭제되지 않습니다)')) return;
    update({ ...defaultAppData() });
    clearAppData();
    showToast('info', '앱 데이터가 초기화되었습니다. 새로고침합니다.');
    setTimeout(() => window.location.reload(), 1200);
  }

  const rowCls = 'flex items-center justify-between gap-4 py-4';
  const labelCls = 'text-sm font-medium text-slate-700';
  const descCls = 'mt-0.5 text-xs text-slate-400';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-800">
          <SettingsIcon size={18} className="text-mint-500" />
          환경 설정
        </h2>

        <div className="divide-y divide-slate-100">
          <div className={rowCls}>
            <div>
              <p className={labelCls}>교시 수</p>
              <p className={descCls}>하루 일과의 교시 수 (1~10).</p>
            </div>
            <input
              type="number"
              min={1}
              max={10}
              value={settings.periodCount}
              onChange={(e) => setPeriodCount(Number(e.target.value) || 1)}
              className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm outline-none focus:border-mint-400"
            />
          </div>

          <div className={rowCls}>
            <div>
              <p className={labelCls}>일과 시간</p>
              <p className={descCls}>교시별 시작~종료 시각을 정합니다.</p>
            </div>
            <button
              onClick={() => setEditingPeriodTimes(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-mint-300 hover:bg-mint-50"
            >
              <Clock size={14} className="text-slate-400" />
              시간 편집
            </button>
          </div>

          <div className={rowCls}>
            <div>
              <p className={labelCls}>주 시작 요일</p>
              <p className={descCls}>캘린더의 첫 번째 열에 표시할 요일입니다.</p>
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {([0, 1] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setSettings((prev) => ({ ...prev, weekStartsOn: d }))}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                    settings.weekStartsOn === d
                      ? 'bg-white text-mint-700 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {d === 0 ? '일요일' : '월요일'}
                </button>
              ))}
            </div>
          </div>

          <div className={rowCls}>
            <div>
              <p className={labelCls}>일정 알림</p>
              <p className={descCls}>
                시간이 지정된 일정 시작 전에 브라우저 알림을 띄웁니다. 처음 사용 시 알림 권한을 허용해야 합니다.
              </p>
            </div>
            <select
              value={settings.reminderMinutes}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, reminderMinutes: Number(e.target.value) }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mint-400"
            >
              <option value={0}>끔</option>
              <option value={5}>5분 전</option>
              <option value={10}>10분 전</option>
              <option value={15}>15분 전</option>
              <option value={30}>30분 전</option>
            </select>
          </div>

          <div className={rowCls}>
            <div>
              <p className={labelCls}>긴급 기준</p>
              <p className={descCls}>
                마감이 며칠 안쪽으로 들어오면 우선순위 매트릭스에서 '긴급함'으로 볼지 정합니다.
                마감일이 지난 할 일은 항상 긴급으로 표시됩니다.
              </p>
            </div>
            <select
              value={settings.urgentDays}
              onChange={(e) => setSettings((prev) => ({ ...prev, urgentDays: Number(e.target.value) }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mint-400"
            >
              <option value={1}>당일</option>
              <option value={2}>2일 전</option>
              <option value={3}>3일 전</option>
              <option value={5}>5일 전</option>
              <option value={7}>7일 전</option>
            </select>
          </div>

          <SchoolPicker />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-2 text-base font-bold text-slate-800">구글 캘린더 연동</h3>

        <div className="divide-y divide-slate-100">
          <div className={rowCls}>
            <div>
              <p className={labelCls}>연동 상태</p>
              <p className={descCls}>
                {!status
                  ? '서버에 연결할 수 없습니다.'
                  : !status.googleConfigured
                    ? '.env에 구글 OAuth 키가 설정되지 않았습니다. README를 참고하세요.'
                    : status.connected
                      ? `${status.email ?? '알 수 없는 계정'}으로 연동되어 있습니다.`
                      : '연동되어 있지 않습니다.'}
              </p>
            </div>
            {status?.connected ? (
              <button
                onClick={() => void disconnectGoogle()}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
              >
                <Unplug size={14} /> 연동 해제
              </button>
            ) : (
              <button
                onClick={() => void connectGoogle()}
                disabled={!status?.googleConfigured}
                className="shrink-0 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
              >
                구글 계정 연동
              </button>
            )}
          </div>

          <div className={rowCls}>
            <div>
              <p className={labelCls}>사용할 캘린더</p>
              <p className={descCls}>앱에서 만든 일정이 등록될 구글 캘린더입니다.</p>
            </div>
            <select
              value={settings.calendarId}
              onChange={(e) => setSettings((prev) => ({ ...prev, calendarId: e.target.value }))}
              disabled={!status?.connected}
              className="max-w-52 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mint-400 disabled:opacity-40"
            >
              <option value="primary">기본 캘린더</option>
              {calendars
                .filter((c) => !c.primary)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={labelCls}>Gemini API 키</p>
                <p className={descCls}>
                  {status?.geminiUserKey
                    ? '본인 Gemini API 키를 사용 중입니다. (쪽지 분석이 개인 할당량으로 처리됩니다)'
                    : status?.geminiConfigured
                      ? '서버 기본 키를 사용 중입니다. 본인 키를 연결하면 개인 할당량으로 사용합니다.'
                      : '키가 없습니다. 본인 Gemini API 키를 연결해야 쪽지 분석 기능을 쓸 수 있습니다.'}
                </p>
              </div>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  status?.geminiConfigured ? 'bg-mint-500' : 'bg-slate-300'
                }`}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder={status?.geminiUserKey ? '새 키로 교체하려면 입력' : 'AI Studio에서 발급한 Gemini API 키'}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-mint-400"
              />
              <button
                onClick={() => void saveGeminiKey()}
                disabled={savingKey || !geminiKeyInput.trim()}
                className="shrink-0 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-mint-600 disabled:opacity-40"
              >
                {savingKey ? '저장 중…' : '연결'}
              </button>
              {status?.geminiUserKey && (
                <button
                  onClick={() => void removeGeminiKey()}
                  className="shrink-0 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
                >
                  연결 해제
                </button>
              )}
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-mint-600 underline-offset-2 hover:underline"
            >
              Gemini API 키 발급받기 (Google AI Studio) →
            </a>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              API 키는 이 플래너가 여러분 대신 구글 AI(Gemini)를 사용할 수 있게 해주는 비밀번호 같은
              문자열입니다. 위 링크를 눌러 구글 계정으로 로그인한 뒤 &lsquo;Create API key&rsquo;
              버튼을 누르면 바로 발급되며, 그 값을 복사해서 위 입력창에 붙여넣고 &lsquo;연결&rsquo;을
              누르면 됩니다. 무료 할당량 안에서는 비용이 들지 않고, 다른 사람에게 공유하지 않도록
              주의해 주세요.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-2 text-base font-bold text-slate-800">바탕화면 위젯</h3>
        <div className={rowCls}>
          <div>
            <p className={labelCls}>오늘의 시간표 위젯 (설치형 프로그램)</p>
            <p className={descCls}>
              오늘의 시간표를 바탕화면에 계속 띄워주는 별도 Windows 프로그램이에요. 브라우저를
              닫아도 계속 켜져 있고, 창 안 톱니바퀴 아이콘으로 배경 진하기를 조절할 수 있어요.
              다운로드한 설치 파일을 실행하면 &ldquo;Windows에서 PC를 보호했습니다&rdquo;라는
              경고가 뜰 수 있는데, &ldquo;추가 정보 → 실행&rdquo;을 누르면 넘어가요(직접 만든
              프로그램이라 문제없어요 — 유료 인증서가 없어서 뜨는 안내일 뿐이에요).
            </p>
          </div>
          <a
            href={NATIVE_WIDGET_DOWNLOAD_URL}
            className="shrink-0 rounded-xl bg-mint-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-mint-600"
          >
            설치 파일 다운로드
          </a>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h3 className="mb-2 text-base font-bold text-slate-800">데이터</h3>
        <div className="divide-y divide-slate-100">
          <div className={rowCls}>
            <div>
              <p className={labelCls}>데이터 초기화</p>
              <p className={descCls}>
                브라우저에 저장된 To-Do·시간표·메모·설정을 모두 삭제합니다. 구글 캘린더는 영향받지 않습니다.
              </p>
            </div>
            <button
              onClick={resetData}
              className="shrink-0 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-50"
            >
              초기화
            </button>
          </div>

          {status?.authenticated && (
            <div className={rowCls}>
              <div>
                <p className={labelCls}>앱 로그아웃</p>
                <p className={descCls}>이 기기에서 로그아웃합니다. 다시 사용하려면 구글 계정으로 로그인해야 합니다.</p>
              </div>
              <button
                onClick={() => void appLogout()}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <LogOut size={14} /> 로그아웃
              </button>
            </div>
          )}
        </div>
      </section>

      {editingPeriodTimes && <PeriodTimesModal onClose={() => setEditingPeriodTimes(false)} />}
    </div>
  );
}
