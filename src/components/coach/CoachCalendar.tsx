import React from 'react';
import { PlannedActivity, WEEKDAY_LABELS } from '../../models/types.ts';
import { PlannedActivityCard } from '../training/PlannedActivityCard.tsx';

interface CoachCalendarProps {
    activities: PlannedActivity[];
}

export function CoachCalendar({ activities }: CoachCalendarProps) {
    // Group activities by week
    const weeks = React.useMemo(() => {
        if (activities.length === 0) return [];

        const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
        const groups: PlannedActivity[][] = [];
        let currentWeek: PlannedActivity[] = [];

        let lastWeekNum = -1;
        sorted.forEach(act => {
            const date = new Date(act.date);
            // Simple Monday-based week grouping
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

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('sv-SE', { weekday: 'short' }).toUpperCase();
    };

    const getPhaseColor = (index: number, total: number) => {
        const rel = index / total;
        if (rel > 0.8) return 'border-rose-500/20 bg-rose-500/5'; // Taper
        if (rel > 0.6) return 'border-amber-500/20 bg-amber-500/5'; // Peak
        if (rel > 0.3) return 'border-indigo-500/20 bg-indigo-500/5'; // Build
        return 'border-emerald-500/20 bg-emerald-500/5'; // Base
    };

    const getPhaseLabel = (index: number, total: number) => {
        const rel = index / total;
        if (rel > 0.8) return 'TAPER';
        if (rel > 0.6) return 'PEAK';
        if (rel > 0.3) return 'BUILD';
        return 'BASE';
    };

    const totalWeeks = weeks.length;

    return (
        <div className="coach-calendar space-y-12">
            {/* Phase Transition Timeline (The high-level roadmap) */}
            {totalWeeks > 0 && (
                <div className="glass-card p-6 border-white/5 bg-white/[0.02]">
                    <div className="flex justify-between items-end mb-4">
                        <div className="space-y-1">
                            <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">Säsongens Roadmap</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Från basmängd till toppform</p>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-emerald-400 leading-none">{totalWeeks}</div>
                            <div className="text-[8px] font-black text-slate-500 uppercase">Träningsveckor</div>
                        </div>
                    </div>

                    <div className="flex h-12 gap-1 px-1 py-1 bg-slate-900/50 rounded-2xl border border-white/5 relative overflow-hidden">
                        {[
                            { label: 'Base', color: 'bg-emerald-500', width: 0.3, desc: 'Bygger tålighet' },
                            { label: 'Build', color: 'bg-indigo-500', width: 0.3, desc: 'Höjer kapacitet' },
                            { label: 'Peak', color: 'bg-amber-500', width: 0.2, desc: 'Specifik fart' },
                            { label: 'Taper', color: 'bg-rose-500', width: 0.2, desc: 'Laddar om' }
                        ].map((p, i) => (
                            <div
                                key={i}
                                className={`h-full relative group flex items-center justify-center ${p.color}/20 first:rounded-l-xl last:rounded-r-xl border-x border-white/5 overflow-hidden`}
                                style={{ width: `${p.width * 100}%` }}
                            >
                                <div className={`absolute top-0 left-0 h-1 w-full ${p.color}`} />
                                <div className="text-[10px] font-black uppercase text-white tracking-widest z-10">{p.label}</div>
                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors cursor-help" />
                                {/* Hidden on small screens, tooltip on hover */}
                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 px-3 py-2 rounded-xl text-[9px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl">
                                    {p.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {weeks.map((week, wIdx) => {
                const weekVolume = week.reduce((sum, a) => sum + (a.estimatedDistance || 0), 0);
                return (
                    <div key={wIdx} className={`relative p-6 md:p-8 rounded-[32px] border ${getPhaseColor(wIdx, weeks.length)} transition-all shadow-xl`}>
                        {/* Phase Label & Volume Summary */}
                        <div className="absolute -top-3 left-8 right-8 flex justify-between items-center px-4 py-1.5 rounded-full border border-inherit shadow-lg bg-slate-950 z-10">
                            <span className="text-[10px] font-black tracking-[0.3em] text-slate-500 shrink-0">
                                VECKA {wIdx + 1} • <span className="text-white">{getPhaseLabel(wIdx, weeks.length)}</span>
                            </span>
                            <div className="flex items-center gap-4">
                                <div className="h-1.5 w-24 bg-slate-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 opacity-60" style={{ width: `${Math.min(100, (weekVolume / 80) * 100)}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-white tabular-nums">{Math.round(weekVolume)} km</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                            {week.map(activity => (
                                <PlannedActivityCard key={activity.id} activity={activity} />
                            ))}
                        </div>
                    </div>
                )
            })}

            {activities.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-slate-500 border-2 border-dashed border-white/5 rounded-3xl">
                    <p className="text-sm font-bold">Inga pass planerade ännu.</p>
                </div>
            )}
        </div>
    );
}
