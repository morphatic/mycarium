import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";

export function AppHeader() {
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle } = useThemeStore();

  return (
    <header className="bg-myc-brown dark:bg-myc-surface-dark border-b border-myc-brown-warm/30 dark:border-myc-teal-deep/40 text-myc-cream px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold text-myc-cream dark:text-myc-accent">
        Mycarium
      </h1>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="text-sm text-myc-cream/80 hover:text-myc-cream dark:text-myc-muted-dark dark:hover:text-myc-accent"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button
          onClick={logout}
          className="text-sm bg-myc-brown-warm/60 hover:bg-myc-brown-warm/80 dark:bg-myc-teal-deep/50 dark:hover:bg-myc-teal-deep px-3 py-1 rounded"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
