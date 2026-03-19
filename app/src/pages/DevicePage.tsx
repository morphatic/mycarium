import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDevicesStore } from "../stores/devices";
import { useMqttStore } from "../stores/mqtt";
import { useTempUnitStore, toFahrenheit, toCelsius } from "../stores/tempUnit";
import { useLiveness } from "../hooks/useLiveness";
import { publish } from "../mqtt";
import { api } from "../api";
import { ActuatorBadge } from "../components/ActuatorBadge";
import { ThresholdEditor } from "../components/ThresholdEditor";
import { ModeSwitch } from "../components/ModeSwitch";
import { HistoryChart } from "../components/HistoryChart";
import { AlertBanner } from "../components/AlertBanner";
import { useAlerts } from "../hooks/useAlerts";
import type { ControlMessage, ReadingRow } from "../types";

/** Optimistic overrides applied on top of MQTT status until device confirms. */
interface Overrides {
  heater_mode?: "auto" | "manual";
  fogger_mode?: "auto" | "manual";
  heater_on?: boolean;
  fogger_on?: boolean;
  temp_pending?: boolean;
  hum_pending?: boolean;
}

export function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { devices, fetchDevices, renameDevice, removeDevice } =
    useDevicesStore();
  const device = devices.find((d) => d.id === Number(id));

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [latestReading, setLatestReading] = useState<ReadingRow | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const overrideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (devices.length === 0) fetchDevices();
  }, [devices.length, fetchDevices]);

  // Fetch the most recent reading from API as fallback for live display
  useEffect(() => {
    if (!device) return;
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    api<ReadingRow[]>(`/devices/${device.id}/history?from=${fiveMinAgo}&to=${now}`)
      .then((rows) => {
        if (rows.length > 0) setLatestReading(rows[rows.length - 1]!);
      })
      .catch(() => {});
  }, [device?.id]);

  const deviceId = device?.deviceId;
  const mqttConnected = useMqttStore((s) => s.connected);
  const status = useMqttStore((s) =>
    deviceId ? s.statuses[deviceId] : undefined,
  );
  const unit = useTempUnitStore((s) => s.unit);
  const liveness = useLiveness(deviceId ?? "");
  const alerts = useAlerts(deviceId ?? "");

  // Clear optimistic overrides when a new status message arrives
  const statusTs = status?.ts;
  const prevTsRef = useRef(statusTs);
  useEffect(() => {
    if (statusTs !== undefined && statusTs !== prevTsRef.current) {
      prevTsRef.current = statusTs;
      setOverrides({});
      if (overrideTimer.current) clearTimeout(overrideTimer.current);
    }
  }, [statusTs]);

  if (!device) {
    return (
      <p className="p-4 text-myc-muted dark:text-myc-muted-dark">
        Device not found.
      </p>
    );
  }

  const sendControl = (msg: ControlMessage) => {
    publish(`mycarium/control/${device.deviceId}`, JSON.stringify(msg));

    // Apply optimistic overrides for mode/on fields
    const newOverrides: Overrides = { ...overrides };
    if (msg.heater_mode !== undefined) newOverrides.heater_mode = msg.heater_mode;
    if (msg.fogger_mode !== undefined) newOverrides.fogger_mode = msg.fogger_mode;
    if (msg.heater_on !== undefined) newOverrides.heater_on = msg.heater_on;
    if (msg.fogger_on !== undefined) newOverrides.fogger_on = msg.fogger_on;
    if (msg.temp_min !== undefined || msg.temp_max !== undefined) newOverrides.temp_pending = true;
    if (msg.hum_min !== undefined || msg.hum_max !== undefined) newOverrides.hum_pending = true;
    setOverrides(newOverrides);

    // Auto-clear after 60s if device never confirms
    if (overrideTimer.current) clearTimeout(overrideTimer.current);
    overrideTimer.current = setTimeout(() => setOverrides({}), 60_000);
  };

  // Merge MQTT status with optimistic overrides
  const hasLive = !!status;
  const tempC = status?.temp_c ?? latestReading?.tempC;
  const humidity = status?.humidity ?? latestReading?.humidity;
  const heaterOn = overrides.heater_on ?? status?.heater_on ?? latestReading?.heaterOn ?? false;
  const foggerOn = overrides.fogger_on ?? status?.fogger_on ?? latestReading?.foggerOn ?? false;
  const heaterMode = overrides.heater_mode ?? (status?.heater_mode as "auto" | "manual") ?? "auto";
  const foggerMode = overrides.fogger_mode ?? (status?.fogger_mode as "auto" | "manual") ?? "auto";
  const tempMinC = status?.temp_min ?? 20;
  const tempMaxC = status?.temp_max ?? 28;
  const humMin = status?.hum_min ?? 70;
  const humMax = status?.hum_max ?? 90;

  const hasPending = Object.keys(overrides).length > 0;
  const heaterPending = overrides.heater_mode !== undefined || overrides.heater_on !== undefined;
  const foggerPending = overrides.fogger_mode !== undefined || overrides.fogger_on !== undefined;
  const tempThresholdPending = overrides.temp_pending === true;
  const humThresholdPending = overrides.hum_pending === true;

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

  const tempDisplay =
    tempC != null
      ? (unit === "F" ? toFahrenheit(tempC) : tempC).toFixed(1)
      : "--";

  const displayTempMin =
    unit === "F" ? toFahrenheit(tempMinC).toFixed(1) : tempMinC.toFixed(1);
  const displayTempMax =
    unit === "F" ? toFahrenheit(tempMaxC).toFixed(1) : tempMaxC.toFixed(1);

  // Range status for color coding — compare rounded display values so that
  // e.g. 75.0°F shows as in-range when the threshold min is 75.0°F, even if
  // the raw Celsius value is fractionally below due to float precision.
  type RangeStatus = "low" | "ok" | "high" | "unknown";
  const roundedTemp = tempC != null
    ? parseFloat((unit === "F" ? toFahrenheit(tempC) : tempC).toFixed(1))
    : null;
  const roundedTempMin = parseFloat((unit === "F" ? toFahrenheit(tempMinC) : tempMinC).toFixed(1));
  const roundedTempMax = parseFloat((unit === "F" ? toFahrenheit(tempMaxC) : tempMaxC).toFixed(1));
  const roundedHum = humidity != null ? parseFloat(humidity.toFixed(1)) : null;
  const roundedHumMin = parseFloat(humMin.toFixed(1));
  const roundedHumMax = parseFloat(humMax.toFixed(1));

  const tempRange: RangeStatus =
    roundedTemp == null ? "unknown"
      : roundedTemp < roundedTempMin ? "low"
        : roundedTemp > roundedTempMax ? "high"
          : "ok";
  const humRange: RangeStatus =
    roundedHum == null ? "unknown"
      : roundedHum < roundedHumMin ? "low"
        : roundedHum > roundedHumMax ? "high"
          : "ok";

  const rangeColor = (range: RangeStatus) => {
    switch (range) {
      case "ok": return "text-green-600 dark:text-green-400";
      case "low": return "text-blue-600 dark:text-blue-400";
      case "high": return "text-red-600 dark:text-red-400";
      default: return "text-myc-muted dark:text-myc-muted-dark";
    }
  };
  const rangeArrow = (range: RangeStatus) => {
    switch (range) {
      case "low": return " \u25BC";  // ▼
      case "high": return " \u25B2"; // ▲
      default: return "";
    }
  };

  const sensorStatus: { label: string; color: string; dotColor: string } =
    !mqttConnected
      ? { label: "disconnected", color: "text-red-600 dark:text-red-400", dotColor: "bg-red-500" }
      : liveness === "online"
        ? { label: "receiving", color: "text-green-600 dark:text-green-400", dotColor: "bg-green-500 animate-pulse" }
        : hasLive
          ? { label: "no recent data", color: "text-amber-600 dark:text-amber-400", dotColor: "bg-amber-500" }
          : { label: "waiting", color: "text-myc-muted dark:text-myc-muted-dark", dotColor: "bg-gray-400" };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <button
        onClick={() => navigate("/")}
        className="text-myc-teal dark:text-myc-accent text-sm hover:underline"
      >
        &larr; Back
      </button>

      {/* Header + Device Info */}
      <div className="bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow dark:shadow-myc-teal-deep/10 border border-transparent dark:border-myc-teal-deep/20 p-4">
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
            <span className={`inline-flex items-center gap-1.5 text-xs ${sensorStatus.color}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${sensorStatus.dotColor}`} />
              {sensorStatus.label}
            </span>
            {device.status === "pending" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400">
                pending
              </span>
            )}
          </div>
        </div>

        {/* Rename / Remove */}
        {editing ? (
          <form onSubmit={handleRename} className="flex gap-2 mt-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Device name"
              maxLength={64}
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
          <div className="flex gap-2 mt-2">
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
      </div>

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* Live Readings */}
      <div className="bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow dark:shadow-myc-teal-deep/10 border border-transparent dark:border-myc-teal-deep/20 p-4">
        {!hasLive && latestReading && (
          <p className="text-xs text-myc-muted dark:text-myc-muted-dark mb-2 italic">
            Showing last known values from API
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-myc-muted dark:text-myc-muted-dark uppercase tracking-wide">
              Temperature
            </p>
            <p className={`text-3xl font-bold ${rangeColor(tempRange)}`}>
              {tempDisplay}&deg;{unit}{rangeArrow(tempRange)}
            </p>
            <p className="text-xs text-myc-muted dark:text-myc-muted-dark mt-1">
              Range: {displayTempMin}&ndash;{displayTempMax}&deg;{unit}
            </p>
          </div>
          <div>
            <p className="text-xs text-myc-muted dark:text-myc-muted-dark uppercase tracking-wide">
              Humidity
            </p>
            <p className={`text-3xl font-bold ${rangeColor(humRange)}`}>
              {humidity != null ? humidity.toFixed(1) : "--"}%{rangeArrow(humRange)}
            </p>
            <p className="text-xs text-myc-muted dark:text-myc-muted-dark mt-1">
              Range: {humMin}&ndash;{humMax}%
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-myc-cream dark:border-myc-teal-deep/20">
          <ActuatorBadge label="Heater" on={heaterOn} mode={heaterMode} />
          <ActuatorBadge label="Fogger" on={foggerOn} mode={foggerMode} />
          {hasPending && (
            <span className="text-[10px] text-myc-muted dark:text-myc-muted-dark italic animate-pulse self-center ml-auto">
              command sent...
            </span>
          )}
        </div>
      </div>

      {/* Controls — collapsible */}
      <div className="bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow dark:shadow-myc-teal-deep/10 border border-transparent dark:border-myc-teal-deep/20">
        <button
          onClick={() => setControlsOpen(!controlsOpen)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <h3 className="font-medium text-myc-text dark:text-myc-text-dark">
            Controls
          </h3>
          <span className="text-myc-muted dark:text-myc-muted-dark text-sm">
            {controlsOpen ? "\u25B2" : "\u25BC"}
          </span>
        </button>
        {controlsOpen && (
          <div className="px-4 pb-4 space-y-4">
            {!mqttConnected && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded">
                MQTT not connected — control messages will not be delivered.
              </p>
            )}
            <ThresholdEditor
              label="Temperature"
              unit={`\u00B0${unit}`}
              min={unit === "F" ? toFahrenheit(tempMinC) : tempMinC}
              max={unit === "F" ? toFahrenheit(tempMaxC) : tempMaxC}
              minGap={unit === "F" ? 3.6 : 2}
              pending={tempThresholdPending}
              onSave={(min, max) =>
                sendControl({
                  temp_min: unit === "F" ? toCelsius(min) : min,
                  temp_max: unit === "F" ? toCelsius(max) : max,
                })
              }
            />

            <ThresholdEditor
              label="Humidity"
              unit="%"
              min={humMin}
              max={humMax}
              minGap={6}
              pending={humThresholdPending}
              onSave={(min, max) =>
                sendControl({ hum_min: min, hum_max: max })
              }
            />

            <div className="space-y-3 pt-2 border-t border-myc-cream dark:border-myc-teal-deep/20">
              <ModeSwitch
                label="Heater"
                mode={heaterMode}
                on={heaterOn}
                pending={heaterPending}
                onModeChange={(mode) => sendControl({ heater_mode: mode })}
                onToggle={(on) => sendControl({ heater_on: on })}
              />
              <ModeSwitch
                label="Fogger"
                mode={foggerMode}
                on={foggerOn}
                pending={foggerPending}
                onModeChange={(mode) => sendControl({ fogger_mode: mode })}
                onToggle={(on) => sendControl({ fogger_on: on })}
              />
            </div>
          </div>
        )}
      </div>

      {/* History Chart */}
      <div className="bg-myc-surface dark:bg-myc-surface-dark rounded-lg shadow dark:shadow-myc-teal-deep/10 border border-transparent dark:border-myc-teal-deep/20 p-4">
        <HistoryChart
          deviceDbId={device.id}
          tempMin={tempMinC}
          tempMax={tempMaxC}
          humMin={humMin}
          humMax={humMax}
        />
      </div>
    </div>
  );
}
