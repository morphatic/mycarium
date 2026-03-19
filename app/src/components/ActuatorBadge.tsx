interface ActuatorBadgeProps {
  label: string;
  on: boolean;
  mode?: string;
}

export function ActuatorBadge({ label, on, mode }: ActuatorBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
        on
          ? "bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300"
          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
      }`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          on ? "bg-orange-500 dark:bg-orange-400" : "bg-gray-400 dark:bg-gray-600"
        }`}
      />
      {label} {on ? "ON" : "OFF"}
      {mode && (
        <span className="text-[10px] opacity-70">({mode})</span>
      )}
    </span>
  );
}
