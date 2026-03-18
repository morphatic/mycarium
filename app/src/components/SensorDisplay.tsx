import type { StatusMessage } from "../types";

interface SensorDisplayProps {
  status: StatusMessage;
}

export function SensorDisplay({ status }: SensorDisplayProps) {
  return (
    <div className="flex gap-6">
      <div>
        <p className="text-sm text-gray-500">Temperature</p>
        <p className="text-2xl font-semibold">
          {status.temp_c.toFixed(1)}&deg;C
        </p>
        {status.temp_f !== undefined && (
          <p className="text-sm text-gray-400">
            {status.temp_f.toFixed(1)}&deg;F
          </p>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500">Humidity</p>
        <p className="text-2xl font-semibold">
          {status.humidity.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
