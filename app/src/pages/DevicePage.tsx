import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDevicesStore } from "../stores/devices";
import { useMqttStore } from "../stores/mqtt";
import { useLiveness } from "../hooks/useLiveness";
import { publish } from "../mqtt";
import { SensorDisplay } from "../components/SensorDisplay";
import { ActuatorBadge } from "../components/ActuatorBadge";
import { ThresholdEditor } from "../components/ThresholdEditor";
import { ModeSwitch } from "../components/ModeSwitch";
import { StandbyButton } from "../components/StandbyButton";
import { HistoryChart } from "../components/HistoryChart";
import { AlertBanner } from "../components/AlertBanner";
import { useAlerts } from "../hooks/useAlerts";
import type { ControlMessage } from "../types";

export function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { devices, fetchDevices, renameDevice, removeDevice } =
    useDevicesStore();
  const device = devices.find((d) => d.id === Number(id));

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (devices.length === 0) fetchDevices();
  }, [devices.length, fetchDevices]);

  const deviceId = device?.deviceId;
  const status = useMqttStore((s) =>
    deviceId ? s.statuses[deviceId] : undefined,
  );
  const liveness = useLiveness(deviceId ?? "");
  const alerts = useAlerts(deviceId ?? "");

  if (!device) {
    return (
      <p className="p-4 text-myc-muted dark:text-myc-muted-dark">
        Device not found.
      </p>
    );
  }

  const sendControl = (msg: ControlMessage) => {
    publish(`mycarium/control/${device.deviceId}`, JSON.stringify(msg));
  };

  const isStandby =
    status?.heater_mode === "manual" &&
    status?.fogger_mode === "manual" &&
    !status?.heater_on &&
    !status?.fogger_on;

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    await renameDevice(device.id, name);
    setEditing(false);
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${device.name || device.deviceId}?`)) return;
    await removeDevice(device.id);
    navigate("/");
  };

  const displayName = device.name || device.deviceId;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/")}
        className="text-myc-teal dark:text-myc-accent text-sm mb-4 hover:underline"
      >
        &larr; Back
      </button>

      <div className="bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow dark:shadow-myc-teal-deep/10 border border-transparent dark:border-myc-teal-deep/20 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-myc-text dark:text-myc-text-dark">
              {displayName}
            </h2>
            {device.name && (
              <p className="text-sm text-myc-muted dark:text-myc-muted-dark">
                {device.deviceId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {liveness === "offline" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                offline
              </span>
            )}
            {isStandby && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                standby
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

        {/* Rename / Remove */}
        {editing ? (
          <form onSubmit={handleRename} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Device name"
              className="flex-1 border border-myc-cream dark:border-myc-teal-deep/40 rounded px-3 py-2 bg-white dark:bg-myc-bg-dark dark:text-myc-text-dark focus:outline-none focus:ring-2 focus:ring-myc-teal dark:focus:ring-myc-accent"
              autoFocus
            />
            <button
              type="submit"
              className="bg-myc-teal dark:bg-myc-teal-deep text-white px-3 py-2 rounded text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-myc-muted dark:text-myc-muted-dark px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setName(device.name || "");
                setEditing(true);
              }}
              className="text-sm text-myc-teal dark:text-myc-accent hover:underline"
            >
              Rename
            </button>
            <button
              onClick={handleRemove}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        {alerts.length > 0 && <AlertBanner alerts={alerts} />}

        {/* Live Status */}
        {status && (
          <>
            <SensorDisplay status={status} />
            <div className="flex gap-2">
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

            {/* Controls */}
            <div className="border-t border-myc-cream dark:border-myc-teal-deep/20 pt-4 space-y-4">
              <h3 className="font-medium text-myc-text dark:text-myc-text-dark">
                Controls
              </h3>

              <ThresholdEditor
                label="Temperature"
                unit="°C"
                min={status.temp_min_c ?? 20}
                max={status.temp_max_c ?? 28}
                onSave={(min, max) =>
                  sendControl({ temp_min_c: min, temp_max_c: max })
                }
              />

              <ThresholdEditor
                label="Humidity"
                unit="%"
                min={status.humidity_min ?? 70}
                max={status.humidity_max ?? 90}
                onSave={(min, max) =>
                  sendControl({ humidity_min: min, humidity_max: max })
                }
              />

              <div className="space-y-2">
                <ModeSwitch
                  label="Heater"
                  mode={(status.heater_mode as "auto" | "manual") ?? "auto"}
                  on={status.heater_on}
                  onModeChange={(mode) => sendControl({ heater_mode: mode })}
                  onToggle={(on) => sendControl({ heater_on: on })}
                />
                <ModeSwitch
                  label="Fogger"
                  mode={(status.fogger_mode as "auto" | "manual") ?? "auto"}
                  on={status.fogger_on}
                  onModeChange={(mode) => sendControl({ fogger_mode: mode })}
                  onToggle={(on) => sendControl({ fogger_on: on })}
                />
              </div>

              <StandbyButton
                isStandby={isStandby}
                onEnter={() =>
                  sendControl({
                    heater_mode: "manual",
                    fogger_mode: "manual",
                    heater_on: false,
                    fogger_on: false,
                  })
                }
                onExit={() =>
                  sendControl({
                    heater_mode: "auto",
                    fogger_mode: "auto",
                  })
                }
              />
            </div>
          </>
        )}

        {/* History Chart */}
        <div className="border-t border-myc-cream dark:border-myc-teal-deep/20 pt-4">
          <HistoryChart deviceDbId={device.id} />
        </div>
      </div>
    </div>
  );
}
