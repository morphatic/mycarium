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
          ? "bg-orange-100 text-orange-800"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          on ? "bg-orange-500" : "bg-gray-400"
        }`}
      />
      {label} {on ? "ON" : "OFF"}
      {mode && (
        <span className="text-[10px] opacity-70">({mode})</span>
      )}
    </span>
  );
}
