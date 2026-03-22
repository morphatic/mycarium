import { useMemo, useState } from "react";
import { computeStats, type ChartStats } from "../utils/computeStats";
import { useTempUnitStore, toFahrenheit } from "../stores/tempUnit";
import type { ReadingRow } from "../types";

interface StatsPanelProps {
  readings: ReadingRow[];
  tempMin: number;
  tempMax: number;
  humMin: number;
  humMax: number;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "\u2014";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mRem = m % 60;
  return mRem > 0 ? `${h}h ${mRem}m` : `${h}h`;
}

function formatTemp(celsius: number, unit: "C" | "F"): string {
  const v = unit === "F" ? toFahrenheit(celsius) : celsius;
  return `${v.toFixed(1)}\u00B0${unit}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-myc-muted dark:text-myc-muted-dark">{label}</span>
      <span className="text-sm font-medium text-myc-text dark:text-myc-text-dark">{value}</span>
      {sub && (
        <span className="text-xs text-myc-muted dark:text-myc-muted-dark">{sub}</span>
      )}
    </div>
  );
}

function RangeBar({ below, inRange, above }: { below: number; inRange: number; above: number }) {
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
      {below > 0 && (
        <div
          className="bg-blue-400 dark:bg-blue-500"
          style={{ width: `${below}%` }}
          title={`Below: ${below.toFixed(1)}%`}
        />
      )}
      {inRange > 0 && (
        <div
          className="bg-green-400 dark:bg-green-500"
          style={{ width: `${inRange}%` }}
          title={`In range: ${inRange.toFixed(1)}%`}
        />
      )}
      {above > 0 && (
        <div
          className="bg-orange-400 dark:bg-orange-500"
          style={{ width: `${above}%` }}
          title={`Above: ${above.toFixed(1)}%`}
        />
      )}
    </div>
  );
}

export function StatsPanel({ readings, tempMin, tempMax, humMin, humMax }: StatsPanelProps) {
  const unit = useTempUnitStore((s) => s.unit);
  const [open, setOpen] = useState(true);

  const stats: ChartStats | null = useMemo(() => {
    if (readings.length < 2) return null;
    return computeStats(readings, { tempMin, tempMax, humMin, humMax });
  }, [readings, tempMin, tempMax, humMin, humMax]);

  if (!stats) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left min-h-[44px]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`transition-transform text-myc-muted dark:text-myc-muted-dark ${open ? "rotate-90" : ""}`}
        >
          <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <h3 className="font-medium text-myc-text dark:text-myc-text-dark text-sm">
          Statistics
        </h3>
        <span className="text-xs text-myc-muted dark:text-myc-muted-dark">
          {formatDuration(stats.timeSpanSec)} window &middot; {stats.dataPoints} readings
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {/* Temperature section */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-[#945a3a]">
              Temperature
            </h4>
            <RangeBar
              below={stats.temp.belowRangePct}
              inRange={stats.temp.inRangePct}
              above={stats.temp.aboveRangePct}
            />
            <div className="flex gap-2 text-xs text-myc-muted dark:text-myc-muted-dark">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500" />
                Below {stats.temp.belowRangePct.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500" />
                In {stats.temp.inRangePct.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 dark:bg-orange-500" />
                Above {stats.temp.aboveRangePct.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Mean" value={formatTemp(stats.temp.mean, unit)} />
              <Stat label="Median" value={formatTemp(stats.temp.median, unit)} />
              <Stat label="Min" value={formatTemp(stats.temp.min, unit)} />
              <Stat label="Max" value={formatTemp(stats.temp.max, unit)} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
              <Stat label="Heater duty" value={`${stats.heater.dutyCyclePct.toFixed(1)}%`} />
              <Stat label="Cycles" value={`${stats.heater.cycleCount}`} />
              <Stat label="Mean on" value={formatDuration(stats.heater.meanOnTimeSec)} />
              <Stat label="Mean off" value={formatDuration(stats.heater.meanOffTimeSec)} />
              <Stat label="Mean cycle" value={formatDuration(stats.heater.meanCycleSec)} />
            </div>
          </div>

          {/* Humidity section */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-myc-teal">
              Humidity
            </h4>
            <RangeBar
              below={stats.humidity.belowRangePct}
              inRange={stats.humidity.inRangePct}
              above={stats.humidity.aboveRangePct}
            />
            <div className="flex gap-2 text-xs text-myc-muted dark:text-myc-muted-dark">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500" />
                Below {stats.humidity.belowRangePct.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500" />
                In {stats.humidity.inRangePct.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-400 dark:bg-orange-500" />
                Above {stats.humidity.aboveRangePct.toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Mean" value={`${stats.humidity.mean.toFixed(1)}%`} />
              <Stat label="Median" value={`${stats.humidity.median.toFixed(1)}%`} />
              <Stat label="Min" value={`${stats.humidity.min.toFixed(1)}%`} />
              <Stat label="Max" value={`${stats.humidity.max.toFixed(1)}%`} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
              <Stat label="Fogger duty" value={`${stats.fogger.dutyCyclePct.toFixed(1)}%`} />
              <Stat label="Cycles" value={`${stats.fogger.cycleCount}`} />
              <Stat label="Mean on" value={formatDuration(stats.fogger.meanOnTimeSec)} />
              <Stat label="Mean off" value={formatDuration(stats.fogger.meanOffTimeSec)} />
              <Stat label="Mean cycle" value={formatDuration(stats.fogger.meanCycleSec)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
