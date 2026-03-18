import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../src/stores/auth";

const STORAGE_KEY = "mycarium-session";

const mockResponse = {
  token: "test-token-123",
  client_cert: "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----",
  client_key: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
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

describe("auth store", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      session: null,
      isAuthenticated: false,
      error: null,
      loading: false,
    });
    vi.restoreAllMocks();
  });

  it("starts unauthenticated", () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("login saves session to localStorage", async () => {
    mockFetchOk(mockResponse);

    await useAuthStore.getState().login("test@example.com", "password123");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.session?.token).toBe("test-token-123");
    expect(state.error).toBeNull();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.token).toBe("test-token-123");
    expect(stored.clientCert).toContain("CERTIFICATE");
  });

  it("register saves session to localStorage", async () => {
    mockFetchOk(mockResponse, 201);

    await useAuthStore.getState().register("test@example.com", "password123");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.session?.token).toBe("test-token-123");
  });

  it("login sets error on failure", async () => {
    mockFetchError(401, "Invalid email or password");

    await useAuthStore.getState().login("bad@example.com", "wrong");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe("Invalid email or password");
  });

  it("logout clears session and localStorage", async () => {
    mockFetchOk(mockResponse);
    await useAuthStore.getState().login("test@example.com", "password123");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clearError resets error state", async () => {
    mockFetchError(401, "Invalid");
    await useAuthStore.getState().login("x@x.com", "wrong");
    expect(useAuthStore.getState().error).toBeTruthy();

    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
