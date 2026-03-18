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
      className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{displayName}</h3>
        <div className="flex items-center gap-2">
          {liveness === "offline" && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
              offline
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              device.status === "active"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {device.status}
          </span>
        </div>
      </div>
      {device.name && (
        <p className="text-sm text-gray-500 mb-2">{device.deviceId}</p>
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
