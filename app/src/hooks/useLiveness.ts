import { useEffect, useState } from "react";
import { useMqttStore } from "../stores/mqtt";

const OFFLINE_THRESHOLD_MS = 60_000; // 2x the 30s poll interval

export function useLiveness(deviceId: string): "online" | "offline" | "unknown" {
  const lastSeen = useMqttStore((s) => s.lastSeen[deviceId]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(interval);
  }, []);

  if (lastSeen === undefined) return "unknown";
  return now - lastSeen > OFFLINE_THRESHOLD_MS ? "offline" : "online";
}
