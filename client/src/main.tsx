import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProvider } from './context/AppContext';
import { DataProvider } from './context/DataContext';
import './index.css';

/**
 * React 렌더 트리 바깥(setInterval 콜백, 처리 안 된 Promise 거부 등)에서 던져진 예외는
 * ErrorBoundary가 못 잡는다. 그런 경우도 하얀 화면 대신 화면에 에러를 그대로 보여준다.
 */
function showFatalOverlay(title: string, detail: string) {
  if (document.getElementById('fatal-error-overlay')) return;
  const el = document.createElement('div');
  el.id = 'fatal-error-overlay';
  el.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#fff1f2;color:#1f2a28;padding:20px;overflow:auto;font-family:system-ui,sans-serif;';
  el.innerHTML = `
    <h1 style="font-size:16px;font-weight:700;color:#e11d48;margin-bottom:8px;">${title}</h1>
    <pre style="white-space:pre-wrap;font-size:12px;background:#0f172a;color:#e2e8f0;padding:12px;border-radius:12px;">${detail}</pre>
  `;
  document.body.appendChild(el);
}

window.addEventListener('error', (e) => {
  showFatalOverlay('처리되지 않은 오류', `${e.message}\n${e.error?.stack ?? ''}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  showFatalOverlay(
    '처리되지 않은 Promise 거부',
    reason instanceof Error ? `${reason.name}: ${reason.message}\n${reason.stack}` : String(reason),
  );
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <DataProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </DataProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// 홈 화면에 설치 가능하게 하는 최소 서비스 워커 등록 (오프라인 캐싱 없음)
// 로컬 개발 서버(HMR)에서는 등록하지 않는다 — vite dev의 /src 모듈 요청까지
// 서비스 워커가 가로채면 HMR이 불안정해질 수 있다.
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
