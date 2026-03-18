import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DeviceCard } from "../../src/components/DeviceCard";
import type { Device } from "../../src/types";

const baseDevice: Device = {
  id: 1,
  deviceId: "mycarium-1",
  userId: "user-123",
  name: null,
  status: "pending",
  createdAt: "2026-03-18T00:00:00Z",
};

describe("DeviceCard", () => {
  afterEach(cleanup);

  it("shows device ID when no name is set", () => {
    render(
      <MemoryRouter>
        <DeviceCard device={baseDevice} />
      </MemoryRouter>,
    );

    expect(screen.getByText("mycarium-1")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("shows name and device ID when name is set", () => {
    const named = { ...baseDevice, name: "Basement Grow", status: "active" as const };
    render(
      <MemoryRouter>
        <DeviceCard device={named} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Basement Grow")).toBeInTheDocument();
    expect(screen.getByText("mycarium-1")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("links to device detail page", () => {
    render(
      <MemoryRouter>
        <DeviceCard device={baseDevice} />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/device/1");
  });
});
