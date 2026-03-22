import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { timeRangeToSeconds, type TimeRange } from "../components/TimeRangeSelector";
import type { ReadingRow } from "../types";

export interface ChartWindow {
  range: TimeRange;
  setRange: (r: TimeRange) => void;
  windowEnd: number | null; // null = live
  isLive: boolean;
  readings: ReadingRow[];
  loading: boolean;
  panBack: () => void;
  panForward: () => void;
  jumpToLive: () => void;
}

export function useChartWindow(deviceDbId: number): ChartWindow {
  const [range, setRangeRaw] = useState<TimeRange>("1h");
  const [windowEnd, setWindowEnd] = useState<number | null>(null);
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  const isLive = windowEnd === null;
  const rangeSeconds = timeRangeToSeconds(range);

  // Changing range resets to live
  const setRange = useCallback((r: TimeRange) => {
    setRangeRaw(r);
    setWindowEnd(null);
  }, []);

  const panBack = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const currentEnd = windowEnd ?? now;
    setWindowEnd(currentEnd - Math.floor(rangeSeconds / 2));
  }, [windowEnd, rangeSeconds]);

  const panForward = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const currentEnd = windowEnd ?? now;
    const newEnd = currentEnd + Math.floor(rangeSeconds / 2);
    if (newEnd >= now) {
      setWindowEnd(null); // snap to live
    } else {
      setWindowEnd(newEnd);
    }
  }, [windowEnd, rangeSeconds]);

  const jumpToLive = useCallback(() => {
    setWindowEnd(null);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    const fetchData = () => {
      setLoading(true);
      const now = Math.floor(Date.now() / 1000);
      const to = windowEnd ?? now;
      const from = to - rangeSeconds;

      api<ReadingRow[]>(`/devices/${deviceDbId}/history?from=${from}&to=${to}`)
        .then((data) => {
          if (!cancelledRef.current) setReadings(data);
        })
        .catch(() => {
          if (!cancelledRef.current) setReadings([]);
        })
        .finally(() => {
          if (!cancelledRef.current) setLoading(false);
        });
    };

    fetchData();

    // Only auto-refresh in live mode
    const interval = isLive ? setInterval(fetchData, 30_000) : undefined;

    return () => {
      cancelledRef.current = true;
      if (interval) clearInterval(interval);
    };
  }, [deviceDbId, rangeSeconds, windowEnd, isLive]);

  return {
    range,
    setRange,
    windowEnd,
    isLive,
    readings,
    loading,
    panBack,
    panForward,
    jumpToLive,
  };
}
