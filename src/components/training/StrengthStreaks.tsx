import React, { useMemo } from "react";
import { StrengthWorkout } from "../../models/strengthTypes.ts";

interface StrengthStreaksProps {
  workouts: StrengthWorkout[];
}

export function StrengthStreaks({ workouts }: StrengthStreaksProps) {
  const streaks = useMemo(() => {
    if (workouts.length === 0) return [];

    const weeksSet = new Set<string>();
    workouts.forEach((w) => {
      const d = new Date(w.date);
      d.setDate(d.getDate() - d.getDay());
      weeksSet.add(d.toISOString().split("T")[0]);
    });

    const sortedWeeks = Array.from(weeksSet).sort();
    const results: { start: string; end: string; count: number }[] = [];

    if (sortedWeeks.length === 0) return [];

    let currentStreak = [sortedWeeks[0]];

    for (let i = 1; i < sortedWeeks.length; i++) {
      const prev = new Date(sortedWeeks[i - 1]);
      const curr = new Date(sortedWeeks[i]);
      const diffDays = Math.floor(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays <= 7) {
        currentStreak.push(sortedWeeks[i]);
      } else {
        if (currentStreak.length >= 2) {
          results.push({
            start: currentStreak[0],
            end: currentStreak[currentStreak.length - 1],
            count: currentStreak.length,
          });
        }
        currentStreak = [sortedWeeks[i]];
      }
    }

    if (currentStreak.length >= 2) {
      results.push({
        start: currentStreak[0],
        end: currentStreak[currentStreak.length - 1],
        count: currentStreak.length,
      });
    }

    return results.sort((a, b) => b.count - a.count);
  }, [workouts]);

  if (streaks.length === 0) return null;

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

  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-3">🔥 Längsta sviter</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {streaks.slice(0, 4).map((s, i) => (
          <div
            key={i}
            className="bg-slate-900/50 border border-white/5 rounded-xl p-3 flex items-center gap-3 group hover:border-emerald-500/20 transition-all"
          >
            <div className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors">
                {s.count} veckor
              </p>
              <p className="text-xs text-slate-400 truncate">
                {new Date(s.start).toLocaleDateString("sv-SE", {
                  month: "short",
                  year: "2-digit",
                })} - {new Date(s.end).toLocaleDateString("sv-SE", {
                  month: "short",
                  year: "2-digit",
                })}
              </p>
              <p className="text-[10px] text-emerald-500/80">
                ({formatTimeSince(s.end)})
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
