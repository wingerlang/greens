import React, { useMemo } from 'react';
import { StrengthWorkout } from '../../models/strengthTypes.ts';

interface StrengthStreaksProps {
    workouts: StrengthWorkout[];
}

export function StrengthStreaks({ workouts }: StrengthStreaksProps) {
    const streaks = useMemo(() => {
        if (workouts.length === 0) return [];

        // Group by week key
        const weeksSet = new Set<string>();
        workouts.forEach(w => {
            const d = new Date(w.date);
            d.setDate(d.getDate() - d.getDay()); // Start of week
            weeksSet.add(d.toISOString().split('T')[0]);
        });

        const sortedWeeks = Array.from(weeksSet).sort();
        const results: { start: string, end: string, count: number }[] = [];

        if (sortedWeeks.length === 0) return [];

        let currentStreak = [sortedWeeks[0]];

        for (let i = 1; i < sortedWeeks.length; i++) {
            const prev = new Date(sortedWeeks[i - 1]);
            const curr = new Date(sortedWeeks[i]);
            const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays <= 7) { // Consecutive week
                currentStreak.push(sortedWeeks[i]);
            } else {
                if (currentStreak.length >= 2) {
                    results.push({
                        start: currentStreak[0],
                        end: currentStreak[currentStreak.length - 1],
                        count: currentStreak.length
                    });
                }
                currentStreak = [sortedWeeks[i]];
            }
        }

        if (currentStreak.length >= 2) {
            results.push({
                start: currentStreak[0],
                end: currentStreak[currentStreak.length - 1],
                count: currentStreak.length
            });
        }

        return results.sort((a, b) => b.count - a.count);
    }, [workouts]);

    if (streaks.length === 0) return null;

    return (
        <section>
            <h2 className="text-xl font-bold text-white mb-4">🔥 Längsta sviter</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {streaks.slice(0, 3).map((s, i) => (
                    <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/20 transition-all">
                        <div>
                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Veckosvit</p>
                            <p className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors">{s.count} veckor i rad</p>
                            <p className="text-[11px] text-emerald-500/60 mt-1 font-black uppercase tracking-wider">
                                {new Date(s.start).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} — {new Date(s.end).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                        <div className="text-2xl opacity-20 group-hover:opacity-100 transition-opacity">⚡</div>
                    </div>
                ))}
            </div>
        </section>
    );
}
