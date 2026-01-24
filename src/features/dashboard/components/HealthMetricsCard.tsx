import React, { useState } from "react";
import { ChevronRight, Target, X } from "lucide-react";
import { WeightTrendChart } from "../../../components/charts/WeightTrendChart.tsx";

// Helper functions (moved from DashboardPage)
const getBMICategory = (bmi: number) => {
  if (bmi < 18.5) {
    return {
      label: "Undervikt",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    };
  }
  if (bmi < 25) {
    return {
      label: "Normalvikt",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    };
  }
  if (bmi < 30) {
    return {
      label: "Övervikt",
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    };
  }
  return { label: "Fetma", color: "text-rose-500", bg: "bg-rose-500/10" };
};

const getRelativeDateLabel = (dateStr: string) => {
  const today = new Date().toISOString().split("T")[0];
  const d = new Date(dateStr).toISOString().split("T")[0];
  if (d === today) return "idag";
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (d === yesterday) return "igår";

  // Calculate diff in days
  const diff = Math.floor(
    (new Date(today).getTime() - new Date(d).getTime()) / 86400000,
  );
  if (diff < 7) return `${diff} dgr sen`;
  if (diff < 30) return `${Math.floor(diff / 7)} v. sen`;
  return dateStr;
};

interface HealthMetricsCardProps {
  density: string;
  latestWeightVal: number;
  latestWaist?: number;
  latestChest?: number;
  bmi: number | null;
  weightDiffRange: number;
  weightRange: "7d" | "14d" | "30d" | "3m" | "1y" | "year" | "all";
  setWeightRange: (
    range: "7d" | "14d" | "30d" | "3m" | "1y" | "year" | "all",
  ) => void;
  weightTrendEntries: any[]; // Using any[] to match usage, ideally strict types
  unifiedHistory: any[];
  onOpenWeightModal: (
    data: { weight?: number; waist?: number; chest?: number; date?: string },
  ) => void;
}

