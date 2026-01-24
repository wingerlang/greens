import React, { useMemo } from "react";
import { DailyVitals, ExerciseEntry } from "../../models/types.ts";

interface SleepGainsAnalysisProps {
  exerciseEntries: ExerciseEntry[];
  dailyVitals: Record<string, DailyVitals>;
}

export function SleepGainsAnalysis(
  { exerciseEntries, dailyVitals }: SleepGainsAnalysisProps,
) {
  const analysis = useMemo(() => {
    // defined buckets
    const buckets = {
      low: { min: 0, max: 6.5, label: "< 6.5h" },
      medium: { min: 6.5, max: 7.5, label: "6.5 - 7.5h" },
      high: { min: 7.5, max: 24, label: "> 7.5h" },
    };

    const stats = {
      running: {
        low: [] as number[], // pace (min/km)
        medium: [] as number[],
        high: [] as number[],
      },
      strength: {
        low: [] as number[], // tonnage
        medium: [] as number[],
        high: [] as number[],
      },
    };

    exerciseEntries.forEach((entry) => {
      // Find sleep for the night BEFORE the exercise
      // Entry date is YYYY-MM-DD.
      // We need to look up vitals for the same date (assuming vitals.date represents the morning lookup of last night's sleep)
      // Or usually: Date of workout 2023-10-10. Sleep recorded on morning of 2023-10-10 is the sleep leading into the day.
      const vitals = dailyVitals[entry.date];
      if (!vitals || !vitals.sleep) return;

      const sleep = vitals.sleep;
      let bucket: "low" | "medium" | "high" | null = null;

      if (sleep < buckets.low.max) bucket = "low";
      else if (sleep < buckets.medium.max) bucket = "medium";
      else bucket = "high";

      if (!bucket) return;

      if (
        entry.type === "running" && entry.distance && entry.distance > 0 &&
        entry.durationMinutes > 0
      ) {
        const pace = entry.durationMinutes / entry.distance; // min/km
        // Filter out unrealistic paces (e.g. < 2:00 or > 10:00 to avoid GPS errors affecting stats)
        if (pace > 2 && pace < 10) {
          stats.running[bucket].push(pace);
        }
      } else if (
        entry.type === "strength" && entry.tonnage && entry.tonnage > 0
      ) {
        stats.strength[bucket].push(entry.tonnage);
      }
    });

    // Calculate averages
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      running: {
        low: avg(stats.running.low),
        medium: avg(stats.running.medium),
        high: avg(stats.running.high),
        count: stats.running.low.length + stats.running.medium.length +
          stats.running.high.length,
      },
      strength: {
        low: avg(stats.strength.low),
        medium: avg(stats.strength.medium),
        high: avg(stats.strength.high),
        count: stats.strength.low.length + stats.strength.medium.length +
          stats.strength.high.length,
      },
    };
  }, [exerciseEntries, dailyVitals]);

  const formatPace = (minPerKm: number) => {
    if (!minPerKm) return "-";
    const m = Math.floor(minPerKm);
    const s = Math.round((minPerKm - m) * 60);
    return `${m}:${s.toString().padStart(2, "0")}/km`;
  };

  if (analysis.running.count < 5 && analysis.strength.count < 5) {
    return null; // Not enough data
  }

  // Determine the "Gain" (difference between High and Low sleep)
  const runGain = analysis.running.low > 0 && analysis.running.high > 0
    ? ((analysis.running.low - analysis.running.high) * 60).toFixed(0) // seconds faster
    : null;

  const strengthGain = analysis.strength.low > 0 && analysis.strength.high > 0
    ? ((analysis.strength.high - analysis.strength.low) /
      analysis.strength.low * 100).toFixed(1) // % heavier
    : null;

  return (
    <div className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <span className="text-6xl">💤</span>
      </div>

      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <span>Sleep-to-Gains</span>
        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-500/20">
          Analys
        </span>
      </h3>
      <p className="text-slate-400 text-xs mb-6 max-w-xs">
        Hur din sömn påverkar din prestation baserat på din data.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RUNNING CARD */}
        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏃</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                Löpning
              </span>
            </div>
            {runGain && Number(runGain) > 0 && (
              <div className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded-lg">
                +{runGain} sek/km snabbare
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Bar
              label="< 6.5h Sömn"
              value={formatPace(analysis.running.low)}
              subValue="Trött"
              color="bg-slate-700"
              width="w-[70%]"
            />
            <Bar
              label="> 7.5h Sömn"
              value={formatPace(analysis.running.high)}
              subValue="Utvilad"
              color="bg-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]"
              width="w-[90%]"
            />
          </div>
        </div>

        {/* STRENGTH CARD */}
        <div className="bg-slate-950/50 rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">💪</span>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                Styrka
              </span>
            </div>
            {strengthGain && Number(strengthGain) > 0 && (
              <div className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-1 rounded-lg">
                +{strengthGain}% mer volym
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Bar
              label="< 6.5h Sömn"
              value={analysis.strength.low
                ? `${Math.round(analysis.strength.low / 1000)} ton`
                : "-"}
              subValue="Trött"
              color="bg-slate-700"
              width="w-[60%]"
            />
            <Bar
              label="> 7.5h Sömn"
              value={analysis.strength.high
                ? `${Math.round(analysis.strength.high / 1000)} ton`
                : "-"}
              subValue="Utvilad"
              color="bg-amber-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.4)]"
              width="w-[85%]"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 text-center">
        <p className="text-[10px] text-slate-500 italic">
          Baserat på {analysis.running.count + analysis.strength.count}{" "}
          aktiviteter matchade med sömndata.
        </p>
      </div>
    </div>
  );
}

const Bar = (
  { label, value, subValue, color, width }: {
    label: string;
    value: string;
    subValue: string;
    color: string;
    width: string;
  },
) => (
  <div className="flex items-center gap-3">
    <div className="w-20 text-[10px] text-slate-400 text-right">{label}</div>
    <div className="flex-1 h-8 bg-slate-900 rounded-lg relative overflow-hidden flex items-center px-3 group">
      <div
        className={`absolute top-0 left-0 h-full ${color} opacity-20 transition-all duration-1000`}
        style={{ width }}
      >
      </div>
      <div
        className={`absolute top-0 left-0 h-full w-[2px] ${color} opacity-50`}
      >
      </div>
      <span className="relative z-10 text-xs font-bold text-white">
        {value}
      </span>
    </div>
  </div>
);
