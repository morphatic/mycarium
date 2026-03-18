import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMqttStore } from "../src/stores/mqtt";

// Mock the mqtt module
vi.mock("../src/mqtt", () => {
  let messageHandler: ((topic: string, payload: string) => void) | null = null;
  let connectHandler: (() => void) | null = null;

  return {
    connectMqtt: vi.fn((opts) => {
      messageHandler = opts.onMessage;
      connectHandler = opts.onConnect;
      // Simulate immediate connection
      connectHandler?.();
      return {};
    }),
    disconnectMqtt: vi.fn(() => {
      messageHandler = null;
      connectHandler = null;
    }),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    publish: vi.fn(),
    // Test helpers
    __simulateMessage: (topic: string, payload: string) => {
      messageHandler?.(topic, payload);
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mqttMock = await vi.importMock<any>("../src/mqtt");

describe("mqtt store", () => {
  beforeEach(() => {
    useMqttStore.setState({
      connected: false,
      statuses: {},
      lastSeen: {},
    });
    vi.clearAllMocks();
  });

  it("connects and sets connected state", () => {
    useMqttStore.getState().connect("localhost", "token");

    expect(useMqttStore.getState().connected).toBe(true);
    expect(mqttMock.connectMqtt).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "localhost",
        token: "token",
      }),
    );
  });

  it("processes status messages", () => {
    useMqttStore.getState().connect("localhost", "token");

    const statusPayload = JSON.stringify({
      ts: 1710720000,
      temp_c: 24.5,
      humidity: 85,
      heater_on: false,
      fogger_on: true,
    });

    mqttMock.__simulateMessage("mycarium/status/mycarium-1", statusPayload);

    const { statuses, lastSeen } = useMqttStore.getState();
    expect(statuses["mycarium-1"]?.temp_c).toBe(24.5);
    expect(statuses["mycarium-1"]?.fogger_on).toBe(true);
    expect(lastSeen["mycarium-1"]).toBeGreaterThan(0);
  });

  it("ignores non-status topics", () => {
    useMqttStore.getState().connect("localhost", "token");

    mqttMock.__simulateMessage(
      "mycarium/control/mycarium-1",
      JSON.stringify({ heater_mode: "auto" }),
    );

    expect(useMqttStore.getState().statuses).toEqual({});
  });

  it("ignores invalid JSON", () => {
    useMqttStore.getState().connect("localhost", "token");

    mqttMock.__simulateMessage("mycarium/status/mycarium-1", "not json");

    expect(useMqttStore.getState().statuses).toEqual({});
  });

  it("subscribes to device topics", () => {
    useMqttStore.getState().subscribeDevice("mycarium-1");

    expect(mqttMock.subscribe).toHaveBeenCalledWith(
      "mycarium/status/mycarium-1",
    );
  });

  it("disconnect resets connected state", () => {
    useMqttStore.getState().connect("localhost", "token");
    expect(useMqttStore.getState().connected).toBe(true);

    useMqttStore.getState().disconnect();
    expect(useMqttStore.getState().connected).toBe(false);
  });
});
