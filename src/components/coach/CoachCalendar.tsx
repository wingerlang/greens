import React, { useState } from "react";
import { PlannedActivity } from "../../models/types.ts";
import { PlannedActivityCard } from "../training/PlannedActivityCard.tsx";
import { CompressedActivityList } from "../training/CompressedActivityList.tsx";

interface CoachCalendarProps {
  activities: PlannedActivity[];
}

const PHASE_INFO = {
  Base: {
    title: "Basfasen 🌱",
    color: "emerald",
    duration: "Vecka 1-30%",
    focus: "Aerob kapacitet & Uthållighet",
    desc:
      "Du bygger din aeroba motor. Lugna mil som utvecklar mitokondriell densitet.",
    workouts: ["Långa lugna långpass", "Korta lätta löpningar"],
    physiology: "Ökad mitokondriell densitet, förbättrad kapillärtillväxt.",
  },
  Build: {
    title: "Uppbyggnadsfasen 🏗️",
    color: "indigo",
    duration: "Vecka 30-60%",
    focus: "Laktattröskel & Styrka",
    desc: "Vi höjer volymen och introducerar kvalitetspass.",
    workouts: ["Tempopass", "Progressiva långpass"],
    physiology: "Höjd laktattröskel, ökad löpekonomi.",
  },
  Peak: {
    title: "Toppningsfasen 🎯",
    color: "amber",
    duration: "Vecka 60-80%",
    focus: "Race Pace & VO2 Max",
    desc: "Finslipar tävlingsfarten. Specifika och intensiva pass.",
    workouts: ["VO2 Max intervaller", "Race-pace reps"],
    physiology: "Maximal syreupptagning, neuromuskulär effektivitet.",
  },
  Taper: {
    title: "Superkompensation 🌟",
    color: "rose",
    duration: "Vecka 80-100%",
    focus: "Återhämtning & Explosivitet",
    desc: "Volymen sjunker, intensiteten bibehålls. Kroppen laddar.",
    workouts: ["Strides", "Lätta shakeouts"],
    physiology: "Glykogenåterställning, muskelreparation.",
  },
};

