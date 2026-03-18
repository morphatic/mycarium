import { useState } from "react";
import type { Alert } from "../hooks/useAlerts";

interface AlertBannerProps {
  alerts: Alert[];
}

const alertStyles = {
  offline: "bg-red-50 border-red-200 text-red-800",
  temp: "bg-orange-50 border-orange-200 text-orange-800",
  humidity: "bg-blue-50 border-blue-200 text-blue-800",
};

export function AlertBanner({ alerts }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter(
    (a) => !dismissed.has(`${a.type}:${a.message}`),
  );

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => {
        const key = `${alert.type}:${alert.message}`;
        return (
          <div
            key={key}
            role="alert"
            className={`flex items-center justify-between border rounded px-3 py-2 text-sm ${alertStyles[alert.type]}`}
          >
            <span>{alert.message}</span>
            <button
              onClick={() =>
                setDismissed((prev) => new Set([...prev, key]))
              }
              className="ml-2 opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
