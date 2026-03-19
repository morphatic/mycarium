import { useEffect, useState } from "react";
import { useDevicesStore } from "../stores/devices";
import { DeviceCard } from "../components/DeviceCard";

export function DashboardPage() {
  const { devices, loading, error, fetchDevices, claimDevice } =
    useDevicesStore();
  const [newDeviceId, setNewDeviceId] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceId.trim()) return;
    setClaiming(true);
    try {
      await claimDevice(newDeviceId.trim());
      setNewDeviceId("");
    } catch {
      // error is set in store
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-myc-text dark:text-myc-text-dark">
        Devices
      </h2>

      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {loading && devices.length === 0 ? (
        <p className="text-myc-muted dark:text-myc-muted-dark">Loading...</p>
      ) : devices.length === 0 ? (
        <p className="text-myc-muted dark:text-myc-muted-dark mb-4">
          No devices yet. Claim one to get started.
        </p>
      ) : (
        <div className="grid gap-3 mb-6">
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} />
          ))}
        </div>
      )}

      <form onSubmit={handleClaim} className="flex gap-2">
        <input
          type="text"
          placeholder="Device ID (e.g. mycarium-1)"
          value={newDeviceId}
          onChange={(e) => setNewDeviceId(e.target.value)}
          className="flex-1 border border-myc-cream dark:border-myc-teal-deep/40 rounded px-3 py-2 bg-white dark:bg-myc-bg-dark dark:text-myc-text-dark focus:outline-none focus:ring-2 focus:ring-myc-teal dark:focus:ring-myc-accent"
        />
        <button
          type="submit"
          disabled={claiming || !newDeviceId.trim()}
          className="bg-myc-teal dark:bg-myc-teal-deep text-white px-4 py-2 rounded font-medium hover:bg-myc-teal-mid dark:hover:bg-myc-teal disabled:opacity-50"
        >
          {claiming ? "..." : "Claim"}
        </button>
      </form>
    </div>
  );
}
