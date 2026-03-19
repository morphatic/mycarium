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
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium w-16 text-myc-text dark:text-myc-text-dark">
        {label}
      </span>
      <button
        onClick={() => onModeChange(mode === "auto" ? "manual" : "auto")}
        className={`text-xs px-2 py-1 rounded ${
          mode === "auto"
            ? "bg-myc-teal/10 text-myc-teal-deep dark:bg-myc-accent/10 dark:text-myc-accent"
            : "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
        }`}
      >
        {mode}
      </button>
      {mode === "manual" && (
        <button
          onClick={() => onToggle(!on)}
          className={`text-xs px-2 py-1 rounded ${
            on
              ? "bg-orange-200 dark:bg-orange-900/30 text-orange-900 dark:text-orange-300"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
        >
          {on ? "ON" : "OFF"}
        </button>
      )}
    </div>
  );
}
