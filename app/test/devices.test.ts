import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDevicesStore } from "../src/stores/devices";
import type { Device } from "../src/types";

const mockDevice: Device = {
  id: 1,
  deviceId: "mycarium-1",
  userId: "user-123",
  name: null,
  status: "pending",
  createdAt: "2026-03-18T00:00:00Z",
};

function mockFetchOk(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

function mockFetchError(status: number, message: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText: "Error",
      json: () => Promise.resolve({ message }),
    }),
  );
}

describe("devices store", () => {
  beforeEach(() => {
    useDevicesStore.setState({
      devices: [],
      loading: false,
      error: null,
    });
    vi.restoreAllMocks();
  });

  it("fetchDevices populates device list", async () => {
    mockFetchOk([mockDevice]);

    await useDevicesStore.getState().fetchDevices();

    const state = useDevicesStore.getState();
    expect(state.devices).toHaveLength(1);
    expect(state.devices[0]!.deviceId).toBe("mycarium-1");
    expect(state.loading).toBe(false);
  });

  it("claimDevice adds device to list", async () => {
    mockFetchOk(mockDevice, 201);

    await useDevicesStore.getState().claimDevice("mycarium-1");

    expect(useDevicesStore.getState().devices).toHaveLength(1);
  });

  it("claimDevice sets error on conflict", async () => {
    mockFetchError(409, "Device already claimed");

    await expect(
      useDevicesStore.getState().claimDevice("mycarium-1"),
    ).rejects.toThrow();

    expect(useDevicesStore.getState().error).toBe("Device already claimed");
  });

  it("renameDevice updates device in list", async () => {
    useDevicesStore.setState({ devices: [mockDevice] });
    mockFetchOk({ ...mockDevice, name: "My Terrarium" });

    await useDevicesStore.getState().renameDevice(1, "My Terrarium");

    expect(useDevicesStore.getState().devices[0]!.name).toBe("My Terrarium");
  });

  it("removeDevice removes device from list", async () => {
    useDevicesStore.setState({ devices: [mockDevice] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(undefined),
      }),
    );

    await useDevicesStore.getState().removeDevice(1);

    expect(useDevicesStore.getState().devices).toHaveLength(0);
  });
});
