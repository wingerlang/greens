import React, { useMemo } from "react";
import { ParsedWorkout, WorkoutSegment } from "../../models/analysisTypes.ts"; // Import from central types if possible, or relative
import { parseWorkout } from "../../utils/workoutParser.ts";

interface WorkoutStructureCardProps {
  title: string;
  description: string;
}

const SegmentRow = (
  { segment, index }: { segment: WorkoutSegment; index: number },
) => {
  const isInterval = segment.type === "INTERVAL";
  const isRest = segment.type === "REST";
  const isWarmup = segment.type === "WARMUP";
  const isCooldown = segment.type === "COOLDOWN";

  let bgColor = "bg-slate-800";
  let borderColor = "border-slate-700";
  let icon = "⏱️";

  if (isInterval) {
    bgColor = "bg-amber-500/10";
    borderColor = "border-amber-500/30";
    icon = "⚡";
  } else if (isRest) {
    bgColor = "bg-slate-800/50";
    borderColor = "border-slate-700/50";
    icon = "💤";
  } else if (isWarmup) {
    bgColor = "bg-emerald-500/10";
    borderColor = "border-emerald-500/30";
    icon = "🔥";
  } else if (isCooldown) {
    bgColor = "bg-blue-500/10";
    borderColor = "border-blue-500/30";
    icon = "🧊";
  }

  return (
    <div
      className={`relative flex items-center gap-3 p-3 rounded-xl border ${borderColor} ${bgColor} mb-2`}
    >
      <div className="w-6 h-6 flex items-center justify-center text-sm">
        {icon}
      </div>

      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <h4
            className={`text-xs font-bold uppercase ${
              isInterval ? "text-amber-400" : "text-slate-400"
            }`}
          >
            {segment.type}{" "}
            {segment.reps > 1 && (
              <span className="text-white ml-2">x{segment.reps}</span>
            )}
          </h4>
          {segment.work.pace && (
            <span className="text-xs font-mono font-bold text-white">
              {segment.work.pace.display} /km
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 mt-0.5">
          {segment.work.dist
            ? (
              <span className="text-lg font-black text-white">
                {segment.work.dist}{" "}
                <span className="text-xs font-normal text-slate-500">m</span>
              </span>
            )
            : segment.work.time
            ? (
              <span className="text-lg font-black text-white">
                {Math.round(segment.work.time / 60)}{" "}
                <span className="text-xs font-normal text-slate-500">min</span>
              </span>
            )
            : (
              <span className="text-xs text-slate-500 italic">
                Ingen distans/tid
              </span>
            )}
        </div>
      </div>

      {/* Recovery Pill */}
      {segment.recovery && (
        <div className="absolute -bottom-2 right-4 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-full text-[10px] text-slate-400 font-mono shadow-sm">
          {segment.recovery.type === "distance"
            ? `${segment.recovery.value}m`
            : `${segment.recovery.value}s`} vila
        </div>
      )}
    </div>
  );
};

export function WorkoutStructureCard(
  { title, description }: WorkoutStructureCardProps,
) {
  const parsed = useMemo(() => parseWorkout(title, description), [
    title,
    description,
  ]);

  if (!parsed || parsed.segments.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
          <span>🧩</span> Pass-struktur
        </h3>
        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-full border border-white/5 font-mono">
          {parsed.classification}
        </span>
      </div>

      <div className="bg-slate-900/50 rounded-2xl p-4 border border-white/5 max-h-[400px] overflow-y-auto custom-scrollbar">
        {parsed.segments.map((seg, i) => (
          <SegmentRow key={i} segment={seg} index={i} />
        ))}
      </div>

      <p className="text-[10px] text-slate-600 italic text-center">
        * Analyserat automatiskt från beskrivningen.
      </p>
    </div>
  );
}
