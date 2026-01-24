import React from "react";

interface MacroBarsProps {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  /** Size: 'sm', 'md' */
  size?: "sm" | "md";
}

/**
 * Macro bar progress component showing protein, carbs, fat, and calories
 * with progress bars. Extracted from Dashboard.
 */
export function MacroBars({
  calories,
  calorieGoal,
  protein,
  proteinGoal,
  carbs,
  carbsGoal,
  fat,
  fatGoal,
  size = "md",
}: MacroBarsProps) {
  const textSize = size === "sm" ? "text-sm" : "text-lg";
  const isOverCalories = calories > calorieGoal;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {/* Protein */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Protein
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={`font-black tracking-tighter ${textSize} text-slate-900 dark:text-white`}
          >
            {Math.round(protein)}
          </span>
          <span className="text-[9px] text-slate-400 font-bold">
            / {proteinGoal}g
          </span>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{
              width: `${Math.min((protein / proteinGoal) * 100, 100)}%`,
            }}
          >
          </div>
        </div>
      </div>

      {/* Carbs */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Kolh.
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={`font-black tracking-tighter ${textSize} text-slate-900 dark:text-white`}
          >
            {Math.round(carbs)}
          </span>
          <span className="text-[9px] text-slate-400 font-bold">
            / {carbsGoal}g
          </span>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${Math.min((carbs / carbsGoal) * 100, 100)}%` }}
          >
          </div>
        </div>
      </div>

      {/* Fat */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Fett
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={`font-black tracking-tighter ${textSize} text-slate-900 dark:text-white`}
          >
            {Math.round(fat)}
          </span>
          <span className="text-[9px] text-slate-400 font-bold">
            / {fatGoal}g
          </span>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${Math.min((fat / fatGoal) * 100, 100)}%` }}
          >
          </div>
        </div>
      </div>

      {/* Calories */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Kcal
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className={`font-black tracking-tighter ${textSize} ${
              isOverCalories
                ? "text-rose-500"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {Math.round(calories)}
          </span>
          <span className="text-[9px] text-slate-400 font-bold">
            / {calorieGoal}
          </span>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all ${
              isOverCalories ? "bg-rose-500" : "bg-slate-900 dark:bg-white"
            }`}
            style={{
              width: `${Math.min((calories / calorieGoal) * 100, 100)}%`,
            }}
          >
          </div>
        </div>
      </div>
    </div>
  );
}
