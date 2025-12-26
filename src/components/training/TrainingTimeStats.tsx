import React, { useMemo } from 'react';
import { StrengthWorkout } from '../../models/strengthTypes.ts';

interface TrainingTimeStatsProps {
    workouts: StrengthWorkout[];
    days: number;
}

export function TrainingTimeStats({ workouts, days }: TrainingTimeStatsProps) {
    const stats = useMemo(() => {
        if (workouts.length === 0) return null;

        const totalDuration = workouts.reduce((sum, w) => sum + (w.duration || 60), 0); // Default to 60 if missing
        const avgDuration = Math.round(totalDuration / workouts.length);

        // Calculate weeks in the period
        const weeks = Math.max(1, days / 7);
        const frequency = (workouts.length / weeks).toFixed(1);

        // Day of week distribution
        const dayCounts = Array(7).fill(0);
        workouts.forEach(w => {
            const day = new Date(w.date).getDay(); // 0 = Sunday
            // Adjust to Monday = 0
            const adjustedDay = day === 0 ? 6 : day - 1;
            dayCounts[adjustedDay]++;
        });

        const maxDayCount = Math.max(...dayCounts, 1);

        return {
            totalHours: Math.round(totalDuration / 60),
            avgDuration,
            frequency,
            dayCounts,
            maxDayCount
        };
    }, [workouts, days]);

    if (!stats) return null;

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <span className="text-xl">⏱️</span>
                </div>
                <div>
                    <h3 className="text-white font-black uppercase text-sm tracking-wider">Tränings-tid</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Studera din insats</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {/* Duration Card */}
                <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-purple-500/30 transition-colors">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">Snittpass</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white group-hover:text-purple-400 transition-colors">{stats.avgDuration}</span>
                        <span className="text-xs text-slate-500 font-bold">min</span>
                    </div>
                </div>

                {/* Frequency Card */}
                <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-purple-500/30 transition-colors">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">Frekvens</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white group-hover:text-purple-400 transition-colors">{stats.frequency}</span>
                        <span className="text-xs text-slate-500 font-bold">pass / vecka</span>
                    </div>
                </div>

                {/* Total Time Card */}
                <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 flex flex-col justify-between group hover:border-purple-500/30 transition-colors">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2">Totalt (sista {days}d)</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-white group-hover:text-purple-400 transition-colors">{stats.totalHours}</span>
                        <span className="text-xs text-slate-500 font-bold">timmar</span>
                    </div>
                </div>
            </div>

            {/* Rhythm Chart */}
            <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3 text-center">Din Träningsrytm</p>
                <div className="flex items-end justify-between h-16 gap-2 px-2">
                    {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day, i) => {
                        const count = stats.dayCounts[i];
                        const height = (count / stats.maxDayCount) * 100;
                        const isZero = count === 0;

                        return (
                            <div key={day} className="flex-1 flex flex-col items-center gap-2 group/bar">
                                <div className="w-full relative h-full flex items-end justify-center">
                                    <div
                                        className={`w-full rounded-t-[1px] transition-all duration-500 ${isZero ? 'h-[2px] bg-slate-800' : 'bg-gradient-to-t from-purple-600 to-purple-400 group-hover/bar:from-purple-500 group-hover/bar:to-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]'}`}
                                        style={{ height: isZero ? '2px' : `${height}%` }}
                                    >
                                        {!isZero && (
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-900 text-[10px] text-purple-300 font-bold px-1.5 py-0.5 rounded border border-purple-500/20 whitespace-nowrap z-20">
                                                {count} pass
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-wider ${isZero ? 'text-slate-700' : 'text-purple-300'}`}>{day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Decorative BG Blob */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
        </div>
    );
}
