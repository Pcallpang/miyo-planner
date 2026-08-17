import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { DataProvider } from './context/DataContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </DataProvider>
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
