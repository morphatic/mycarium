import type { StatusMessage } from "../types";
import { useTempUnitStore, toFahrenheit } from "../stores/tempUnit";

interface SensorDisplayProps {
  status: StatusMessage;
}

export function SensorDisplay({ status }: SensorDisplayProps) {
  const unit = useTempUnitStore((s) => s.unit);
  const temp =
    unit === "F"
      ? status.temp_f ?? toFahrenheit(status.temp_c)
      : status.temp_c;

  return (
    <div className="flex gap-6">
      <div>
        <p className="text-sm text-myc-muted dark:text-myc-muted-dark">
          Temperature
        </p>
        <p className="text-2xl font-semibold text-myc-brown-warm dark:text-myc-accent">
          {temp.toFixed(1)}&deg;{unit}
        </p>
      </div>
      <div>
        <p className="text-sm text-myc-muted dark:text-myc-muted-dark">
          Humidity
        </p>
        <p className="text-2xl font-semibold text-myc-teal-deep dark:text-myc-teal">
          {status.humidity.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
