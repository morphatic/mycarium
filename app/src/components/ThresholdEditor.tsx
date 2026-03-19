import { useEffect, useState } from "react";

interface ThresholdEditorProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Minimum allowed gap between min and max (accounts for sensor accuracy) */
  minGap?: number;
  pending?: boolean;
  onSave: (min: number, max: number) => void;
}

/** Round to 1 decimal place and strip trailing zeroes */
function formatVal(n: number): string {
  return parseFloat(n.toFixed(1)).toString();
}

export function ThresholdEditor({
  label,
  unit,
  min,
  max,
  minGap = 0,
  pending,
  onSave,
}: ThresholdEditorProps) {
  const [minVal, setMinVal] = useState(formatVal(min));
  const [maxVal, setMaxVal] = useState(formatVal(max));
  const [error, setError] = useState<string | null>(null);

  // Sync inputs when device reports updated bounds
  useEffect(() => { setMinVal(formatVal(min)); }, [min]);
  useEffect(() => { setMaxVal(formatVal(max)); }, [max]);

  const handleSave = () => {
    const parsedMin = parseFloat(minVal);
    const parsedMax = parseFloat(maxVal);

    if (isNaN(parsedMin) || isNaN(parsedMax)) {
      setError("Enter valid numbers");
      return;
    }
    if (parsedMax <= parsedMin) {
      setError("Maximum must be greater than minimum");
      return;
    }
    if (minGap > 0 && parsedMax - parsedMin < minGap) {
      setError(`Range must be at least ${formatVal(minGap)}${unit} (sensor accuracy)`);
      return;
    }

    setError(null);
    onSave(parsedMin, parsedMax);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-myc-text dark:text-myc-text-dark">
          {label}
        </p>
        {pending && (
          <span className="text-[10px] text-myc-muted dark:text-myc-muted-dark italic animate-pulse">
            waiting for device...
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-myc-muted dark:text-myc-muted-dark">
          Min
          <input
            type="number"
            step="0.1"
            value={minVal}
            onChange={(e) => setMinVal(e.target.value)}
            className="block w-20 border border-myc-cream dark:border-myc-teal-deep/40 rounded px-2 py-1 text-sm mt-0.5 bg-white dark:bg-myc-bg-dark dark:text-myc-text-dark"
          />
        </label>
        <label className="text-xs text-myc-muted dark:text-myc-muted-dark">
          Max
          <input
            type="number"
            step="0.1"
            value={maxVal}
            onChange={(e) => setMaxVal(e.target.value)}
            className="block w-20 border border-myc-cream dark:border-myc-teal-deep/40 rounded px-2 py-1 text-sm mt-0.5 bg-white dark:bg-myc-bg-dark dark:text-myc-text-dark"
          />
        </label>
        <span className="text-xs text-myc-muted dark:text-myc-muted-dark self-end pb-1">
          {unit}
        </span>
        <button
          onClick={handleSave}
          className="self-end text-sm bg-myc-teal dark:bg-myc-teal-deep text-white px-3 py-1 rounded hover:bg-myc-teal-mid dark:hover:bg-myc-teal"
        >
          Set
        </button>
      </div>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
