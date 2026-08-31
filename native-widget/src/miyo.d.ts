import type { WidgetData } from './types';

export interface AuthState {
  loggedIn: boolean;
}

export interface LoginResult {
  ok: boolean;
  user?: { email: string | null; name: string | null };
  error?: string;
}

export interface AppDataResult {
  ok: boolean;
  offline: boolean;
  data: WidgetData | null;
  /** 세션이 만료돼(401) 다시 로그인해야 하는 경우 true. */
  needsLogin?: boolean;
  error?: string;
}

declare global {
  interface Window {
    miyo: {
      getAuthState: () => Promise<AuthState>;
      login: () => Promise<LoginResult>;
      logout: () => Promise<{ ok: boolean }>;
      getAppData: () => Promise<AppDataResult>;
      hideWidget: () => Promise<void>;
      setMinimized: (minimized: boolean) => Promise<void>;
      getWidgetPrefs: () => Promise<{ opacity: number; minimized: boolean }>;
      setOpacity: (value: number) => Promise<void>;
      onAppDataUpdated: (callback: (result: AppDataResult) => void) => () => void;
      onAuthChanged: (callback: (state: AuthState) => void) => () => void;
    };
  }
}

export {};
