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
  error?: string;
}

declare global {
  interface Window {
    miyo: {
      getAuthState: () => Promise<AuthState>;
      login: () => Promise<LoginResult>;
      logout: () => Promise<{ ok: boolean }>;
      getAppData: () => Promise<AppDataResult>;
      onAppDataUpdated: (callback: (result: AppDataResult) => void) => () => void;
    };
  }
}

export {};
