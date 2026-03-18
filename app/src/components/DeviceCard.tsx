import { Link } from "react-router";
import type { Device } from "../types";

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  const displayName = device.name || device.deviceId;

  return (
    <Link
      to={`/device/${device.id}`}
      className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{displayName}</h3>
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
      {device.name && (
        <p className="text-sm text-gray-500 mt-1">{device.deviceId}</p>
      )}
    </Link>
  );
}
