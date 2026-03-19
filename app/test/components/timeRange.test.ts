import { describe, it, expect } from "vitest";
import { timeRangeToSeconds } from "../../src/components/TimeRangeSelector";

describe("timeRangeToSeconds", () => {
  it("returns 3600 for 1h", () => {
    expect(timeRangeToSeconds("1h")).toBe(3600);
  });

  it("returns 10800 for 3h", () => {
    expect(timeRangeToSeconds("3h")).toBe(10800);
  });

  it("returns 21600 for 6h", () => {
    expect(timeRangeToSeconds("6h")).toBe(21600);
  });

  it("returns 43200 for 12h", () => {
    expect(timeRangeToSeconds("12h")).toBe(43200);
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
