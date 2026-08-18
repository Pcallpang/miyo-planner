/**
 * 브라우저 알림을 띄운다.
 *
 * 서비스워커가 페이지를 컨트롤 중이면 `new Notification()`은 안드로이드 Chrome에서
 * "Illegal constructor" TypeError를 던진다 (ServiceWorkerRegistration.showNotification을
 * 쓰라는 제약). 이 예외가 useEffect 안에서 처리되지 않으면 앱 전체가 하얀 화면으로 죽는다.
 * 그래서 서비스워커 등록이 있으면 그쪽 API를 쓰고, 없으면 기존 방식으로 폴백한다.
 */
export async function notify(title: string, options?: NotificationOptions): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    // 알림 실패로 앱이 죽으면 안 되므로 조용히 무시한다.
  }
}
