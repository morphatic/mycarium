import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useDevicesStore } from "../stores/devices";

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

  if (!device) {
    return <p className="p-4 text-gray-500">Device not found.</p>;
  }

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
        className="text-emerald-700 text-sm mb-4 hover:underline"
      >
        &larr; Back
      </button>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            {device.name && (
              <p className="text-sm text-gray-500">{device.deviceId}</p>
            )}
          </div>
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

        {editing ? (
          <form onSubmit={handleRename} className="flex gap-2 mb-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Device name"
              className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-emerald-700 text-white px-3 py-2 rounded text-sm"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-gray-500 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setName(device.name || "");
                setEditing(true);
              }}
              className="text-sm text-emerald-700 hover:underline"
            >
              Rename
            </button>
            <button
              onClick={handleRemove}
              className="text-sm text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        {/* Controls and history will be added in later phases */}
      </div>
    </div>
  );
}
