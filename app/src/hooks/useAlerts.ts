import { useMqttStore } from "../stores/mqtt";
import { useLiveness } from "./useLiveness";

export interface Alert {
  type: "offline";
  message: string;
}

export function useAlerts(deviceId: string): Alert[] {
  const status = useMqttStore((s) => s.statuses[deviceId]);
  const liveness = useLiveness(deviceId);

  const alerts: Alert[] = [];

  if (liveness === "offline" && status) {
    alerts.push({ type: "offline", message: "No status update received in the last 60 seconds" });
  }

  return alerts;
}
