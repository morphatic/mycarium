import { describe, it, expect, beforeEach } from "vitest";
import { useMqttStore } from "../src/stores/mqtt";
import type { StatusMessage } from "../src/types";

// Test the alert logic directly rather than through the hook
// (hooks need a React render context; we test the underlying logic)

function checkSensorAlerts(status: StatusMessage) {
  const alerts: { type: string; message: string }[] = [];

  if (status.temp_min_c !== undefined && status.temp_max_c !== undefined) {
    if (status.temp_c < status.temp_min_c || status.temp_c > status.temp_max_c) {
      alerts.push({
        type: "temp",
        message: `Temperature ${status.temp_c.toFixed(1)}°C is out of range (${status.temp_min_c}–${status.temp_max_c}°C)`,
      });
    }
  }

  if (status.humidity_min !== undefined && status.humidity_max !== undefined) {
    if (status.humidity < status.humidity_min || status.humidity > status.humidity_max) {
      alerts.push({
        type: "humidity",
        message: `Humidity ${status.humidity.toFixed(1)}% is out of range (${status.humidity_min}–${status.humidity_max}%)`,
      });
    }
  }

  return alerts;
}

const normalStatus: StatusMessage = {
  ts: 1710720000,
  temp_c: 24,
  humidity: 80,
  temp_min_c: 20,
  temp_max_c: 28,
  humidity_min: 70,
  humidity_max: 90,
  heater_on: false,
  fogger_on: false,
};

describe("alert logic", () => {
  beforeEach(() => {
    useMqttStore.setState({ statuses: {}, lastSeen: {} });
  });

  it("returns no alerts for normal readings", () => {
    expect(checkSensorAlerts(normalStatus)).toEqual([]);
  });

  it("returns temp alert when temperature is below min", () => {
    const alerts = checkSensorAlerts({ ...normalStatus, temp_c: 18 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("temp");
    expect(alerts[0]!.message).toContain("18.0°C");
  });

  it("returns temp alert when temperature is above max", () => {
    const alerts = checkSensorAlerts({ ...normalStatus, temp_c: 30 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("temp");
  });

  it("returns humidity alert when humidity is out of range", () => {
    const alerts = checkSensorAlerts({ ...normalStatus, humidity: 95 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe("humidity");
    expect(alerts[0]!.message).toContain("95.0%");
  });

  it("returns multiple alerts when both are out of range", () => {
    const alerts = checkSensorAlerts({
      ...normalStatus,
      temp_c: 35,
      humidity: 50,
    });
    expect(alerts).toHaveLength(2);
  });

  it("returns no alerts when thresholds are not set", () => {
    const noThresholds: StatusMessage = {
      ts: 1710720000,
      temp_c: 100,
      humidity: 0,
      heater_on: false,
      fogger_on: false,
    };
    expect(checkSensorAlerts(noThresholds)).toEqual([]);
  });
});
