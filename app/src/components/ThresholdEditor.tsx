import { useEffect, useState } from "react";

interface ThresholdEditorProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  onSave: (min: number, max: number) => void;
}

export function ThresholdEditor({
  label,
  unit,
  min,
  max,
  onSave,
}: ThresholdEditorProps) {
  const [minVal, setMinVal] = useState(min.toString());
  const [maxVal, setMaxVal] = useState(max.toString());
  const [error, setError] = useState<string | null>(null);

  // Sync inputs when device reports updated bounds
  useEffect(() => { setMinVal(min.toString()); }, [min]);
  useEffect(() => { setMaxVal(max.toString()); }, [max]);

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

    setError(null);
    onSave(parsedMin, parsedMax);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-myc-text dark:text-myc-text-dark">
        {label}
      </p>
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
