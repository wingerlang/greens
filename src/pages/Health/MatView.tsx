import React from "react";
import { DaySnapshot, HealthStats } from "../../utils/healthAggregator.ts";
import { useSettings } from "../../context/SettingsContext.tsx";

interface MatViewProps {
  stats: HealthStats;
  snapshots: DaySnapshot[];
}

export function MatView({ stats, snapshots }: MatViewProps) {
  const { settings } = useSettings();

  const isGoalAchieved = (type: "calories") => {
    const goal = settings.dailyCalorieGoal || 2000;
    const diff = Math.abs(
      (stats.totalCalories / (snapshots.length || 1)) - goal,
    );
    return diff < goal * 0.15;
  };

  const caloriesPerDay = Math.round(
    stats.totalCalories / (snapshots.length || 1),
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Energy Overview Card */}
      <div
        className={`glass border-l-4 p-6 rounded-2xl flex items-center justify-between ${
          isGoalAchieved("calories")
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-slate-700 bg-slate-900/50"
        }`}
      >
        <div>
          <h2 className="text-2xl font-black text-white mb-1">
            Energi & Kalorier
          </h2>
          <p className="text-xs text-slate-400 uppercase font-bold">
            Genomsnittligt intag
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-2 justify-end">
            <span className="text-4xl font-black text-white">
              {caloriesPerDay}
            </span>
            <span className="text-sm font-bold text-slate-500">kcal / dag</span>
          </div>
          {settings.dailyCalorieGoal && (
            <p className="text-xs text-slate-500 mt-1">
              Mål: {settings.dailyCalorieGoal} kcal
            </p>
          )}
        </div>
      </div>
      {/* Vegan Vitality Card */}
      <div className="bg-slate-900/50 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black text-emerald-400">
              Vegan Vitality
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              Kritiska mikronäringsämnen
            </p>
          </div>
          <div className="text-4xl opacity-20">🛡️</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(stats.vitaminCoverage)
            .filter(([key]) =>
              ["iron", "vitaminB12", "calcium", "zinc"].includes(key)
            )
            .map(([key, val]) => {
              const labels: Record<string, string> = {
                iron: "Järn",
                vitaminB12: "B12",
                calcium: "Kalcium",
                zinc: "Zink",
              };

              return (
                <div
                  key={key}
                  className="bg-slate-900/50 rounded-xl p-4 border border-white/5"
                >
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-slate-300">
                      {labels[key] || key}
                    </span>
                    <span
                      className={`text-lg font-black ${
                        val >= 100 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {val}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        val < 50
                          ? "bg-rose-500"
                          : val < 90
                          ? "bg-amber-500"
                          : val < 150
                          ? "bg-emerald-500"
                          : "bg-sky-500"
                      }`}
                      style={{ width: `${Math.min(100, (val / 150) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>

        <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
          <span className="text-2xl">✨</span>
          <div className="text-sm text-emerald-200">
            Ditt "Greens Shield" är på{" "}
            <span className="font-bold text-white text-lg mx-1">
              {Math.round(
                (stats.vitaminCoverage.iron +
                  stats.vitaminCoverage.vitaminB12 +
                  stats.vitaminCoverage.calcium +
                  stats.vitaminCoverage.zinc) / 4,
              )}%
            </span>.
            {(stats.vitaminCoverage.vitaminB12 < 50) && (
              <span className="text-amber-300 font-bold ml-1 block mt-1">
                ⚠️ Kom ihåg B12-tillskott!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