export function CoachCalendar({ activities }: CoachCalendarProps) {
  const [selectedPhase, setSelectedPhase] = useState<
    keyof typeof PHASE_INFO | null
  >(null);
  const [viewMode, setViewMode] = useState<"weeks" | "list">("weeks");

  const weeks = React.useMemo(() => {
    if (activities.length === 0) return [];
    const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
    const groups: PlannedActivity[][] = [];
    let currentWeek: PlannedActivity[] = [];
    let lastWeekNum = -1;
    sorted.forEach((act) => {
      const date = new Date(act.date);
      const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
      if (lastWeekNum !== -1 && weekNum !== lastWeekNum) {
        groups.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(act);
      lastWeekNum = weekNum;
    });
    if (currentWeek.length > 0) groups.push(currentWeek);
    return groups;
  }, [activities]);

  const getPhaseColor = (index: number, total: number) => {
    const rel = index / total;
    if (rel > 0.8) return "border-rose-500/20 bg-rose-500/5";
    if (rel > 0.6) return "border-amber-500/20 bg-amber-500/5";
    if (rel > 0.3) return "border-indigo-500/20 bg-indigo-500/5";
    return "border-emerald-500/20 bg-emerald-500/5";
  };

  const getPhaseLabel = (index: number, total: number) => {
    const rel = index / total;
    if (rel > 0.8) return "TAPER";
    if (rel > 0.6) return "PEAK";
    if (rel > 0.3) return "BUILD";
    return "BASE";
  };

  const totalWeeks = weeks.length;
  const phaseBlocks = [
    { key: "Base" as const, color: "bg-emerald-500", width: 0.3 },
    { key: "Build" as const, color: "bg-indigo-500", width: 0.3 },
    { key: "Peak" as const, color: "bg-amber-500", width: 0.2 },
    { key: "Taper" as const, color: "bg-rose-500", width: 0.2 },
  ];

  return (
    <div className="coach-calendar space-y-4">
      {/* Phase Roadmap */}
      {totalWeeks > 0 && (
        <div className="glass-card p-3 border-white/5 bg-white/[0.02]">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h4 className="text-sm font-black text-white uppercase italic tracking-tighter">
                Roadmap
              </h4>
              <p className="text-[8px] text-slate-500 font-bold uppercase">
                Klicka en fas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 p-0.5 bg-slate-900/50 rounded-lg border border-white/5">
                <button
                  onClick={() => setViewMode("weeks")}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase ${
                    viewMode === "weeks"
                      ? "bg-white/10 text-white"
                      : "text-slate-500"
                  }`}
                >
                  Veckor
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-2 py-1 rounded text-[7px] font-black uppercase ${
                    viewMode === "list"
                      ? "bg-white/10 text-white"
                      : "text-slate-500"
                  }`}
                >
                  Lista
                </button>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-emerald-400 leading-none">
                  {totalWeeks}
                </div>
                <div className="text-[6px] font-black text-slate-500 uppercase">
                  v
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-8 gap-0.5 px-0.5 py-0.5 bg-slate-900/50 rounded-lg border border-white/5">
            {phaseBlocks.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPhase(p.key)}
                className={`h-full relative flex items-center justify-center ${p.color}/20 first:rounded-l last:rounded-r border-x border-white/5 hover:brightness-125 transition-all cursor-pointer`}
                style={{ width: `${p.width * 100}%` }}
              >
                <div
                  className={`absolute top-0 left-0 h-0.5 w-full ${p.color}`}
                />
                <div className="text-[8px] font-black uppercase text-white tracking-wide z-10">
                  {p.key}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase Detail Modal */}
      {selectedPhase && (
        <div
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhase(null)}
        >
          <div
            className="bg-slate-900 border border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-black text-white">
                {PHASE_INFO[selectedPhase].title}
              </h3>
              <button
                onClick={() => setSelectedPhase(null)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              {PHASE_INFO[selectedPhase].desc}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2 bg-white/5 rounded-lg">
                <div className="text-[8px] font-black text-slate-500 uppercase">
                  Fokus
                </div>
                <div className="text-xs font-bold text-white">
                  {PHASE_INFO[selectedPhase].focus}
                </div>
              </div>
              <div className="p-2 bg-white/5 rounded-lg">
                <div className="text-[8px] font-black text-slate-500 uppercase">
                  Period
                </div>
                <div className="text-xs font-bold text-white">
                  {PHASE_INFO[selectedPhase].duration}
                </div>
              </div>
            </div>
            <div className="p-2 bg-white/5 rounded-lg mb-3">
              <div className="text-[8px] font-black text-slate-500 uppercase mb-1">
                Typiska Pass
              </div>
              <ul className="text-xs text-slate-300 space-y-0.5">
                {PHASE_INFO[selectedPhase].workouts.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <div className="text-[8px] font-black text-indigo-400 uppercase">
                🧬 Fysiologi
              </div>
              <p className="text-[10px] text-slate-300 italic">
                {PHASE_INFO[selectedPhase].physiology}
              </p>
            </div>
          </div>
        </div>
      )}

      {viewMode === "list"
        ? <CompressedActivityList activities={activities} />
        : (
          <>
            {weeks.map((week, wIdx) => {
              const weekVolume = week.reduce(
                (sum, a) => sum + (a.estimatedDistance || 0),
                0,
              );
              return (
                <div
                  key={wIdx}
                  className={`relative p-4 rounded-2xl border ${
                    getPhaseColor(wIdx, weeks.length)
                  } transition-all shadow-lg`}
                >
                  <div className="absolute -top-2 left-4 right-4 flex justify-between items-center px-3 py-1 rounded-full border border-inherit shadow-md bg-slate-950 z-10">
                    <span className="text-[9px] font-black tracking-widest text-slate-500">
                      V{wIdx + 1} •{" "}
                      <span className="text-white">
                        {getPhaseLabel(wIdx, weeks.length)}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-16 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 opacity-60"
                          style={{
                            width: `${Math.min(100, (weekVolume / 80) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] font-black text-white tabular-nums">
                        {Math.round(weekVolume)}km
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                    {week.map((activity) => (
                      <PlannedActivityCard
                        key={activity.id}
                        activity={activity}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {activities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                <p className="text-sm font-bold">Inga pass planerade ännu.</p>
              </div>
            )}
          </>
        )}
    </div>
  );
}
