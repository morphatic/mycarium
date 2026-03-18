import { useEffect } from "react";
import { BrowserRouter, useRoutes } from "react-router";
import { routes } from "./routes";
import { AppHeader } from "./components/AppHeader";
import { useAuthStore } from "./stores/auth";
import { useMqttStore } from "./stores/mqtt";
import { useDevicesStore } from "./stores/devices";

function MqttManager() {
  const session = useAuthStore((s) => s.session);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { connect, disconnect, subscribeDevice } = useMqttStore();
  const devices = useDevicesStore((s) => s.devices);

  useEffect(() => {
    if (!isAuthenticated || !session) {
      disconnect();
      return;
    }
    const host = import.meta.env.VITE_MQTT_HOST as string | undefined
      ?? window.location.host;
    connect(host, session.token);
    return () => disconnect();
  }, [isAuthenticated, session, connect, disconnect]);

  useEffect(() => {
    for (const device of devices) {
      subscribeDevice(device.deviceId);
    }
  }, [devices, subscribeDevice]);

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
