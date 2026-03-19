import { create } from "zustand";
import { api, ApiError } from "../api";

const STORAGE_KEY = "mycarium-session";

interface StoredSession {
  token: string;
}

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token }));
}

function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface AuthResponse {
  token: string;
  client_cert: string;
  client_key: string;
}

export const useAuthStore = create<AuthState>((set) => {
  const token = loadToken();
  return {
    token,
    isAuthenticated: token !== null,
    error: null,
    loading: false,

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const res = await api<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        // Only store the token — client cert/key are not used by the browser
        saveToken(res.token);
        set({ token: res.token, isAuthenticated: true, loading: false });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Login failed";
        set({ error: message, loading: false });
      }
    },

    register: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const res = await api<AuthResponse>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        saveToken(res.token);
        set({ token: res.token, isAuthenticated: true, loading: false });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Registration failed";
        set({ error: message, loading: false });
      }
    },

    logout: () => {
      clearSession();
      set({ token: null, isAuthenticated: false, error: null });
    },

    clearError: () => set({ error: null }),
  };
});
