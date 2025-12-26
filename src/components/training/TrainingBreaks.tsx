import React, { useMemo } from 'react';
import { StrengthWorkout } from '../../models/strengthTypes.ts';

interface TrainingBreaksProps {
    workouts: StrengthWorkout[];
    filterRange?: { start: string | null, end: string | null };
}

export function TrainingBreaks({ workouts, filterRange }: TrainingBreaksProps) {
    const breaks = useMemo(() => {
        if (workouts.length < 2) return [];
        const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
        const res: { start: string, end: string, days: number }[] = [];

        for (let i = 0; i < sorted.length - 1; i++) {
            const d1 = new Date(sorted[i].date);
            const d2 = new Date(sorted[i + 1].date);
            const diffDays = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays >= 28) { // Gap of 4+ weeks
                // Check if break overlaps with current filter
                const s = filterRange?.start;
                const e = filterRange?.end;
                const bStart = sorted[i].date;
                const bEnd = sorted[i + 1].date;

                let include = true;
                if (s && bEnd < s) include = false;
                if (e && bStart > e) include = false;

                if (include) {
                    res.push({
                        start: bStart,
                        end: bEnd,
                        days: diffDays
                    });
                }
            }
        }
        return res.sort((a, b) => b.days - a.days); // Longest breaks first
    }, [workouts, filterRange]);

    if (breaks.length === 0) return null;

    return (
        <section>
            <h2 className="text-xl font-bold text-white mb-4">⏸️ Träningsuppehåll</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {breaks.slice(0, 6).map((b, i) => {
                    const formatDateStr = (dStr: string) => {
                        const d = new Date(dStr);
                        const year = d.getFullYear();
                        return `${d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} ${year}`;
                    };
                    return (
                        <div key={i} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-amber-500/20 transition-all">
                            <div>
                                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Uppehåll</p>
                                <p className="text-xl font-black text-white group-hover:text-amber-400 transition-colors">{b.days} dagar</p>
                                <p className="text-[11px] text-blue-400 mt-1 font-black uppercase tracking-wider">
                                    {formatDateStr(b.start)} — {formatDateStr(b.end)}
                                </p>
                            </div>
                            <div className="text-2xl opacity-20 group-hover:opacity-100 transition-opacity">💤</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
