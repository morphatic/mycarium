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

function buildChartData(
  readings: ReadingRow[],
  isDark: boolean,
): ChartData<"line", number[], string> {
  const labels = readings.map((r) => formatTime(r.ts));

  return {
    labels,
    datasets: [
      {
        label: "Temp (\u00B0C)",
        data: readings.map((r) => r.tempC),
        borderColor: isDark ? "#945a3a" : "#dc2626",
        backgroundColor: isDark ? "rgba(148,90,58,0.1)" : "rgba(220,38,38,0.1)",
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: "Humidity (%)",
        data: readings.map((r) => r.humidity),
        borderColor: isDark ? "#09facc" : "#2563eb",
        backgroundColor: isDark ? "rgba(9,250,204,0.1)" : "rgba(37,99,235,0.1)",
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: "Heater",
        data: readings.map((r) => (r.heaterOn ? 1 : 0)),
        borderColor: "rgba(234,88,12,0.4)",
        backgroundColor: "rgba(234,88,12,0.15)",
        fill: true,
        tension: 0,
        pointRadius: 0,
        yAxisID: "y1",
      },
      {
        label: "Fogger",
        data: readings.map((r) => (r.foggerOn ? 1 : 0)),
        borderColor: isDark ? "rgba(35,187,167,0.4)" : "rgba(59,130,246,0.4)",
        backgroundColor: isDark ? "rgba(35,187,167,0.15)" : "rgba(59,130,246,0.15)",
        fill: true,
        tension: 0,
        pointRadius: 0,
        yAxisID: "y1",
      },
    ],
  };
}

function buildChartOptions(isDark: boolean): ChartOptions<"line"> {
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
      y: {
        title: { display: true, text: "\u00B0C / %", color: textColor },
        beginAtZero: false,
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y1: {
        position: "right",
        min: 0,
        max: 1,
        display: false,
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, padding: 8, color: textColor },
      },
    },
  };
}

export function HistoryChart({ deviceDbId }: HistoryChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";
  const [range, setRange] = useState<TimeRange>("24h");
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [loading, setLoading] = useState(false);

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
            data={buildChartData(readings, isDark)}
            options={buildChartOptions(isDark)}
          />
        )}
      </div>
    </div>
  );
}