export const HealthMetricsCard: React.FC<HealthMetricsCardProps> = ({
  density,
  latestWeightVal,
  latestWaist,
  latestChest,
  bmi,
  weightDiffRange,
  weightRange,
  setWeightRange,
  weightTrendEntries,
  unifiedHistory,
  onOpenWeightModal,
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  return (
    <div
      className={`col-span-1 md:col-span-12 ${
        density === "compact" ? "p-1" : "p-0"
      } rounded-3xl`}
    >
      <div
        className={`h-full ${
          density === "compact" ? "p-2" : "p-6"
        } bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col`}
      >
        <div className="relative z-10 flex flex-col h-full">
          {/* Header with Title and Range Selector */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                  Hälsomått
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {(latestWeightVal || 0).toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-slate-500">kg</span>
                </div>
              </div>

              {/* Trend integrated into header */}
              <div className="border-l border-slate-100 dark:border-white/5 pl-4 flex flex-col justify-center">
                <div
                  className={`text-[10px] font-black uppercase ${
                    weightDiffRange < -0.5
                      ? "text-emerald-500"
                      : weightDiffRange > 0.5
                      ? "text-rose-500"
                      : "text-slate-500"
                  }`}
                >
                  {weightDiffRange < -0.5
                    ? "Minskande"
                    : weightDiffRange > 0.5
                    ? "Ökande"
                    : "Stabil"}
                </div>
                <div
                  className={`text-[9px] font-bold ${
                    weightDiffRange <= 0 ? "text-emerald-500" : "text-rose-500"
                  } opacity-80`}
                >
                  {weightDiffRange > 0 ? "+" : ""}
                  {weightDiffRange.toFixed(1)} kg
                </div>
              </div>
            </div>

            {/* Range Selectors */}
            <div className="flex bg-slate-100 dark:bg-slate-800/50 p-0.5 rounded-lg">
              {(["7d", "14d", "30d", "3m", "1y", "year", "all"] as const).map((
                r,
              ) => (
                <button
                  key={r}
                  onClick={() => setWeightRange(r)}
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all ${
                    weightRange === r
                      ? "bg-white dark:bg-slate-700 text-blue-500 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {r === "all"
                    ? "All"
                    : r === "year"
                    ? "i år"
                    : r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {/* Current Weight Detail */}
            <div
              className="cursor-pointer group/stat flex flex-col justify-center"
              onClick={() => {
                onOpenWeightModal({
                  weight: unifiedHistory[0]?.weight,
                  waist: latestWaist,
                  chest: latestChest,
                  // No date passed to avoid switching context
                });
              }}
            >
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Vikt
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-blue-500">
                {(latestWeightVal || 0).toFixed(1)}
                <span className="text-[10px] ml-0.5 opacity-50 font-bold">
                  kg
                </span>
              </div>
            </div>

            {/* Waist Detail */}
            <div
              className="cursor-pointer group/stat border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center"
              onClick={() => {
                onOpenWeightModal({
                  weight: unifiedHistory[0]?.weight,
                  waist: latestWaist,
                  chest: latestChest,
                });
              }}
            >
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Midja
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-emerald-500">
                {latestWaist || "--"}
                <span className="text-[10px] ml-0.5 opacity-50 font-bold">
                  cm
                </span>
              </div>
            </div>

            {/* Chest (Bröst) */}
            <div
              className="border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center hidden md:flex cursor-pointer"
              onClick={() => {
                onOpenWeightModal({
                  weight: unifiedHistory[0]?.weight,
                  waist: latestWaist,
                  chest: latestChest,
                });
              }}
            >
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Bröst
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {latestChest || "--"}
                <span className="text-[10px] ml-0.5 opacity-50 font-bold">
                  cm
                </span>
              </div>
            </div>

            {/* BMI Meter */}
            <div className="border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                BMI
              </div>
              {bmi
                ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xl font-black transition-colors ${
                        getBMICategory(bmi).color
                      }`}
                    >
                      {bmi.toFixed(1)}
                    </span>
                    <div
                      className={`p-1 rounded-md ${getBMICategory(bmi).bg} ${
                        getBMICategory(bmi).color
                      }`}
                    >
                      <Target size={10} />
                    </div>
                  </div>
                )
                : <div className="text-[8px] text-slate-500 italic">--</div>}
            </div>
          </div>

          {/* Sparkline Visual */}
          <div className="bg-slate-50 dark:bg-white/[0.02] rounded-3xl p-4 border border-slate-100 dark:border-white/5 relative w-full">
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none overflow-hidden">
              <span className="text-[120px] leading-none">⚖️</span>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 relative z-10">
              Trendkurva
            </div>
            <div className="h-64 aspect-[3/1] w-full relative z-10">
              <WeightTrendChart
                entries={weightTrendEntries.map((e, i) => ({
                  id: `entry-${i}`,
                  date: e.date,
                  weight: e.weight || 0,
                  waist: e.waist,
                  chest: e.chest,
                  createdAt: e.date,
                }))}
                currentWeight={latestWeightVal || 0}
                hideHeader={true}
                onEntryClick={(entry) => {
                  onOpenWeightModal({
                    weight: entry.weight > 0 ? entry.weight : undefined,
                    waist: entry.waist,
                    chest: entry.chest,
                    date: entry.date,
                  });
                }}
              />
            </div>
          </div>

          {/* Footer / Latest 3 */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Senaste historik
              </div>
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-95"
                title={showAllHistory ? "Visa färre" : "Visa fler"}
              >
                {showAllHistory
                  ? <X size={12} />
                  : <div className="text-sm font-bold mt-[-1px]">+</div>}
              </button>
            </div>
            <div
              className={`grid grid-cols-2 gap-2 ${
                showAllHistory
                  ? "max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"
                  : ""
              }`}
            >
              {(showAllHistory ? unifiedHistory : unifiedHistory.slice(0, 4))
                .map((w) => (
                  <div
                    key={w.id}
                    className="px-3 py-2 bg-white dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between group/item hover:border-blue-500/30 transition-all cursor-pointer"
                    onClick={() => {
                      onOpenWeightModal({
                        weight: w.weight,
                        waist: w.waist,
                        chest: w.chest,
                        date: w.date,
                      });
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase min-w-[60px]">
                        {getRelativeDateLabel(w.date)}
                      </span>
                      <div className="flex items-center flex-wrap gap-x-2">
                        {w.weight
                          ? (
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {w.weight.toFixed(1)}{" "}
                              <span className="text-[10px] text-slate-400">
                                kg
                              </span>
                            </span>
                          )
                          : (
                            <span className="text-[10px] font-bold text-slate-300 italic">
                              Ingen vikt
                            </span>
                          )}

                        {w.waist && (
                          <>
                            <span className="text-slate-200 dark:text-slate-700">
                              |
                            </span>
                            <span className="text-sm font-bold text-emerald-500">
                              {w.waist}{" "}
                              <span className="text-[10px] font-normal opacity-70">
                                cm (midja)
                              </span>
                            </span>
                          </>
                        )}

                        {w.chest && (
                          <>
                            <span className="text-slate-200 dark:text-slate-700">
                              |
                            </span>
                            <span className="text-sm font-bold text-indigo-500">
                              {w.chest}{" "}
                              <span className="text-[10px] font-normal opacity-70">
                                cm (bröst)
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      size={12}
                      className="text-slate-300 group-hover/item:text-blue-500 transition-colors"
                    />
                  </div>
                ))}
              {unifiedHistory.length === 0 && (
                <div className="col-span-1 text-center py-4 text-xs text-slate-400 italic">
                  Ingen historik tillgänglig ännu.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
