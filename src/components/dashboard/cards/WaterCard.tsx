import React from "react";
import { Check, Droplets } from "lucide-react";
import type { WaterCardProps } from "../dashboard.types.ts";

/**
 * Water intake tracking card.
 * Shows current water glasses and allows quick-click to adjust.
 */
export const WaterCard = ({
  density,
  waterGoal,
  currentWater,
  isEditing,
  tempValue,
  onCardClick,
  onValueChange,
  onSave,
  onKeyDown,
  onQuickClick,
}: WaterCardProps) => {
  const isWaterMet = currentWater >= waterGoal;

  return (
    <div
      onClick={onCardClick}
      className={`${
        density === "compact" ? "p-2.5 rounded-2xl" : "p-4 rounded-3xl"
      } border shadow-sm hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden ${
        isWaterMet
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50"
          : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800"
      }`}
    >
      <div
        className={`flex items-center ${
          density === "compact" ? "gap-1.5 mb-1" : "gap-2 mb-2"
        }`}
      >
        <div
          className={`p-1.5 rounded-full ${
            isWaterMet
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600"
              : "bg-blue-50 dark:bg-blue-900/30 text-blue-500"
          }`}
        >
          {isWaterMet
            ? (
              <Check
                className={density === "compact" ? "w-3 h-3" : "w-4 h-4"}
              />
            )
            : (
              <Droplets
                className={density === "compact" ? "w-3 h-3" : "w-4 h-4"}
              />
            )}
        </div>
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
          Vatten
        </span>
      </div>
      <div className="flex-1">
        {isEditing
          ? (
            <div
              className="flex items-baseline gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="number"
                value={tempValue}
                onChange={(e) => onValueChange(e.target.value)}
                onBlur={onSave}
                onKeyDown={onKeyDown}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-[9px] font-bold text-slate-400 uppercase">
                Glas
              </span>
            </div>
          )
          : (
            <>
              <div className="flex items-baseline gap-1">
                <span
                  className={`${
                    density === "compact" ? "text-xl" : "text-3xl"
                  } font-bold ${
                    isWaterMet
                      ? "text-emerald-600"
                      : "text-slate-900 dark:text-white"
                  }`}
                >
                  {currentWater}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  Glas
                </span>
              </div>
              <div
                className={`flex gap-0.5 mt-2 ${
                  density === "compact" ? "h-4" : "h-8"
                }`}
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickClick(i + 1);
                    }}
                    className={`flex-1 rounded-sm cursor-pointer transition-all border border-transparent ${
                      i < currentWater
                        ? (isWaterMet
                          ? "bg-emerald-500"
                          : "bg-blue-400 shadow-sm")
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
      </div>
    </div>
  );
};
