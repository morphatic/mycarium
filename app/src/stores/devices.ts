import { create } from "zustand";
import { api } from "../api";
import type { Device } from "../types";

interface DevicesState {
  devices: Device[];
  loading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  claimDevice: (deviceId: string) => Promise<void>;
  renameDevice: (id: number, name: string) => Promise<void>;
  removeDevice: (id: number) => Promise<void>;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: [],
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const devices = await api<Device[]>("/devices");
      set({ devices, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  claimDevice: async (deviceId: string) => {
    set({ error: null });
    try {
      const device = await api<Device>("/devices", {
        method: "POST",
        body: JSON.stringify({ device_id: deviceId }),
      });
      set({ devices: [...get().devices, device] });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  renameDevice: async (id: number, name: string) => {
    set({ error: null });
    try {
      const updated = await api<Device>(`/devices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      set({
        devices: get().devices.map((d) => (d.id === id ? updated : d)),
      });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  removeDevice: async (id: number) => {
    set({ error: null });
    try {
      await api(`/devices/${id}`, { method: "DELETE" });
      set({ devices: get().devices.filter((d) => d.id !== id) });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },
}));
