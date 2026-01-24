import React, { useState } from "react";
import { PlannedActivity } from "../../models/types.ts";
import { useData } from "../../context/DataContext.tsx";
import {
  formatSecondsToTime,
  parseTimeToSeconds,
} from "../../utils/timeParser.ts";
import { useEffect } from "react";

interface PlannedActivityCardProps {
  activity: PlannedActivity;
  compact?: boolean;
}

export function PlannedActivityCard(
  { activity, compact = false }: PlannedActivityCardProps,
) {
  const {
    updatePlannedActivity,
    completePlannedActivity,
    deletePlannedActivity,
  } = useData();
  const [showFeedback, setShowFeedback] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(activity.date);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [timeInputValue, setTimeInputValue] = useState(
    formatSecondsToTime(activity.actualTimeSeconds || 0),
  );

  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsEditing(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing]);

  if (compact) {
    return (
      <div
        className={`p-4 rounded-2xl border transition-all ${
          activity.status === "COMPLETED"
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-slate-900/40 border-white/5 hover:border-white/10"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
              {activity.category}
            </div>
            <div className="font-black text-sm text-white">
              {activity.title}
            </div>
          </div>
          {activity.status === "COMPLETED"
            ? <div className="text-emerald-500 text-lg">✅</div>
            : (
              <div className="text-indigo-400 font-black text-xs">
                {activity.targetPace}
              </div>
            )}
        </div>
      </div>
    );
  }

  const handleComplete = (
    feedback: PlannedActivity["feedback"],
    actualDist?: number,
    actualTime?: number,
  ) => {
    completePlannedActivity(
      activity.id,
      actualDist || activity.estimatedDistance,
      actualTime,
      feedback,
    );
    setShowFeedback(false);
  };

  const adjustWorkout = (type: "DIST" | "PACE" | "REPS", delta: number) => {
    const updatedStructure = {
      ...activity.structure,
      mainSet: activity.structure.mainSet.map((s) => {
        if (type === "REPS") return { ...s, reps: Math.max(1, s.reps + delta) };
        if (type === "DIST") {
          return {
            ...s,
            distKm: Math.round(Math.max(0.1, s.distKm * delta) * 10) / 10,
          };
        }
        // Pace is a bit harder since it's a string "MM:SS"
        if (type === "PACE") {
          const secs = parseTimeToSeconds(s.pace);
          if (secs) {
            const newSecs = Math.round(secs * delta);
            return { ...s, pace: formatSecondsToTime(newSecs) };
          }
        }
        return s;
      }),
    };

    const newTotalDist = updatedStructure.mainSet.reduce(
      (sum, s) => sum + (s.reps * s.distKm),
      0,
    ) + activity.structure.warmupKm + activity.structure.cooldownKm;

    updatePlannedActivity(activity.id, {
      structure: updatedStructure,
      estimatedDistance: Math.round(newTotalDist * 10) / 10,
      title: activity.title.includes("⚙️")
        ? activity.title
        : `${activity.title} ⚙️`,
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setEditDate(newDate);
    updatePlannedActivity(activity.id, { date: newDate });
  };

  return (
    <div
      className={`relative group glass-card p-4 transition-all overflow-hidden ${
        activity.status === "COMPLETED"
          ? "opacity-60 grayscale-[30%]"
          : "hover:scale-[1.01]"
      } ${
        activity.category === "LONG_RUN"
          ? "border-amber-500/30 bg-amber-500/[0.02]"
          : ""
      }`}
    >
      {/* PR and Achievement Badges */}
      <div className="absolute top-4 right-4 flex gap-2 z-10 items-center">
        {activity.isVolumePR && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 animate-bounce">
            🔥 Mängdrekord
          </div>
        )}
        {activity.isLongestInPlan && (
          <div className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20">
            👑 Längsta Passet
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-4 flex-1">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider border ${
                  activity.category === "LONG_RUN"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/20"
                    : activity.category === "INTERVALS"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/20"
                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/20"
                }`}
              >
                {activity.category === "LONG_RUN"
                  ? "🚀 Långpass"
                  : activity.category === "EASY"
                  ? "🍃 Distans"
                  : activity.category}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={editDate}
                  onChange={handleDateChange}
                  className="bg-transparent text-slate-500 text-[10px] font-bold tracking-widest border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-400 transition-colors"
                />
              </div>
            </div>
            <h3
              className="text-xl md:text-3xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase italic tracking-tighter leading-none mb-3 cursor-pointer flex items-center gap-3"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {activity.title}
              <span
                className={`text-sm transition-transform duration-300 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </h3>

            {activity.scientificBenefit && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-white/5 border border-white/5 mt-4">
                <span className="text-sm">🧠</span>
                <p className="text-[10px] text-slate-300 font-bold leading-tight uppercase tracking-tight">
                  {activity.scientificBenefit}
                </p>
              </div>
            )}
          </div>

          <p className="text-slate-400 text-sm leading-relaxed max-w-xl opacity-80 font-medium line-clamp-2">
            {activity.description}
          </p>

          {/* The Longevity Gauge (Selling the Long Run) */}
          {activity.category === "LONG_RUN" && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-3">
              <div className="flex justify-between items-end">
                <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                  Uthållighets-analys
                </div>
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Bas + Stamina-delta
                </div>
              </div>
              <div className="flex h-3 gap-1 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="h-full bg-blue-500/40 relative group/base"
                  style={{ width: "60%" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[7px] font-black opacity-0 group-hover/base:opacity-100 transition-opacity uppercase text-white pointer-events-none">
                    Basmängd
                  </div>
                </div>
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 relative group/extra animate-pulse"
                  style={{ width: "40%" }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[7px] font-black text-slate-950 uppercase pointer-events-none">
                    Endurance Delta
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 font-medium italic">
                * Den orangea zonen markerar distansen där du faktiskt bygger ny
                stamina och växer din aeroba motor.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 group-hover:border-indigo-500/20 transition-colors">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Måltempo
              </div>
              <div className="text-lg font-black text-white tracking-tight">
                {activity.targetPace}{" "}
                <span className="text-[10px] text-slate-500 font-medium italic">
                  min/km
                </span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 group-hover:border-indigo-500/20 transition-colors">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Distans
              </div>
              <div
                className={`text-lg font-black tracking-tight ${
                  activity.category === "LONG_RUN"
                    ? "text-amber-400"
                    : "text-white"
                }`}
              >
                {activity.estimatedDistance}{" "}
                <span className="text-[10px] text-slate-500 font-medium italic">
                  km
                </span>
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 group-hover:border-indigo-500/20 transition-colors">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Pulszon
              </div>
              <div className="text-lg font-black text-white tracking-tight">
                Zon {activity.targetHrZone}
              </div>
            </div>
            <div
              className={`p-3.5 rounded-2xl border transition-colors ${
                activity.status === "COMPLETED"
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-slate-900/50 border-white/5 group-hover:border-indigo-500/20"
              }`}
            >
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Status
              </div>
              <div
                className={`text-base font-black flex items-center gap-2 ${
                  activity.status === "COMPLETED"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {activity.status === "COMPLETED" ? "✓ Klar" : "Planerad"}
                {activity.status === "COMPLETED" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col gap-3 justify-end items-center">
          {activity.status !== "COMPLETED"
            ? (
              <>
                {!showFeedback
                  ? (
                    <div className="flex flex-row md:flex-col gap-2">
                      <button
                        onClick={() => setShowFeedback(true)}
                        className="px-6 py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/10 whitespace-nowrap"
                      >
                        Färdig!
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-slate-800 text-white/70 hover:text-white font-black rounded-xl hover:bg-slate-700 transition-all uppercase tracking-widest text-[9px] border border-white/5"
                        title="Justera passet (Tempo/Distans)"
                      >
                        Justera ⚙️
                      </button>
                    </div>
                  )
                  : (
                    <div className="flex flex-col gap-2 p-4 bg-slate-900/90 rounded-2xl border border-white/10 animate-in fade-in zoom-in duration-200 shadow-2xl">
                      <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center mb-1">
                        Hur kändes det?
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleComplete("EASY")}
                          className="p-3 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all font-black text-[10px] uppercase"
                        >
                          Lätt
                        </button>
                        <button
                          onClick={() => handleComplete("PERFECT")}
                          className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-all font-black text-[10px] uppercase"
                        >
                          Perfekt
                        </button>
                        <button
                          onClick={() => handleComplete("HARD")}
                          className="p-3 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30 transition-all font-black text-[10px] uppercase"
                        >
                          Hårt
                        </button>
                      </div>
                      <button
                        onClick={() => setShowFeedback(false)}
                        className="text-[10px] text-slate-500 font-bold hover:text-white mt-1"
                      >
                        Avbryt
                      </button>
                    </div>
                  )}
              </>
            )
            : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-4 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 font-black rounded-2xl transition-all uppercase tracking-widest text-xs border border-indigo-500/20 shadow-xl shadow-indigo-500/5"
              >
                Redigera ⚙️
              </button>
            )}
          <button
            onClick={() => deletePlannedActivity(activity.id)}
            className="p-4 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all"
          >
            🗑️
          </button>
        </div>
      </div>

      <div
        className={`transition-all duration-500 overflow-hidden ${
          isExpanded ? "max-h-[2000px] opacity-100 mt-6" : "max-h-0 opacity-0"
        }`}
      >
        {activity.structure.warmupKm > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <span className="w-24 text-[9px] font-black uppercase text-blue-400 tracking-wider">
              Uppvärmning
            </span>
            <div className="h-1.5 flexible flex-1 bg-blue-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-full opacity-50" />
            </div>
            <span className="text-sm text-white font-black tabular-nums">
              {activity.structure.warmupKm} km
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">
              Lugnt
            </span>
          </div>
        )}

        {activity.structure.mainSet.map((set, i) => (
          <div
            key={i}
            className={`flex flex-col gap-3 p-4 rounded-xl border relative overflow-hidden group/set ${
              activity.category === "LONG_RUN"
                ? "bg-amber-500/5 border-amber-500/10"
                : "bg-white/5 border-white/5"
            }`}
          >
            <div
              className={`absolute inset-y-0 left-0 w-1 opacity-50 ${
                activity.category === "LONG_RUN"
                  ? "bg-amber-500"
                  : "bg-indigo-500"
              }`}
            />
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  className={`w-24 text-[9px] font-black uppercase tracking-wider ${
                    activity.category === "LONG_RUN"
                      ? "text-amber-400"
                      : "text-indigo-400"
                  }`}
                >
                  {activity.category === "TEMPO"
                    ? "Tempo"
                    : (activity.category === "LONG_RUN" ||
                        activity.category === "EASY")
                    ? "Uthållighet"
                    : "Intervaller"}
                </span>
                <span className="text-xl font-black text-white tabular-nums">
                  {(activity.category === "EASY" ||
                      activity.category === "LONG_RUN") && set.reps === 1
                    ? `${set.distKm}km`
                    : `${set.reps}x ${
                      set.distKm >= 1
                        ? `${set.distKm}km`
                        : `${set.distKm * 1000}m`
                    }`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  Tempo
                </span>
                <span
                  className={`text-2xl font-black tabular-nums drop-shadow-xl ${
                    activity.category === "LONG_RUN"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {set.pace}
                </span>
              </div>
            </div>
            {set.restMin > 0 && (
              <div className="flex items-center gap-4 pl-28">
                <div className="h-px flex-1 bg-white/5" />
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Vila
                  </span>
                  <span className="text-sm font-black text-indigo-400">
                    {set.restMin} min
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {activity.structure.cooldownKm > 0 && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <span className="w-24 text-[9px] font-black uppercase text-blue-400 tracking-wider">
              Nedvarvning
            </span>
            <div className="h-1.5 flexible flex-1 bg-blue-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-full opacity-50" />
            </div>
            <span className="text-sm text-white font-black tabular-nums">
              {activity.structure.cooldownKm} km
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase">
              Lugnt
            </span>
          </div>
        )}
      </div>

      {/* Workout Structure Visualizer */}
      <div className="mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center gap-1.5 h-4 rounded-full overflow-hidden bg-slate-900 shadow-inner">
          {activity.structure.warmupKm > 0 && (
            <div
              className="h-full bg-blue-500/40 relative"
              style={{
                width: `${
                  (activity.structure.warmupKm / activity.estimatedDistance) *
                  100
                }%`,
              }}
            />
          )}
          {activity.structure.mainSet.map((set, i) => (
            <div
              key={i}
              className={`h-full relative ${
                activity.category === "LONG_RUN"
                  ? "bg-amber-500"
                  : "bg-indigo-500"
              }`}
              style={{
                width: `${
                  ((set.reps * set.distKm) / activity.estimatedDistance) * 100
                }%`,
              }}
            >
              <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10" />
            </div>
          ))}
          {activity.structure.cooldownKm > 0 && (
            <div
              className="h-full bg-blue-500/40 relative"
              style={{
                width: `${
                  (activity.structure.cooldownKm / activity.estimatedDistance) *
                  100
                }%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-3 px-1">
          <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
            Start
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {activity.estimatedDistance}km Totalt
          </div>
        </div>
      </div>

      {/* Edit Modal for Completed Sessions */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsEditing(false)}
        >
          <div
            className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">
                Redigera & Justera
              </h4>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-500 hover:text-white text-xl p-2 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Faktisk Distans (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={activity.actualDistance ||
                        activity.estimatedDistance}
                      onChange={(e) =>
                        updatePlannedActivity(activity.id, {
                          actualDistance: parseFloat(e.target.value),
                        })}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-500/50 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Faktisk Tid
                    </label>
                    <input
                      type="text"
                      value={timeInputValue}
                      onChange={(e) => {
                        setTimeInputValue(e.target.value);
                        const secs = parseTimeToSeconds(e.target.value);
                        if (secs !== null) {
                          updatePlannedActivity(activity.id, {
                            actualTimeSeconds: secs,
                          });
                        }
                      }}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-white font-bold focus:border-indigo-500/50 outline-none transition-colors"
                      placeholder="t.ex. 45:30"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Feedback
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["EASY", "PERFECT", "HARD", "TOO_HARD"] as const).map(
                        (f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() =>
                              updatePlannedActivity(activity.id, {
                                feedback: f,
                              })}
                            className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                              activity.feedback === f
                                ? "bg-emerald-500 text-slate-950"
                                : "bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5"
                            }`}
                          >
                            {f === "TOO_HARD"
                              ? "För Tufft"
                              : f === "HARD"
                              ? "Hårt"
                              : f === "PERFECT"
                              ? "Perfekt"
                              : "Lätt"}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {["INTERVALS", "REPETITION"].includes(activity.category) && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Antal Repitioner
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => adjustWorkout("REPS", -1)}
                      className="w-12 h-12 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-center text-white font-black hover:bg-white/10 active:scale-90"
                    >
                      -
                    </button>
                    <div className="text-xl font-black text-white">
                      {activity.structure.mainSet[0]?.reps || 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustWorkout("REPS", 1)}
                      className="w-12 h-12 bg-slate-950 border border-white/5 rounded-xl flex items-center justify-center text-white font-black hover:bg-white/10 active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    Snabb-justering ⚙️
                  </label>
                  <span className="text-xs font-black text-white bg-slate-800 px-2 py-1 rounded-lg">
                    {activity.estimatedDistance} km
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => adjustWorkout("DIST", 0.9)}
                    className="py-3 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:text-white transition-all active:scale-95"
                  >
                    → {Math.round(activity.estimatedDistance * 0.9 * 10) / 10}
                    {" "}
                    km (-10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustWorkout("DIST", 1.1)}
                    className="py-3 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:text-white transition-all active:scale-95"
                  >
                    → {Math.round(activity.estimatedDistance * 1.1 * 10) / 10}
                    {" "}
                    km (+10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustWorkout("PACE", 1.05)}
                    className="py-3 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:text-white transition-all active:scale-95"
                  >
                    Lugnare Tempo (+5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustWorkout("PACE", 0.95)}
                    className="py-3 bg-slate-950 border border-white/5 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:text-white transition-all active:scale-95"
                  >
                    Tuffare Tempo (-5%)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 shrink-0">
              <button
                onClick={() => setIsEditing(false)}
                className="w-full bg-emerald-500 text-slate-950 font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 active:scale-[0.98]"
              >
                Spara Ändringar & Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
