import React from "react";

interface NutritionLabelProps {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Display variant: 'inline' for horizontal, 'stacked' for vertical */
  variant?: "inline" | "stacked" | "compact";
  /** Show labels like "kcal", "prot" */
  showUnits?: boolean;
  /** Size: 'sm', 'md', 'lg' */
  size?: "sm" | "md" | "lg";
}

/**
 * Consistent nutrition display with standard colors:
 * - Calories: amber
 * - Protein: rose
 * - Carbs: indigo
 * - Fat: orange
 */
export function NutritionLabel({
  calories,
  protein,
  carbs,
  fat,
  variant = "inline",
  showUnits = true,
  size = "md",
}: NutritionLabelProps) {
  const sizeClasses = {
    sm: { value: "text-xs", unit: "text-[9px]", gap: "gap-2" },
    md: { value: "text-sm", unit: "text-[10px]", gap: "gap-3" },
    lg: { value: "text-lg", unit: "text-xs", gap: "gap-4" },
  }[size];

  const items = [
    {
      value: calories,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      unit: "kcal",
      key: "cal",
    },
    {
      value: protein,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      unit: "g prot",
      key: "prot",
    },
    {
      value: carbs,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      unit: "g kolh",
      key: "carb",
    },
    {
      value: fat,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      unit: "g fett",
      key: "fat",
    },
  ].filter((item) => item.value !== undefined);

  if (variant === "compact") {
    return (
      <div className={`flex items-center ${sizeClasses.gap}`}>
        {items.map((item) => (
          <span key={item.key} className="text-slate-400">
            <span className={`font-bold ${item.color}`}>
              {Math.round(item.value!)}
            </span>
            {showUnits && (
              <span className={`ml-0.5 ${sizeClasses.unit} text-slate-500`}>
                {item.unit}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center justify-between px-2 py-1 rounded ${item.bg}`}
          >
            <span
              className={`${sizeClasses.unit} text-slate-400 uppercase font-bold`}
            >
              {item.key === "cal"
                ? "Kalorier"
                : item.key === "prot"
                ? "Protein"
                : item.key === "carb"
                ? "Kolhydrater"
                : "Fett"}
            </span>
            <span className={`${sizeClasses.value} font-bold ${item.color}`}>
              {Math.round(item.value!)}
              {showUnits && ` ${item.unit}`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Default: inline
  return (
    <div className={`flex items-center ${sizeClasses.gap}`}>
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex items-center ${
            sizeClasses.gap.replace("gap-", "gap-0.5")
          }`}
        >
          <span className={`${sizeClasses.value} font-bold ${item.color}`}>
            {Math.round(item.value!)}
          </span>
          {showUnits && (
            <span className={`${sizeClasses.unit} text-slate-400`}>
              {item.unit}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
