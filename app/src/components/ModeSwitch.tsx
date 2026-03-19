interface ModeSwitchProps {
  label: string;
  mode: "auto" | "manual";
  on: boolean;
  onModeChange: (mode: "auto" | "manual") => void;
  onToggle: (on: boolean) => void;
}

export function ModeSwitch({
  label,
  mode,
  on,
  onModeChange,
  onToggle,
}: ModeSwitchProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-myc-text dark:text-myc-text-dark">
          {label}
        </span>
        <button
          onClick={() => onModeChange(mode === "auto" ? "manual" : "auto")}
          className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
            mode === "auto"
              ? "bg-myc-teal/10 text-myc-teal-deep dark:bg-myc-accent/10 dark:text-myc-accent"
              : "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
          }`}
        >
          {mode === "auto" ? "Auto" : "Manual"}
        </button>
      </div>
      {mode === "manual" && (
        <div className="flex items-center gap-3 pl-2">
          <span className="text-xs text-myc-muted dark:text-myc-muted-dark">
            Power
          </span>
          <button
            onClick={() => onToggle(!on)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              on
                ? "bg-orange-400 dark:bg-orange-500"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
            role="switch"
            aria-checked={on}
            aria-label={`Turn ${label.toLowerCase()} ${on ? "off" : "on"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                on ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${
            on
              ? "text-orange-600 dark:text-orange-400"
              : "text-gray-500 dark:text-gray-400"
          }`}>
            {on ? "ON" : "OFF"}
          </span>
        </div>
      )}
    </div>
  );
}
