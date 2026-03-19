import { useEffect } from "react";
import { BrowserRouter, useRoutes } from "react-router";
import { routes } from "./routes";
import { AppHeader } from "./components/AppHeader";
import { useAuthStore } from "./stores/auth";
import { useMqttStore } from "./stores/mqtt";
import { useDevicesStore } from "./stores/devices";

function MqttManager() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { connect, disconnect, subscribeDevice } = useMqttStore();
  const connected = useMqttStore((s) => s.connected);
  const devices = useDevicesStore((s) => s.devices);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnect();
      return;
    }
    const host = import.meta.env.VITE_MQTT_HOST as string | undefined
      ?? window.location.host;
    connect(host, token);
    return () => disconnect();
  }, [isAuthenticated, token, connect, disconnect]);

  // Re-subscribe whenever the connection is (re)established or devices change
  useEffect(() => {
    if (!connected) return;
    for (const device of devices) {
      subscribeDevice(device.deviceId);
    }
  }, [devices, connected, subscribeDevice]);

  return null;
}

function AppRoutes() {
  return useRoutes(routes);
}

export function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      {isAuthenticated && <AppHeader />}
      <MqttManager />
      <AppRoutes />
    </BrowserRouter>
  );
}
