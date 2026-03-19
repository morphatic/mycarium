import { create } from "zustand";

type Theme = "light" | "dark";

const STORAGE_KEY = "mycarium-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // ignore
  }
  return getSystemTheme();
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = loadTheme();
  // Apply on load
  if (typeof document !== "undefined") applyTheme(initial);

  return {
    theme: initial,
    toggle: () => {
      const next = get().theme === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
      set({ theme: next });
    },
  };
});
