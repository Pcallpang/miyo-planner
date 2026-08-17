// 설치 가능성(installability) 조건 충족용 최소 서비스 워커.
// 오프라인 캐싱은 하지 않고 모든 요청을 네트워크로 그대로 통과시킨다 —
// 이 앱은 서버 데이터에 강하게 의존하므로 자체 캐싱은 오히려 데이터 불일치를 만든다.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
