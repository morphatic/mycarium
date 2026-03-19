import { useAuthStore } from "../stores/auth";
import { useThemeStore } from "../stores/theme";
import { useTempUnitStore } from "../stores/tempUnit";

export function AppHeader() {
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const { unit, toggle: toggleUnit } = useTempUnitStore();

  return (
    <header className="bg-myc-brown dark:bg-myc-surface-dark border-b border-myc-brown-warm/30 dark:border-myc-teal-deep/40 text-myc-cream px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img
          src="/icons/mycarium_icon.svg"
          alt=""
          className="w-8 h-8"
        />
        <h1
          className="text-xl text-myc-cream dark:text-myc-accent"
          style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}
        >
          Mycarium
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleUnit}
          className="text-sm font-medium px-2.5 py-1 rounded border border-myc-cream/30 dark:border-myc-teal-deep/60 text-myc-cream hover:bg-myc-cream/10 dark:text-myc-muted-dark dark:hover:bg-myc-teal-deep/30 dark:hover:text-myc-accent transition-colors"
          aria-label={`Switch to ${unit === "C" ? "Fahrenheit" : "Celsius"}`}
        >
          &deg;{unit}
        </button>
        <button
          onClick={toggleTheme}
          className="text-sm px-2.5 py-1 rounded border border-myc-cream/30 dark:border-myc-teal-deep/60 text-myc-cream hover:bg-myc-cream/10 dark:text-myc-muted-dark dark:hover:bg-myc-teal-deep/30 dark:hover:text-myc-accent transition-colors"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}"}
        </button>
        <button
          onClick={logout}
          className="text-sm bg-myc-brown-warm/60 hover:bg-myc-brown-warm/80 dark:bg-myc-teal-deep/50 dark:hover:bg-myc-teal-deep px-3 py-1 rounded transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
