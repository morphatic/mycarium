import { useMqttStore } from "../stores/mqtt";
import { useLiveness } from "./useLiveness";
import type { StatusMessage } from "../types";

export interface Alert {
  type: "offline" | "temp" | "humidity";
  message: string;
}

function checkSensorAlerts(status: StatusMessage): Alert[] {
  const alerts: Alert[] = [];

  if (
    status.temp_min_c !== undefined &&
    status.temp_max_c !== undefined
  ) {
    if (status.temp_c < status.temp_min_c || status.temp_c > status.temp_max_c) {
      alerts.push({
        type: "temp",
        message: `Temperature ${status.temp_c.toFixed(1)}°C is out of range (${status.temp_min_c}–${status.temp_max_c}°C)`,
      });
    }
  }

  if (
    status.humidity_min !== undefined &&
    status.humidity_max !== undefined
  ) {
    if (status.humidity < status.humidity_min || status.humidity > status.humidity_max) {
      alerts.push({
        type: "humidity",
        message: `Humidity ${status.humidity.toFixed(1)}% is out of range (${status.humidity_min}–${status.humidity_max}%)`,
      });
    }
  }

  return alerts;
}

export function useAlerts(deviceId: string): Alert[] {
  const status = useMqttStore((s) => s.statuses[deviceId]);
  const liveness = useLiveness(deviceId);

  const alerts: Alert[] = [];

  if (liveness === "offline") {
    alerts.push({ type: "offline", message: "Device not responding" });
  }

  if (status) {
    alerts.push(...checkSensorAlerts(status));
  }

  return alerts;
}
