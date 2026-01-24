import React, { useMemo } from "react";
import { WorkoutDefinition } from "../../models/workout.ts";
import { MUSCLE_MAP } from "../../data/muscleMap.ts";

interface Props {
  workout: WorkoutDefinition;
}

export function WorkoutAnalyzer({ workout }: Props) {
  // ANALYZE: Muscles
  const muscleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let totalExercises = 0;

    workout.exercises?.forEach((section) => {
      section.exercises.forEach((ex) => {
        totalExercises++;
        let map = MUSCLE_MAP[ex.name];
        if (!map) {
          const key = Object.keys(MUSCLE_MAP).find((k) => ex.name.includes(k));
          if (key) map = MUSCLE_MAP[key];
        }

        if (map) {
          stats[map.primary] = (stats[map.primary] || 0) + 1;
          map.secondary.forEach((m) => {
            stats[m] = (stats[m] || 0) + 0.5;
          });
        }
      });
    });

    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, score]) => ({
        muscle,
        score,
        pct: (score / (totalExercises || 1)) * 100,
      }));
  }, [workout]);

  // ANALYZE: Coach Tips (Swedish)
  const coachTips = useMemo(() => {
    const tips: string[] = [];

    const hasWarmup = workout.exercises?.some((s) =>
      s.title.toLowerCase().includes("warm") ||
      s.title.toLowerCase().includes("uppvärmning")
    );
    if (!hasWarmup) {
      tips.push(
        "⚠️ Saknar uppvärmning: Överväg att lägga till 5-10 minuter för att minska skaderisken.",
      );
    }

    const pushes = (muscleStats.find((s) => s.muscle === "Chest")?.score || 0) +
      (muscleStats.find((s) => s.muscle === "Shoulders")?.score || 0) +
      (muscleStats.find((s) => s.muscle === "Quads")?.score || 0);
    const pulls = (muscleStats.find((s) => s.muscle === "Back")?.score || 0) +
      (muscleStats.find((s) => s.muscle === "Hamstrings")?.score || 0);

    if (pushes > pulls + 2) {
      tips.push(
        "ℹ️ Push-dominant: Passet har mycket pressande rörelser. Lägg till fler dragövningar (rodd, pullups) för balans.",
      );
    }
    if (pulls > pushes + 2) {
      tips.push("ℹ️ Pull-dominant: Fokus ligger på dragrörelser och baksida.");
    }

    if (workout.durationMin > 90) {
      tips.push(
        "⏱️ Långt pass: Vid pass över 90 minuter bör du se över vätske- och energiintag under träningen.",
      );
    }

    return tips;
  }, [workout, muscleStats]);

  return (
    <div className="space-y-8 p-6 bg-[#080815]">
      {/* MUSCLE ZONES */}
      <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-white/5 backdrop-blur-md">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">
          Målytor (Muskelgrupper)
        </h4>

        {muscleStats.length === 0
          ? (
            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center py-8 italic">
              Lägg till övningar för att se analys
            </div>
          )
          : (
            <div className="space-y-4">
              {muscleStats.slice(0, 8).map((stat) => (
                <div key={stat.muscle} className="group">
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-wider mb-2">
                    <span className="text-white">{stat.muscle}</span>
                    <span className="text-indigo-400 opacity-50">
                      {stat.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700"
                      style={{ width: `${Math.min(100, stat.pct)}%` }}
                    >
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* AI COACH INSIGHTS */}
      <div className="bg-slate-900/40 p-6 rounded-[2rem] border border-white/5 backdrop-blur-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 blur-[80px] pointer-events-none" />

        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">
          Coach AI Insikter
        </h4>
        {coachTips.length === 0
          ? (
            <div className="text-[11px] text-slate-500 font-bold italic leading-relaxed">
              Ser balanserat och bra ut! Inga specifika varningar för detta
              upplägg.
            </div>
          )
          : (
            <div className="space-y-3">
              {coachTips.map((tip, i) => (
                <div
                  key={i}
                  className="flex gap-3 text-[11px] font-bold text-slate-300 leading-relaxed p-3 rounded-2xl bg-white/5 border border-white/5"
                >
                  {tip}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
