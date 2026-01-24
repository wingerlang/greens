import React from "react";
import { Moon } from "lucide-react";
import type { SleepCardProps } from "../dashboard.types.ts";

const sleepColorMap: Record<string, { text: string; accent: string }> = {
  rose: { text: "text-rose-600", accent: "accent-rose-500" },
  red: { text: "text-red-600", accent: "accent-red-500" },
  amber: { text: "text-amber-600", accent: "accent-amber-500" },
  green: { text: "text-green-600", accent: "accent-green-500" },
  emerald: { text: "text-emerald-600", accent: "accent-emerald-500" },
  blue: { text: "text-blue-600", accent: "accent-blue-500" },
  slate: { text: "text-slate-600", accent: "accent-slate-500" },
};

/**
 * Sleep tracking card.
 * Shows sleep hours with color-coded status indicator.
 */
export const SleepCard = ({
  density,
  currentSleep,
  sleepInfo,
  isEditing,
  tempValue,
  onCardClick,
  onValueChange,
  debouncedSave,
  setVitals,
  setEditing,
}: SleepCardProps) => {
  const sleepClasses = currentSleep > 0
    ? (sleepColorMap[sleepInfo.color] || sleepColorMap.slate)
    : sleepColorMap.slate;
  const sleepColorClass = sleepClasses.text;

  const getBackgroundClass = () => {
    if (currentSleep > 0 && currentSleep < 5) {
      return "bg-rose-50 dark:bg-rose-900/10";
    }
    if (currentSleep >= 5 && currentSleep < 7) {
      return "bg-amber-50 dark:bg-amber-900/10";
    }
    if (currentSleep >= 7 && currentSleep <= 10) {
      return "bg-emerald-50 dark:bg-emerald-900/20";
    }
    return "bg-white dark:bg-slate-900";
  };

  const getIconClass = () => {
    if (currentSleep > 0 && currentSleep < 5) {
      return "bg-rose-100 text-rose-600";
    }
    if (currentSleep >= 5 && currentSleep < 7) {
      return "bg-amber-100 text-amber-600";
    }
    return "bg-slate-100 dark:bg-slate-800 text-slate-500";
  };

  return (
    <div
      onClick={onCardClick}
      className={`${
        density === "compact" ? "p-2.5 rounded-2xl" : "p-4 rounded-3xl"
      } shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:scale-[1.01] transition-transform cursor-pointer group relative overflow-hidden h-full ${getBackgroundClass()}`}
    >
      <div
        className={`flex items-center ${
          density === "compact" ? "gap-1.5 mb-1" : "gap-2 mb-2"
        }`}
      >
        <div className={`p-1.5 rounded-full ${getIconClass()}`}>
          <Moon className={density === "compact" ? "w-3 h-3" : "w-4 h-4"} />
        </div>
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
          Sömn
        </span>
      </div>
      <div className="flex-1">
        {isEditing
          ? (
            <div
              className="flex flex-col gap-2 pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                <span className={`text-xs font-black ${sleepColorClass}`}>
                  {parseFloat(tempValue).toFixed(1)}h
                </span>
              </div>
              <input
                autoFocus
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={tempValue}
                onChange={(e) => {
                  const val = e.target.value;
                  onValueChange(val);
                  const num = parseFloat(val);
                  if (!isNaN(num)) {
                    setVitals((prev) => ({ ...prev, sleep: num }));
                    debouncedSave("sleep", num);
                  }
                }}
                onBlur={() => setEditing(null)}
                className={`w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer ${sleepClasses.accent} transition-all`}
              />
            </div>
          )
          : (
            <>
              <div className="flex items-baseline gap-1">
                <span
                  className={`${
                    density === "compact" ? "text-xl" : "text-3xl"
                  } font-bold ${sleepColorClass}`}
                >
                  {currentSleep}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  H
                </span>
              </div>
              {density !== "compact" && currentSleep > 0 && (
                <div className="mt-1 text-[8px] font-black uppercase tracking-tight opacity-60">
                  {sleepInfo.status}
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
};
