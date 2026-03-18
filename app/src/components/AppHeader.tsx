import { useAuthStore } from "../stores/auth";

export function AppHeader() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold">Mycarium</h1>
      <button
        onClick={logout}
        className="text-sm bg-emerald-700 hover:bg-emerald-600 px-3 py-1 rounded"
      >
        Log out
      </button>
    </header>
  );
}
