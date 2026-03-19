import { Link } from "react-router";
import type { Device } from "../types";
import { useMqttStore } from "../stores/mqtt";
import { useLiveness } from "../hooks/useLiveness";
import { SensorDisplay } from "./SensorDisplay";
import { ActuatorBadge } from "./ActuatorBadge";

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const displayName = device.name || device.deviceId;
  const status = useMqttStore((s) => s.statuses[device.deviceId]);
  const liveness = useLiveness(device.deviceId);

  return (
    <Link
      to={`/device/${device.id}`}
      className="block bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow dark:shadow-myc-teal-deep/10 border border-transparent dark:border-myc-teal-deep/20 p-4 hover:shadow-md dark:hover:border-myc-teal-deep/40 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-myc-text dark:text-myc-text-dark">
          {displayName}
        </h3>
        <div className="flex items-center gap-2">
          {liveness === "offline" && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
              offline
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              device.status === "active"
                ? "bg-myc-teal/10 text-myc-teal-deep dark:bg-myc-accent/10 dark:text-myc-accent"
                : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400"
            }`}
          >
            {device.status}
          </span>
        </div>
      </div>
      {device.name && (
        <p className="text-sm text-myc-muted dark:text-myc-muted-dark mb-2">
          {device.deviceId}
        </p>
      )}
      {status && (
        <>
          <SensorDisplay status={status} />
          <div className="flex gap-2 mt-2">
            <ActuatorBadge
              label="Heater"
              on={status.heater_on}
              mode={status.heater_mode}
            />
            <ActuatorBadge
              label="Fogger"
              on={status.fogger_on}
              mode={status.fogger_mode}
            />
          </div>
        </>
      )}
    </Link>
  );
}
