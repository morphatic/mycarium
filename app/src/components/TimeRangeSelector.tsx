export type TimeRange = "1h" | "3h" | "6h" | "12h" | "24h" | "7d" | "30d";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "3h", label: "3h" },
  { value: "6h", label: "6h" },
  { value: "12h", label: "12h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

export function timeRangeToSeconds(range: TimeRange): number {
  switch (range) {
    case "1h":
      return 3600;
    case "3h":
      return 10800;
    case "6h":
      return 21600;
    case "12h":
      return 43200;
    case "24h":
      return 86400;
    case "7d":
      return 604800;
    case "30d":
      return 2592000;
  }
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {ranges.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`text-xs px-3 py-1 rounded ${
            value === r.value
              ? "bg-myc-teal dark:bg-myc-teal-deep text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
