import type { ReadingRow } from "../types";

export interface RangeStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  inRangePct: number;
  belowRangePct: number;
  aboveRangePct: number;
}

export interface ActuatorStats {
  dutyCyclePct: number;
  cycleCount: number;
  meanOnTimeSec: number | null;
  meanOffTimeSec: number | null;
  meanCycleSec: number | null;
}

export interface ChartStats {
  temp: RangeStats;
  humidity: RangeStats;
  heater: ActuatorStats;
  fogger: ActuatorStats;
  dataPoints: number;
  timeSpanSec: number;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function computeRangeStats(
  values: number[],
  min: number,
  max: number,
): RangeStats {
  if (values.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, inRangePct: 0, belowRangePct: 0, aboveRangePct: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  let inRange = 0;
  let below = 0;
  let above = 0;

  for (const v of values) {
    if (v < min) below++;
    else if (v > max) above++;
    else inRange++;
  }

  const n = values.length;
  return {
    mean: sum / n,
    median: median(sorted),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    inRangePct: (inRange / n) * 100,
    belowRangePct: (below / n) * 100,
    aboveRangePct: (above / n) * 100,
  };
}

interface CyclePeriod {
  startTs: number;
  endTs: number;
}

function computeActuatorStats(
  readings: ReadingRow[],
  field: "heaterOn" | "foggerOn",
): ActuatorStats {
  if (readings.length === 0) {
    return { dutyCyclePct: 0, cycleCount: 0, meanOnTimeSec: null, meanOffTimeSec: null, meanCycleSec: null };
  }

  const onCount = readings.filter((r) => r[field]).length;
  const dutyCyclePct = (onCount / readings.length) * 100;

  // Find complete ON periods (off-to-on ... on-to-off)
  const onPeriods: CyclePeriod[] = [];
  const offPeriods: CyclePeriod[] = [];
  let onStart: number | null = null;
  let offStart: number | null = null;

  for (let i = 0; i < readings.length; i++) {
    const isOn = readings[i]![field];
    const wasOn = i > 0 ? readings[i - 1]![field] : null;

    if (isOn && !wasOn && wasOn !== null) {
      // OFF -> ON transition
      onStart = readings[i]!.ts;
      if (offStart !== null) {
        offPeriods.push({ startTs: offStart, endTs: readings[i]!.ts });
        offStart = null;
      }
    } else if (!isOn && wasOn) {
      // ON -> OFF transition
      if (onStart !== null) {
        onPeriods.push({ startTs: onStart, endTs: readings[i]!.ts });
        onStart = null;
      }
      offStart = readings[i]!.ts;
    }
  }

  const cycleCount = onPeriods.length;

  const meanOnTimeSec = onPeriods.length > 0
    ? onPeriods.reduce((s, p) => s + (p.endTs - p.startTs), 0) / onPeriods.length
    : null;

  const meanOffTimeSec = offPeriods.length > 0
    ? offPeriods.reduce((s, p) => s + (p.endTs - p.startTs), 0) / offPeriods.length
    : null;

  const meanCycleSec =
    meanOnTimeSec !== null && meanOffTimeSec !== null
      ? meanOnTimeSec + meanOffTimeSec
      : null;

  return { dutyCyclePct, cycleCount, meanOnTimeSec, meanOffTimeSec, meanCycleSec };
}

export function computeStats(
  readings: ReadingRow[],
  thresholds: { tempMin: number; tempMax: number; humMin: number; humMax: number },
): ChartStats {
  const temps = readings.map((r) => r.tempC);
  const hums = readings.map((r) => r.humidity);

  const timeSpanSec =
    readings.length >= 2
      ? readings[readings.length - 1]!.ts - readings[0]!.ts
      : 0;

  return {
    temp: computeRangeStats(temps, thresholds.tempMin, thresholds.tempMax),
    humidity: computeRangeStats(hums, thresholds.humMin, thresholds.humMax),
    heater: computeActuatorStats(readings, "heaterOn"),
    fogger: computeActuatorStats(readings, "foggerOn"),
    dataPoints: readings.length,
    timeSpanSec,
  };
}
