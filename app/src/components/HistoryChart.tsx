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
  tempMin?: number;
  tempMax?: number;
  humMin?: number;
  humMax?: number;
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
  thresholds?: { tempMin: number; tempMax: number; humMin: number; humMax: number },
): ChartData<"line", (number | null)[], string> {
  const labels = readings.map((r) => formatTime(r.ts));
  const tempData = readings.map((r) =>
    unit === "F" ? toFahrenheit(r.tempC) : r.tempC,
  );
  const humidityData = readings.map((r) => r.humidity);

  // Split heater events into ON and OFF datasets for distinct legend entries
  const heaterTransitions = findTransitions(readings.map((r) => r.heaterOn));
  const heaterOnPoints: (number | null)[] = new Array(readings.length).fill(null);
  const heaterOffPoints: (number | null)[] = new Array(readings.length).fill(null);
  const heaterOnRadii: number[] = new Array(readings.length).fill(0);
  const heaterOffRadii: number[] = new Array(readings.length).fill(0);
  for (const t of heaterTransitions) {
    if (t.turnedOn) {
      heaterOnPoints[t.index] = tempData[t.index]!;
      heaterOnRadii[t.index] = 6;
    } else {
      heaterOffPoints[t.index] = tempData[t.index]!;
      heaterOffRadii[t.index] = 6;
    }
  }

  // Split fogger events into ON and OFF datasets
  const foggerTransitions = findTransitions(readings.map((r) => r.foggerOn));
  const foggerOnPoints: (number | null)[] = new Array(readings.length).fill(null);
  const foggerOffPoints: (number | null)[] = new Array(readings.length).fill(null);
  const foggerOnRadii: number[] = new Array(readings.length).fill(0);
  const foggerOffRadii: number[] = new Array(readings.length).fill(0);
  for (const t of foggerTransitions) {
    if (t.turnedOn) {
      foggerOnPoints[t.index] = humidityData[t.index]!;
      foggerOnRadii[t.index] = 6;
    } else {
      foggerOffPoints[t.index] = humidityData[t.index]!;
      foggerOffRadii[t.index] = 6;
    }
  }

  const datasets: ChartData<"line", (number | null)[], string>["datasets"] = [];

  // Range band datasets (added first so they render behind data lines)
  if (thresholds) {
    const tMin = unit === "F" ? toFahrenheit(thresholds.tempMin) : thresholds.tempMin;
    const tMax = unit === "F" ? toFahrenheit(thresholds.tempMax) : thresholds.tempMax;
    const tempMinLine: (number | null)[] = new Array(readings.length).fill(tMin);
    const tempMaxLine: (number | null)[] = new Array(readings.length).fill(tMax);
    const humMinLine: (number | null)[] = new Array(readings.length).fill(thresholds.humMin);
    const humMaxLine: (number | null)[] = new Array(readings.length).fill(thresholds.humMax);

    datasets.push(
      {
        label: `Temp range`,
        data: tempMinLine,
        borderColor: isDark ? "rgba(148,90,58,0.4)" : "rgba(220,38,38,0.3)",
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        tension: 0,
        fill: false,
        yAxisID: "yTemp",
      },
      {
        label: "_tempMax",
        data: tempMaxLine,
        borderColor: isDark ? "rgba(148,90,58,0.4)" : "rgba(220,38,38,0.3)",
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        tension: 0,
        fill: "-1",
        backgroundColor: isDark ? "rgba(148,90,58,0.06)" : "rgba(220,38,38,0.06)",
        yAxisID: "yTemp",
      },
      {
        label: `Humidity range`,
        data: humMinLine,
        borderColor: isDark ? "rgba(9,250,204,0.3)" : "rgba(37,99,235,0.3)",
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        tension: 0,
        fill: false,
        yAxisID: "yHumidity",
      },
      {
        label: "_humMax",
        data: humMaxLine,
        borderColor: isDark ? "rgba(9,250,204,0.3)" : "rgba(37,99,235,0.3)",
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        tension: 0,
        fill: "-1",
        backgroundColor: isDark ? "rgba(9,250,204,0.06)" : "rgba(37,99,235,0.06)",
        yAxisID: "yHumidity",
      },
    );
  }

  // Main data lines
  datasets.push(
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
  );

  // Event marker datasets — split by on/off for clear legend
  datasets.push(
    {
      label: "Heater ON",
      data: heaterOnPoints,
      borderColor: isDark ? "#ea580c" : "#ea580c",
      backgroundColor: isDark ? "#ea580c" : "#ea580c",
      pointRadius: heaterOnRadii,
      pointStyle: "triangle",
      showLine: false,
      yAxisID: "yTemp",
      spanGaps: false,
    },
    {
      label: "Heater OFF",
      data: heaterOffPoints,
      borderColor: isDark ? "#ea580c" : "#ea580c",
      backgroundColor: isDark ? "#ea580c" : "#ea580c",
      pointRadius: heaterOffRadii,
      pointStyle: "rectRot",
      showLine: false,
      yAxisID: "yTemp",
      spanGaps: false,
    },
    {
      label: "Fogger ON",
      data: foggerOnPoints,
      borderColor: isDark ? "#23bba7" : "#3b82f6",
      backgroundColor: isDark ? "#23bba7" : "#3b82f6",
      pointRadius: foggerOnRadii,
      pointStyle: "triangle",
      showLine: false,
      yAxisID: "yHumidity",
      spanGaps: false,
    },
    {
      label: "Fogger OFF",
      data: foggerOffPoints,
      borderColor: isDark ? "#23bba7" : "#3b82f6",
      backgroundColor: isDark ? "#23bba7" : "#3b82f6",
      pointRadius: foggerOffRadii,
      pointStyle: "rectRot",
      showLine: false,
      yAxisID: "yHumidity",
      spanGaps: false,
    },
  );

  return { labels, datasets };
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
        labels: {
          boxWidth: 12,
          padding: 8,
          color: textColor,
          usePointStyle: true,
          filter: (item) => {
            // Hide internal datasets (prefixed with _)
            return !item.text.startsWith("_");
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const lbl = ctx.dataset.label ?? "";
            // Skip internal range band datasets in tooltip
            if (lbl.startsWith("_")) return "";
            if (lbl === "Temp range" || lbl === "Humidity range") return "";
            if (lbl.startsWith("Heater")) return `${lbl}`;
            if (lbl.startsWith("Fogger")) return `${lbl}`;
            const val = ctx.parsed.y;
            if (val == null) return "";
            if (ctx.dataset.yAxisID === "yTemp") return `${lbl}: ${val.toFixed(1)}\u00B0${unit}`;
            return `${lbl}: ${val.toFixed(1)}%`;
          },
        },
      },
    },
  };
}

export function HistoryChart({ deviceDbId, tempMin, tempMax, humMin, humMax }: HistoryChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const unit = useTempUnitStore((s) => s.unit);
  const isDark = theme === "dark";
  const [range, setRange] = useState<TimeRange>("24h");
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Current actuator state from last reading
  const lastReading = readings.length > 0 ? readings[readings.length - 1] : null;

  const thresholds = tempMin != null && tempMax != null && humMin != null && humMax != null
    ? { tempMin, tempMax, humMin, humMax }
    : undefined;

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
            data={buildChartData(readings, isDark, unit, thresholds)}
            options={buildChartOptions(isDark, unit)}
          />
        )}
      </div>
    </div>
  );
}
