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
      <span className="text-sm font-medium w-16">{label}</span>
      <button
        onClick={() => onModeChange(mode === "auto" ? "manual" : "auto")}
        className={`text-xs px-2 py-1 rounded ${
          mode === "auto"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        {mode}
      </button>
      {mode === "manual" && (
        <button
          onClick={() => onToggle(!on)}
          className={`text-xs px-2 py-1 rounded ${
            on
              ? "bg-orange-200 text-orange-900"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          {on ? "ON" : "OFF"}
        </button>
      )}
    </div>
  );
}
