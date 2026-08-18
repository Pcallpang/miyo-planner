import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 렌더링 중 처리되지 않은 예외로 앱이 하얀 화면이 되는 걸 막는다.
 * 대신 에러 메시지를 화면에 그대로 보여줘서, 기기에서 바로 원인을 캡쳐할 수 있게 한다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen bg-rose-50 p-6 text-slate-800">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-rose-200">
          <h1 className="mb-2 text-lg font-bold text-rose-600">화면 렌더링 중 오류가 발생했습니다</h1>
          <p className="mb-3 text-sm text-slate-500">
            아래 내용을 캡쳐해서 알려주시면 원인을 확인할 수 있어요.
          </p>
          <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 text-xs whitespace-pre-wrap text-slate-100">
            {error.name}: {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-mint-500 px-4 py-2 text-sm font-semibold text-white"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }
}
