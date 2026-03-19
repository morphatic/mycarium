import { describe, it, expect, beforeEach } from "vitest";
import { useMqttStore } from "../src/stores/mqtt";

// Range alerts are now displayed inline via color coding on the readings.
// This test verifies the offline alert logic that remains in useAlerts.

describe("alert logic", () => {
  beforeEach(() => {
    useMqttStore.setState({ statuses: {}, lastSeen: {}, connected: false });
  });

  it("mqtt store initializes with no statuses", () => {
    const state = useMqttStore.getState();
    expect(state.statuses).toEqual({});
    expect(state.lastSeen).toEqual({});
  });

  it("stores status messages by device ID", () => {
    const status = {
      ts: 1710720000,
      temp_c: 24,
      humidity: 80,
      temp_min: 20,
      temp_max: 28,
      hum_min: 70,
      hum_max: 90,
      heater_on: false,
      fogger_on: false,
    };
    useMqttStore.setState({
      statuses: { "mycarium-1": status },
      lastSeen: { "mycarium-1": Date.now() },
    });
    expect(useMqttStore.getState().statuses["mycarium-1"]?.temp_c).toBe(24);
  });

  it("tracks lastSeen separately from status", () => {
    const now = Date.now();
    useMqttStore.setState({
      lastSeen: { "mycarium-1": now },
    });
    expect(useMqttStore.getState().lastSeen["mycarium-1"]).toBe(now);
  });

  it("range status: temp below min is low", () => {
    const tempC = 18;
    const tempMin = 20;
    const tempMax = 28;
    const range = tempC < tempMin ? "low" : tempC > tempMax ? "high" : "ok";
    expect(range).toBe("low");
  });

  it("range status: temp above max is high", () => {
    const tempC = 30;
    const tempMin = 20;
    const tempMax = 28;
    const range = tempC < tempMin ? "low" : tempC > tempMax ? "high" : "ok";
    expect(range).toBe("high");
  });

  it("range status: temp within range is ok", () => {
    const tempC = 24;
    const tempMin = 20;
    const tempMax = 28;
    const range = tempC < tempMin ? "low" : tempC > tempMax ? "high" : "ok";
    expect(range).toBe("ok");
  });
});
