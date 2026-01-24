import React, { useMemo } from "react";
import { StrengthWorkout } from "../../models/strengthTypes.ts";

interface TrainingBreaksProps {
  workouts: StrengthWorkout[];
  filterRange?: { start: string | null; end: string | null };
}

export function TrainingBreaks({ workouts, filterRange }: TrainingBreaksProps) {
  const breaks = useMemo(() => {
    if (workouts.length < 2) return [];
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    const res: { start: string; end: string; days: number }[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const d1 = new Date(sorted[i].date);
      const d2 = new Date(sorted[i + 1].date);
      const diffDays = Math.floor(
        (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays >= 28) {
        const s = filterRange?.start;
        const e = filterRange?.end;
        const bStart = sorted[i].date;
        const bEnd = sorted[i + 1].date;

        let include = true;
        if (s && bEnd < s) include = false;
        if (e && bStart > e) include = false;

        if (include) {
          res.push({ start: bStart, end: bEnd, days: diffDays });
        }
      }
    }
    return res.sort((a, b) => b.days - a.days);
  }, [workouts, filterRange]);

  if (breaks.length === 0) return null;

  const formatTimeSince = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < 30) return `${diffDays}d sedan`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} mån sedan`;
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    return months > 0 ? `${years} år ${months} mån` : `${years} år`;
  };

  const formatWeeks = (days: number) => {
    const weeks = Math.floor(days / 7);
    return weeks >= 4 ? `${Math.floor(weeks / 4)} mån` : `${weeks} veckor`;
  };

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-3">⏸️ Träningsuppehåll</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {breaks.slice(0, 4).map((b, i) => (
          <div
            key={i}
            className="bg-slate-900/50 border border-white/5 rounded-xl p-3 flex items-center gap-3 group hover:border-amber-500/20 transition-all"
          >
            <div className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity">
              💤
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">
                {formatWeeks(b.days)}
              </p>
              <p className="text-[9px] text-slate-500 truncate">
                {new Date(b.start).toLocaleDateString("sv-SE", {
                  month: "short",
                  year: "2-digit",
                })} - {new Date(b.end).toLocaleDateString("sv-SE", {
                  month: "short",
                  year: "2-digit",
                })}
              </p>
              <p className="text-[8px] text-amber-500/60">
                ({formatTimeSince(b.end)})
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
