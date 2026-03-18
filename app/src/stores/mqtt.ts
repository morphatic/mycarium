import { create } from "zustand";
import {
  connectMqtt,
  disconnectMqtt,
  subscribe,
  unsubscribe,
} from "../mqtt";
import type { StatusMessage } from "../types";

interface MqttState {
  connected: boolean;
  statuses: Record<string, StatusMessage>;
  lastSeen: Record<string, number>;
  connect: (host: string, token: string) => void;
  disconnect: () => void;
  subscribeDevice: (deviceId: string) => void;
  unsubscribeDevice: (deviceId: string) => void;
}

export const useMqttStore = create<MqttState>((set, get) => ({
  connected: false,
  statuses: {},
  lastSeen: {},

  connect: (host, token) => {
    connectMqtt({
      host,
      token,
      onConnect: () => set({ connected: true }),
      onDisconnect: () => set({ connected: false }),
      onMessage: (topic, payload) => {
        const match = topic.match(/^mycarium\/status\/(.+)$/);
        if (!match) return;
        const deviceId = match[1]!;
        try {
          const status = JSON.parse(payload) as StatusMessage;
          const now = Date.now();
          set({
            statuses: { ...get().statuses, [deviceId]: status },
            lastSeen: { ...get().lastSeen, [deviceId]: now },
          });
        } catch {
          // ignore unparseable messages
        }
      },
    });
  },

  disconnect: () => {
    disconnectMqtt();
    set({ connected: false });
  },

  subscribeDevice: (deviceId) => {
    subscribe(`mycarium/status/${deviceId}`);
  },

  unsubscribeDevice: (deviceId) => {
    unsubscribe(`mycarium/status/${deviceId}`);
  },
}));
