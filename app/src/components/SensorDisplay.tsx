import type { StatusMessage } from "../types";

interface SensorDisplayProps {
  status: StatusMessage;
}

export function SensorDisplay({ status }: SensorDisplayProps) {
  return (
    <div className="flex gap-6">
      <div>
        <p className="text-sm text-myc-muted dark:text-myc-muted-dark">
          Temperature
        </p>
        <p className="text-2xl font-semibold text-myc-brown-warm dark:text-myc-accent">
          {status.temp_c.toFixed(1)}&deg;C
        </p>
        {status.temp_f !== undefined && (
          <p className="text-sm text-myc-muted dark:text-myc-muted-dark">
            {status.temp_f.toFixed(1)}&deg;F
          </p>
        )}
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
