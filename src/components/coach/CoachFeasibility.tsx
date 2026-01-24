import React, { useMemo } from "react";
import { useData } from "../../context/DataContext.tsx";
import {
  assessGoalFeasibility,
  calculateVDOT,
  predictWeightAdjustedVDOT,
} from "../../utils/runningCalculator.ts";

export function CoachFeasibility() {
  const { coachConfig } = useData();

  const analysis = useMemo(() => {
    if (!coachConfig || !coachConfig.goals || coachConfig.goals.length === 0) {
      return null;
    }

    const { userProfile, goals, preferences } = coachConfig;
    const activeGoal = goals.find((g) => g.isActive) || goals[0];

    // Baseline VDOT
    let currentVdot = 35;
    if (userProfile.currentForm) {
      currentVdot = calculateVDOT(
        userProfile.currentForm.distanceKm,
        userProfile.currentForm.timeSeconds,
      );
    } else if (userProfile.recentRaceTime) {
      currentVdot = calculateVDOT(
        userProfile.recentRaceTime.distance,
        userProfile.recentRaceTime.timeSeconds,
      );
    }

    // Target VDOT
    const dist = activeGoal.type === "MARATHON"
      ? 42.195
      : activeGoal.type === "HALF_MARATHON"
      ? 21.097
      : activeGoal.type === "10K"
      ? 10
      : 5;
    const targetVdot = calculateVDOT(
      dist,
      activeGoal.targetTimeSeconds ||
        (dist === 42.195
          ? 14400
          : dist === 21.097
          ? 7200
          : dist === 10
          ? 3000
          : 1320),
    );

    // Weight Adjustment
    const predictedVdot = preferences.weightGoal
      ? predictWeightAdjustedVDOT(currentVdot, 80, preferences.weightGoal) // Hardcoded 80 baseline weight for now
      : currentVdot;

    const weeks = Math.ceil(
      (new Date(activeGoal.targetDate).getTime() - new Date().getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );

    return assessGoalFeasibility(predictedVdot, targetVdot, weeks);
  }, [coachConfig]);

  if (!analysis) {
    return (
      <div className="text-center p-20 glass-card max-w-2xl mx-auto my-24 border-dashed border-white/10">
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">
          Väntar på din konfiguration...
        </p>
      </div>
    );
  }

  const probColor = analysis.probability > 0.8
    ? "text-emerald-400"
    : analysis.probability > 0.5
    ? "text-amber-400"
    : "text-rose-400";

  return (
    <div className="coach-feasibility max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10 pb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Probability Gauge */}
      <div className="lg:col-span-1 glass-card p-10 flex flex-col items-center justify-center text-center bg-gradient-to-b from-slate-900/40 to-transparent">
        <div className="relative w-48 h-48 mb-8">
          <svg
            className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]"
            viewBox="0 0 192 192"
          >
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-white/5"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeDasharray={553}
              strokeDashoffset={553 * (1 - analysis.probability)}
              strokeLinecap="round"
              className={probColor}
              style={{
                transition:
                  "stroke-dashoffset 2s cubic-bezier(0.16, 1, 0.3, 1)",
                filter: `drop-shadow(0 0 15px currentColor)`,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-5xl font-black tracking-tighter ${probColor}`}
            >
              {Math.round(analysis.probability * 100)}%
            </span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">
              Sannolikhet
            </span>
          </div>
        </div>

        <h3 className="text-xl font-black mb-3 italic uppercase">
          Målbedömning
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed font-medium">
          {analysis.probability > 0.8
            ? "Ditt mål är mycket rimligt givet din nuvarande form och tid kvar."
            : analysis.probability > 0.5
            ? "Målet är utmanande men möjligt med disciplinerad träning."
            : "Målet ser ut att vara för tufft just nu. Överväg att justera tiden eller datumet."}
        </p>
      </div>

      {/* Detailed Stats */}
      <div className="lg:col-span-2 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-8 bg-gradient-to-br from-slate-900/40 to-transparent">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
              VDOT Gap
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-white">
                +{analysis.gap.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Enheter
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                style={{
                  width: `${Math.min(100, (analysis.gap / 10) * 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="glass-card p-8 bg-gradient-to-br from-slate-900/40 to-transparent">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
              Progression / Vecka
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black text-white">
                {analysis.neededWeeklyImprovement.toFixed(2)}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                VDOT / V
              </span>
            </div>
            <div className="mt-3 text-[9px] text-slate-500 font-black uppercase tracking-widest">
              Gränsvärde: 0.25
            </div>
          </div>
        </div>

        {/* Insight Card */}
        <div className="glass-card p-8 border-l-[6px] border-indigo-500 bg-gradient-to-r from-indigo-500/10 to-transparent group">
          <h4 className="text-lg font-black mb-3 flex items-center gap-3 italic tracking-tight uppercase">
            <span className="text-indigo-400 text-xl group-hover:scale-110 transition-transform">
              💡
            </span>{" "}
            Coachens Insikt
          </h4>
          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            För att nå ditt mål behöver du öka din aeroba kapacitet konsekvent.
            Ditt "Probability Score" baseras på statistiska modeller för
            progression hos löpare på din nivå.
            <br />
            <br />
            <strong className="text-white">Tips:</strong>{" "}
            Genom att nå ditt viktmål kan du "gratis" höja ditt VDOT med upp
            till
            <span className="text-emerald-400 font-black px-1">
              2-3 enheter
            </span>.
          </p>
        </div>
      </div>
    </div>
  );
}
