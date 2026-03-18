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
): ChartData<"line", number[], string> {
  const labels = readings.map((r) => formatTime(r.ts));

  return {
    labels,
    datasets: [
      {
        label: "Temp (°C)",
        data: readings.map((r) => r.tempC),
        borderColor: "#dc2626",
        backgroundColor: "rgba(220,38,38,0.1)",
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: "Humidity (%)",
        data: readings.map((r) => r.humidity),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37,99,235,0.1)",
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
        borderColor: "rgba(59,130,246,0.4)",
        backgroundColor: "rgba(59,130,246,0.15)",
        fill: true,
        tension: 0,
        pointRadius: 0,
        yAxisID: "y1",
      },
    ],
  };
}

const chartOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: "index" },
  scales: {
    y: { title: { display: true, text: "°C / %" }, beginAtZero: false },
    y1: {
      position: "right",
      min: 0,
      max: 1,
      display: false,
    },
  },
  plugins: {
    legend: { position: "bottom", labels: { boxWidth: 12, padding: 8 } },
  },
};

export function HistoryChart({ deviceDbId }: HistoryChartProps) {
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
        <h3 className="font-medium text-gray-800">History</h3>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>
      <div className="h-64">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : readings.length === 0 ? (
          <p className="text-gray-400 text-sm">No data for this range.</p>
        ) : (
          <Line data={buildChartData(readings)} options={chartOptions} />
        )}
      </div>
    </div>
  );
}
