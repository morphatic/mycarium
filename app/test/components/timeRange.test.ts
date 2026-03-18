import { describe, it, expect } from "vitest";
import { timeRangeToSeconds } from "../../src/components/TimeRangeSelector";

describe("timeRangeToSeconds", () => {
  it("returns 3600 for 1h", () => {
    expect(timeRangeToSeconds("1h")).toBe(3600);
  });

  it("returns 86400 for 24h", () => {
    expect(timeRangeToSeconds("24h")).toBe(86400);
  });

  it("returns 604800 for 7d", () => {
    expect(timeRangeToSeconds("7d")).toBe(604800);
  });

  it("returns 2592000 for 30d", () => {
    expect(timeRangeToSeconds("30d")).toBe(2592000);
  });
});
