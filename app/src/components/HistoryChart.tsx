import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { api } from "../api";
import {
  TimeRangeSelector,
  timeRangeToSeconds,
  type TimeRange,
} from "./TimeRangeSelector";
import { useThemeStore } from "../stores/theme";
import { useTempUnitStore, toFahrenheit } from "../stores/tempUnit";
import type { ReadingRow } from "../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

interface HistoryChartProps {
  deviceDbId: number;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Find indices where a boolean value changes */
function findTransitions(
  values: boolean[],
): { index: number; turnedOn: boolean }[] {
  const transitions: { index: number; turnedOn: boolean }[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1]) {
      transitions.push({ index: i, turnedOn: values[i]! });
    }
  }
  return transitions;
}

function buildChartData(
  readings: ReadingRow[],
  isDark: boolean,
  unit: "C" | "F",
): ChartData<"line", (number | null)[], string> {
  const labels = readings.map((r) => formatTime(r.ts));
  const tempData = readings.map((r) =>
    unit === "F" ? toFahrenheit(r.tempC) : r.tempC,
  );
  const humidityData = readings.map((r) => r.humidity);

  // Heater event markers on the temperature line
  const heaterTransitions = findTransitions(readings.map((r) => r.heaterOn));
  const heaterPoints: (number | null)[] = new Array(readings.length).fill(null);
  for (const t of heaterTransitions) {
    heaterPoints[t.index] = tempData[t.index]!;
  }

  // Fogger event markers on the humidity line
  const foggerTransitions = findTransitions(readings.map((r) => r.foggerOn));
  const foggerPoints: (number | null)[] = new Array(readings.length).fill(null);
  for (const t of foggerTransitions) {
    foggerPoints[t.index] = humidityData[t.index]!;
  }

  // Point styles: filled triangle for ON, empty triangle-down for OFF
  const heaterPointStyles = heaterTransitions.map((t) =>
    t.turnedOn ? "triangle" as const : "rectRot" as const,
  );
  const heaterRadii: number[] = new Array(readings.length).fill(0);
  const heaterStyles: string[] = new Array(readings.length).fill("circle");
  for (let i = 0; i < heaterTransitions.length; i++) {
    const t = heaterTransitions[i]!;
    heaterRadii[t.index] = 6;
    heaterStyles[t.index] = heaterPointStyles[i]!;
  }

  const foggerRadii: number[] = new Array(readings.length).fill(0);
  const foggerStyles: string[] = new Array(readings.length).fill("circle");
  for (const t of foggerTransitions) {
    foggerRadii[t.index] = 6;
    foggerStyles[t.index] = t.turnedOn ? "triangle" : "rectRot";
  }

  return {
    labels,
    datasets: [
      {
        label: `Temp (\u00B0${unit})`,
        data: tempData,
        borderColor: isDark ? "#945a3a" : "#dc2626",
        backgroundColor: isDark ? "rgba(148,90,58,0.1)" : "rgba(220,38,38,0.1)",
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "yTemp",
      },
      {
        label: "Humidity (%)",
        data: humidityData,
        borderColor: isDark ? "#09facc" : "#2563eb",
        backgroundColor: isDark ? "rgba(9,250,204,0.1)" : "rgba(37,99,235,0.1)",
        tension: 0.3,
        pointRadius: 0,
        yAxisID: "yHumidity",
      },
      {
        label: "Heater event",
        data: heaterPoints,
        borderColor: isDark ? "#ea580c" : "#ea580c",
        backgroundColor: isDark ? "#ea580c" : "#ea580c",
        pointRadius: heaterRadii,
        pointStyle: heaterStyles,
        showLine: false,
        yAxisID: "yTemp",
        spanGaps: false,
      },
      {
        label: "Fogger event",
        data: foggerPoints,
        borderColor: isDark ? "#23bba7" : "#3b82f6",
        backgroundColor: isDark ? "#23bba7" : "#3b82f6",
        pointRadius: foggerRadii,
        pointStyle: foggerStyles,
        showLine: false,
        yAxisID: "yHumidity",
        spanGaps: false,
      },
    ],
  };
}

function buildChartOptions(isDark: boolean, unit: "C" | "F"): ChartOptions<"line"> {
  const textColor = isDark ? "#9ca3af" : "#374151";
  const gridColor = isDark ? "rgba(55,142,121,0.15)" : "rgba(0,0,0,0.06)";

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      yTemp: {
        position: "left",
        title: { display: true, text: `\u00B0${unit}`, color: isDark ? "#945a3a" : "#dc2626" },
        beginAtZero: false,
        ticks: { color: isDark ? "#945a3a" : "#dc2626" },
        grid: { color: gridColor },
      },
      yHumidity: {
        position: "right",
        title: { display: true, text: "%", color: isDark ? "#09facc" : "#2563eb" },
        beginAtZero: false,
        ticks: { color: isDark ? "#09facc" : "#2563eb" },
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, padding: 8, color: textColor, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            if (ctx.dataset.label === "Heater event") {
              return `Heater event`;
            }
            if (ctx.dataset.label === "Fogger event") {
              return `Fogger event`;
            }
            const val = ctx.parsed.y;
            if (val == null) return "";
            if (ctx.dataset.yAxisID === "yTemp") return `${ctx.dataset.label}: ${val.toFixed(1)}\u00B0${unit}`;
            return `${ctx.dataset.label}: ${val.toFixed(1)}%`;
          },
        },
      },
    },
  };
}

export function HistoryChart({ deviceDbId }: HistoryChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const unit = useTempUnitStore((s) => s.unit);
  const isDark = theme === "dark";
  const [range, setRange] = useState<TimeRange>("24h");
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Current actuator state from last reading
  const lastReading = readings.length > 0 ? readings[readings.length - 1] : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const now = Math.floor(Date.now() / 1000);
    const from = now - timeRangeToSeconds(range);

    api<ReadingRow[]>(`/devices/${deviceDbId}/history?from=${from}&to=${now}`)
      .then((data) => {
        if (!cancelled) setReadings(data);
      })
      .catch(() => {
        if (!cancelled) setReadings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deviceDbId, range]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-myc-text dark:text-myc-text-dark">
          History
        </h3>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {lastReading && (
        <div className="flex gap-3 text-xs">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${lastReading.heaterOn ? "bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lastReading.heaterOn ? "bg-orange-500" : "bg-gray-400"}`} />
            Heater {lastReading.heaterOn ? "ON" : "OFF"}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${lastReading.foggerOn ? "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${lastReading.foggerOn ? "bg-blue-500 dark:bg-myc-teal" : "bg-gray-400"}`} />
            Fogger {lastReading.foggerOn ? "ON" : "OFF"}
          </span>
        </div>
      )}

      <div className="h-64">
        {loading ? (
          <p className="text-myc-muted dark:text-myc-muted-dark text-sm">
            Loading...
          </p>
        ) : readings.length === 0 ? (
          <p className="text-myc-muted dark:text-myc-muted-dark text-sm">
            No data for this range.
          </p>
        ) : (
          <Line
            data={buildChartData(readings, isDark, unit)}
            options={buildChartOptions(isDark, unit)}
          />
        )}
      </div>
    </div>
  );
}
