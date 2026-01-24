import React, { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { useSettings } from "../../context/SettingsContext";
import { calculateGoalProgress } from "../../utils/goalCalculations";
import { mapUniversalToLegacyEntry } from "../../utils/mappers";
import { GoalDetailModal } from "./GoalDetailModal";
import { GoalProgressRing } from "./GoalProgressRing";

export function GoalsOverviewWidget() {
  const { performanceGoals: goals, universalActivities, weightEntries } =
    useData();
  const { settings } = useSettings();
  const density = settings.densityMode || "cozy";
  const [selectedGoal, setSelectedGoal] = useState<any>(null);

  // Calculate progress for all active goals
  const activeGoals = useMemo(() => {
    // Map universal activities to legacy format for calculation
    const mappedActivities = universalActivities
      .map(mapUniversalToLegacyEntry)
      .filter((e: any): e is any => e !== null);

    return (goals || [])
      .filter((g: any) => g.status === "active")
      .map((goal: any) => {
        const progress = calculateGoalProgress(
          goal,
          mappedActivities,
          [],
          [],
          [],
          weightEntries,
        );
        return { ...goal, progress };
      })
      .sort((a, b) => {
        // Sort by: nearing completion, then nearing deadline
        const aNear = a.progress.percentage;
        const bNear = b.progress.percentage;
        return bNear - aNear;
      });
  }, [goals, universalActivities, weightEntries]);

  if (activeGoals.length === 0) return null;

  return (
    <div
      className={`col-span-12 md:col-span-6 lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm ${
        density === "compact" ? "p-2" : "p-6"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className={`${
            density === "compact" ? "text-[10px]" : "text-sm"
          } font-black uppercase tracking-tighter text-slate-400 flex items-center gap-2`}
        >
          <div className="w-1 h-3 bg-emerald-500 rounded-full" />
          Aktiva Mål
        </h3>
        <a
          href="/goals"
          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          Visa alla →
        </a>
      </div>

      <div
        className={`flex flex-col ${density === "compact" ? "gap-1" : "gap-3"}`}
      >
        {activeGoals.slice(0, 3).map((goal) => (
          <div
            key={goal.id}
            onClick={() => setSelectedGoal(goal)}
            className={`group relative overflow-hidden bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer rounded-2xl border border-slate-200/50 dark:border-slate-700/30 ${
              density === "compact" ? "p-2" : "p-3"
            }`}
          >
            <div className="flex items-center gap-3 relative z-10">
              <GoalProgressRing
                percentage={goal.progress.percentage}
                size={density === "compact" ? 32 : 40}
                strokeWidth={density === "compact" ? 3 : 4}
                color={goal.color || "#10b981"}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4
                    className={`${
                      density === "compact" ? "text-xs" : "text-sm"
                    } font-bold text-slate-900 dark:text-white truncate`}
                  >
                    {goal.name}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(goal.progress.percentage &&
                        !isNaN(goal.progress.percentage))
                      ? goal.progress.percentage.toFixed(0)
                      : 0}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium truncate">
                  <span>
                    {goal.type === "speed" ? "Snabbt" : "Mål"}:{" "}
                    {goal.progress.target} {goal.targets[0]?.unit}
                  </span>
                  {goal.endDate && (
                    <>
                      <span className="opacity-30">•</span>
                      <span
                        className={goal.progress.daysRemaining &&
                            goal.progress.daysRemaining < 7
                          ? "text-amber-500"
                          : ""}
                      >
                        {goal.progress.daysRemaining} dgr kvar
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-colors">
                →
              </div>
            </div>

            {/* Progress Bar Background */}
            <div
              className="absolute bottom-0 left-0 h-0.5 bg-emerald-500/20"
              style={{
                width: `${
                  (goal.progress.percentage && !isNaN(goal.progress.percentage))
                    ? Math.min(100, goal.progress.percentage)
                    : 0
                }%`,
                backgroundColor: goal.color,
              }}
            />
          </div>
        ))}
      </div>

      {selectedGoal && (
        <GoalDetailModal
          goal={selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onEdit={() => {/* Not imp here */}}
        />
      )}
    </div>
  );
}
