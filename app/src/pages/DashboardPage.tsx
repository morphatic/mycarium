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
      <h2 className="text-xl font-semibold mb-4">Devices</h2>

      {error && (
        <p className="text-red-600 text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {loading && devices.length === 0 ? (
        <p className="text-gray-500">Loading...</p>
      ) : devices.length === 0 ? (
        <p className="text-gray-500 mb-4">
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
          className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={claiming || !newDeviceId.trim()}
          className="bg-emerald-700 text-white px-4 py-2 rounded font-medium hover:bg-emerald-800 disabled:opacity-50"
        >
          {claiming ? "..." : "Claim"}
        </button>
      </form>
    </div>
  );
}
