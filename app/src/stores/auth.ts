import { create } from "zustand";
import { api, ApiError } from "../api";
import type { Session } from "../types";

const STORAGE_KEY = "mycarium-session";

interface AuthState {
  session: Session | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface AuthResponse {
  token: string;
  client_cert: string;
  client_key: string;
}

function toSession(res: AuthResponse): Session {
  return {
    token: res.token,
    clientCert: res.client_cert,
    clientKey: res.client_key,
  };
}

export const useAuthStore = create<AuthState>((set) => {
  const initial = loadSession();
  return {
    session: initial,
    isAuthenticated: initial !== null,
    error: null,
    loading: false,

    login: async (email, password) => {
      set({ loading: true, error: null });
      try {
        const res = await api<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const session = toSession(res);
        saveSession(session);
        set({ session, isAuthenticated: true, loading: false });
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
        const session = toSession(res);
        saveSession(session);
        set({ session, isAuthenticated: true, loading: false });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Registration failed";
        set({ error: message, loading: false });
      }
    },

    logout: () => {
      clearSession();
      set({ session: null, isAuthenticated: false, error: null });
    },

    clearError: () => set({ error: null }),
  };
});
