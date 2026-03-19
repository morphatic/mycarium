import { create } from "zustand";

export type TempUnit = "C" | "F";

const STORAGE_KEY = "mycarium-temp-unit";

interface TempUnitState {
  unit: TempUnit;
  toggle: () => void;
}

function loadUnit(): TempUnit {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "C" || stored === "F") return stored;
  } catch {
    // ignore
  }
  return "C";
}

export function toFahrenheit(c: number): number {
  return c * 9 / 5 + 32;
}

export const useTempUnitStore = create<TempUnitState>((set, get) => ({
  unit: loadUnit(),
  toggle: () => {
    const next = get().unit === "C" ? "F" : "C";
    localStorage.setItem(STORAGE_KEY, next);
    set({ unit: next });
  },
}));
