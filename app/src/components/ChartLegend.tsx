import { useState, useCallback, type RefObject } from "react";
import type { Chart as ChartJS } from "chart.js";
import { LINKED_LABELS } from "./HistoryChart";

export interface LegendItem {
  label: string;
  displayLabel: string;
  color: string;
  pointStyle?: "triangle" | "rectRot" | "line" | "dash";
}

export interface LegendGroup {
  name: string;
  color: string;
  items: LegendItem[];
}

/** Temperature group — label depends on current unit */
export function TEMP_GROUP(unit: "C" | "F"): LegendGroup {
  return {
    name: "Temperature",
    color: "#dc2626",
    items: [
      { label: `Temp (\u00B0${unit})`, displayLabel: "Trend", color: "#dc2626", pointStyle: "line" },
      { label: "Temp range", displayLabel: "Range", color: "rgba(220,38,38,0.5)", pointStyle: "dash" },
      { label: "Heater ON", displayLabel: "Heater ON", color: "#ea580c", pointStyle: "triangle" },
      { label: "Heater OFF", displayLabel: "Heater OFF", color: "#ea580c", pointStyle: "rectRot" },
    ],
  };
}

export const HUMIDITY_GROUP: LegendGroup = {
  name: "Humidity",
  color: "#2563eb",
  items: [
    { label: "Humidity (%)", displayLabel: "Trend", color: "#2563eb", pointStyle: "line" },
    { label: "Humidity range", displayLabel: "Range", color: "rgba(37,99,235,0.45)", pointStyle: "dash" },
    { label: "Fogger ON", displayLabel: "Fogger ON", color: "#3b82f6", pointStyle: "triangle" },
    { label: "Fogger OFF", displayLabel: "Fogger OFF", color: "#3b82f6", pointStyle: "rectRot" },
  ],
};

interface ChartLegendProps {
  chartRef: RefObject<ChartJS<"line"> | null>;
  hiddenLabels: RefObject<Set<string>>;
  groups: LegendGroup[];
  isDark: boolean;
}

function toggleLabel(
  chart: ChartJS<"line">,
  label: string,
  hidden: boolean,
  hiddenLabels: Set<string>,
) {
  const idx = chart.data.datasets.findIndex((ds) => ds.label === label);
  if (idx < 0) return;
  chart.getDatasetMeta(idx).hidden = hidden;
  if (hidden) {
    hiddenLabels.add(label);
  } else {
    hiddenLabels.delete(label);
  }

  // Handle linked labels (range min/max pairs)
  const linked = LINKED_LABELS[label];
  if (linked) {
    const linkedIdx = chart.data.datasets.findIndex((ds) => ds.label === linked);
    if (linkedIdx >= 0) {
      chart.getDatasetMeta(linkedIdx).hidden = hidden;
      if (hidden) {
        hiddenLabels.add(linked);
      } else {
        hiddenLabels.delete(linked);
      }
    }
  }
}

function PointStyleIcon({ style, color }: { style?: string; color: string }) {
  const size = 14;
  if (style === "triangle") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <polygon points="7,2 12,12 2,12" fill={color} />
      </svg>
    );
  }
  if (style === "rectRot") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <rect x="3" y="3" width="8" height="8" fill={color} transform="rotate(45 7 7)" />
      </svg>
    );
  }
  if (style === "dash") {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14">
        <line x1="0" y1="7" x2="14" y2="7" stroke={color} strokeWidth="2" strokeDasharray="4 2" />
      </svg>
    );
  }
  // "line" or default
  return (
    <svg width={size} height={size} viewBox="0 0 14 14">
      <line x1="0" y1="7" x2="14" y2="7" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function ChartLegend({ chartRef, hiddenLabels, groups, isDark }: ChartLegendProps) {
  const [, forceUpdate] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const isHidden = useCallback(
    (label: string) => hiddenLabels.current.has(label),
    [hiddenLabels],
  );

  const isGroupHidden = useCallback(
    (group: LegendGroup) => group.items.every((item) => isHidden(item.label)),
    [isHidden],
  );

  const isGroupPartial = useCallback(
    (group: LegendGroup) => {
      const hiddenCount = group.items.filter((item) => isHidden(item.label)).length;
      return hiddenCount > 0 && hiddenCount < group.items.length;
    },
    [isHidden],
  );

  const handleItemClick = useCallback(
    (label: string) => {
      const chart = chartRef.current;
      if (!chart) return;
      const hidden = !isHidden(label);
      toggleLabel(chart, label, hidden, hiddenLabels.current);
      chart.update();
      forceUpdate((n) => n + 1);
    },
    [chartRef, hiddenLabels, isHidden],
  );

  const handleGroupClick = useCallback(
    (group: LegendGroup) => {
      const chart = chartRef.current;
      if (!chart) return;
      const allHidden = isGroupHidden(group);
      const newHidden = !allHidden;
      for (const item of group.items) {
        toggleLabel(chart, item.label, newHidden, hiddenLabels.current);
      }
      chart.update();
      forceUpdate((n) => n + 1);
    },
    [chartRef, hiddenLabels, isGroupHidden],
  );

  const toggleExpanded = useCallback((name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  return (
    <div className="flex flex-col gap-1">
      {groups.map((group) => {
        const groupHidden = isGroupHidden(group);
        const groupPartial = isGroupPartial(group);
        const isOpen = expanded[group.name] ?? true;

        return (
          <div key={group.name}>
            {/* Group header */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleExpanded(group.name)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-myc-muted dark:text-myc-muted-dark"
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.name}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                >
                  <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleGroupClick(group)}
                className={`min-h-[44px] flex items-center gap-2 px-2 rounded text-sm font-medium transition-opacity ${
                  groupHidden ? "opacity-40" : ""
                } text-myc-text dark:text-myc-text-dark`}
                aria-label={`Toggle all ${group.name} series`}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor: groupHidden ? "transparent" : (isDark ? group.color : group.color),
                    border: `2px solid ${group.color}`,
                    opacity: groupPartial ? 0.6 : 1,
                  }}
                />
                {group.name}
              </button>
            </div>

            {/* Individual items */}
            {isOpen && (
              <div className="flex flex-wrap gap-x-1 pl-11">
                {group.items.map((item) => {
                  const hidden = isHidden(item.label);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleItemClick(item.label)}
                      className={`min-h-[44px] flex items-center gap-1.5 px-2 rounded text-xs transition-opacity ${
                        hidden ? "opacity-30" : ""
                      } text-myc-text dark:text-myc-text-dark`}
                      aria-label={`Toggle ${item.displayLabel}`}
                    >
                      <PointStyleIcon
                        style={item.pointStyle}
                        color={isDark ? item.color : item.color}
                      />
                      <span className={hidden ? "line-through" : ""}>
                        {item.displayLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
