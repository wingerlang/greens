import React from "react";
import { WorkoutDefinition } from "../../models/workout.ts";

interface Props {
  workout: WorkoutDefinition;
  onClick: () => void;
}

export function WorkoutCard({ workout, onClick }: Props) {
  // Category Colors
  const catColors = {
    "HYROX": "amber",
    "RUNNING": "emerald",
    "STRENGTH": "rose",
    "HYBRID": "indigo",
    "RECOVERY": "blue",
    "CROSSFIT": "slate",
  };
  const c = catColors[workout.category] || "slate";

  return (
    <div
      onClick={onClick}
      className={`
                bg-slate-900 border border-white/5 rounded-2xl p-5 hover:border-${c}-500/30 hover:bg-slate-800/50 
                transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full
            `}
    >
      {/* Background Glow */}
      <div
        className={`absolute top-0 right-0 w-32 h-32 bg-${c}-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-${c}-500/10 transition-colors pointer-events-none`}
      />

      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="flex gap-2">
          <span
            className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-${c}-500/10 text-${c}-400 border border-${c}-500/20`}
          >
            {workout.category}
          </span>
          {workout.source === "COACH_AI" && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              AI Coach
            </span>
          )}
        </div>
        <div className="text-white/20 group-hover:text-white/40 transition-colors">
          ↗
        </div>
      </div>

      <h3 className="text-lg font-black text-white italic tracking-tighter mb-2 group-hover:text-${c}-400 transition-colors">
        {workout.title}
      </h3>

      <p className="text-xs text-slate-400 line-clamp-2 mb-4 flex-1">
        {workout.description}
      </p>

      <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-auto border-t border-white/5 pt-3">
        <span className="flex items-center gap-1">
          ⏱️ {workout.durationMin} min
        </span>
        <span className="flex items-center gap-1">
          🔥 {workout.difficulty}
        </span>
      </div>
    </div>
  );
}
