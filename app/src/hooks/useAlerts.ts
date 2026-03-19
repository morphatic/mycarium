import { useMqttStore } from "../stores/mqtt";
import { useLiveness } from "./useLiveness";
import type { StatusMessage } from "../types";

export interface Alert {
  type: "offline" | "temp" | "humidity";
  message: string;
}

function checkSensorAlerts(status: StatusMessage): Alert[] {
  const alerts: Alert[] = [];

  if (status.temp_c < status.temp_min || status.temp_c > status.temp_max) {
    alerts.push({
      type: "temp",
      message: `Temperature ${status.temp_c.toFixed(1)}°C is out of range (${status.temp_min}–${status.temp_max}°C)`,
    });
  }

  if (status.humidity < status.hum_min || status.humidity > status.hum_max) {
    alerts.push({
      type: "humidity",
      message: `Humidity ${status.humidity.toFixed(1)}% is out of range (${status.hum_min}–${status.hum_max}%)`,
    });
  }

  return alerts;
}

export function useAlerts(deviceId: string): Alert[] {
  const status = useMqttStore((s) => s.statuses[deviceId]);
  const liveness = useLiveness(deviceId);

  const alerts: Alert[] = [];

  if (liveness === "offline" && status) {
    alerts.push({ type: "offline", message: "No status update received in the last 60 seconds" });
  }

  if (status) {
    alerts.push(...checkSensorAlerts(status));
  }

  return alerts;
}
