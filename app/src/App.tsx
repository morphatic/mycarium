import { BrowserRouter, useRoutes } from "react-router";
import { routes } from "./routes";
import { AppHeader } from "./components/AppHeader";
import { useAuthStore } from "./stores/auth";

function AppRoutes() {
  return useRoutes(routes);
}

export function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      {isAuthenticated && <AppHeader />}
      <AppRoutes />
    </BrowserRouter>
  );
}
