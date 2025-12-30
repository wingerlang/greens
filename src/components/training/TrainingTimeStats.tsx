import React, { useState, useMemo } from 'react';
import { StrengthWorkout, PersonalBest } from '../../models/strengthTypes.ts';

interface TrainingTimeStatsProps {
    workouts: StrengthWorkout[];
    days: number;
    personalBests?: PersonalBest[];
    dateRangeLabel?: string; // e.g. "Senaste 30 dagar" or "Alla tider"
}

type ViewMode = 'sessions' | 'volume' | 'pbs' | 'exercises' | 'sets';

export function TrainingTimeStats({ workouts, days, personalBests = [], dateRangeLabel }: TrainingTimeStatsProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('sessions');

    const stats = useMemo(() => {
        if (workouts.length === 0) return null;

        // Use workouts directly - they are already filtered by the parent component
        const filteredWorkouts = workouts;

        if (filteredWorkouts.length === 0) return null;

        const dates = filteredWorkouts.map(w => new Date(w.date).getTime());
        const oldestWorkout = new Date(Math.min(...dates));
        const newestWorkout = new Date(Math.max(...dates));

        const actualDays = Math.max(7, Math.ceil((newestWorkout.getTime() - oldestWorkout.getTime()) / (24 * 60 * 60 * 1000)));
        const actualWeeks = Math.max(1, actualDays / 7);

        const totalDuration = filteredWorkouts.reduce((sum, w) => sum + (w.duration || 60), 0);
        const avgDuration = Math.round(totalDuration / filteredWorkouts.length);
        const totalVolume = filteredWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
        const totalSets = filteredWorkouts.reduce((sum, w) => sum + (w.totalSets || 0), 0);
        const totalExercises = filteredWorkouts.reduce((sum, w) => sum + (w.uniqueExercises || w.exercises?.length || 0), 0);

        const frequency = (filteredWorkouts.length / actualWeeks).toFixed(1);

        // Sessions by day of week
        const sessionsByDay = Array(7).fill(0);
        filteredWorkouts.forEach(w => {
            const day = new Date(w.date).getDay();
            const adjustedDay = day === 0 ? 6 : day - 1;
            sessionsByDay[adjustedDay]++;
        });

        // Volume by day of week
        const volumeByDay = Array(7).fill(0);
        filteredWorkouts.forEach(w => {
            const day = new Date(w.date).getDay();
            const adjustedDay = day === 0 ? 6 : day - 1;
            volumeByDay[adjustedDay] += (w.totalVolume || 0) / 1000;
        });

        // PBs by day of week - filter to same date range as workouts
        const pbsByDay = Array(7).fill(0);
        personalBests.filter(pb => new Date(pb.date) >= oldestWorkout).forEach(pb => {
            const day = new Date(pb.date).getDay();
            const adjustedDay = day === 0 ? 6 : day - 1;
            pbsByDay[adjustedDay]++;
        });

        // Exercises by day of week
        const exercisesByDay = Array(7).fill(0);
        filteredWorkouts.forEach(w => {
            const day = new Date(w.date).getDay();
            const adjustedDay = day === 0 ? 6 : day - 1;
            exercisesByDay[adjustedDay] += w.uniqueExercises || w.exercises?.length || 0;
        });

        // Sets by day of week
        const setsByDay = Array(7).fill(0);
        filteredWorkouts.forEach(w => {
            const day = new Date(w.date).getDay();
            const adjustedDay = day === 0 ? 6 : day - 1;
            setsByDay[adjustedDay] += w.totalSets || 0;
        });

        return {
            totalHours: Math.round(totalDuration / 60),
            avgDuration,
            frequency,
            totalWorkouts: filteredWorkouts.length,
            totalVolume: Math.round(totalVolume / 1000),
            totalPBs: pbsByDay.reduce((sum, v) => sum + v, 0),
            totalSets,
            totalExercises,
            actualWeeks: Math.round(actualWeeks * 10) / 10,
            sessionsByDay,
            volumeByDay,
            pbsByDay,
            exercisesByDay,
            setsByDay
        };
    }, [workouts, days, personalBests]);

    if (!stats) return null;

    const getChartData = () => {
        switch (viewMode) {
            case 'sessions': return stats.sessionsByDay;
            case 'volume': return stats.volumeByDay;
            case 'pbs': return stats.pbsByDay;
            case 'exercises': return stats.exercisesByDay;
            case 'sets': return stats.setsByDay;
            default: return stats.sessionsByDay;
        }
    };

    const chartData = getChartData();
    const maxValue = Math.max(...chartData, 0.1);
    const maxBarHeight = 56; // pixels

    const getValueLabel = (value: number) => {
        if (viewMode === 'sessions') return `${value}`;
        if (viewMode === 'volume') return `${value.toFixed(1)}t`;
        if (viewMode === 'exercises') return `${value}`;
        if (viewMode === 'sets') return `${value}`;
        return `${value}`;
    };

    const getBarColor = (isZero: boolean) => {
        if (isZero) return 'bg-slate-700';
        if (viewMode === 'pbs') return 'bg-gradient-to-t from-amber-600 to-amber-400';
        if (viewMode === 'volume') return 'bg-gradient-to-t from-emerald-600 to-emerald-400';
        if (viewMode === 'exercises') return 'bg-gradient-to-t from-cyan-600 to-cyan-400';
        if (viewMode === 'sets') return 'bg-gradient-to-t from-rose-600 to-rose-400';
        return 'bg-gradient-to-t from-purple-600 to-purple-400';
    };

    const getDayColor = (isZero: boolean) => {
        if (isZero) return 'text-slate-600';
        if (viewMode === 'pbs') return 'text-amber-400';
        if (viewMode === 'volume') return 'text-emerald-400';
        if (viewMode === 'exercises') return 'text-cyan-400';
        if (viewMode === 'sets') return 'text-rose-400';
        return 'text-purple-400';
    };

    const getViewLabel = () => {
        switch (viewMode) {
            case 'sessions': return 'Pass';
            case 'volume': return 'Ton';
            case 'pbs': return 'PBs';
            case 'exercises': return 'Övningar';
            case 'sets': return 'Set';
            default: return 'Pass';
        }
    };

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                        <span className="text-sm">⏱️</span>
                    </div>
                    <div>
                        <h3 className="text-white font-black uppercase text-[10px] tracking-wider">Träningsrytm</h3>
                        <p className="text-[8px] text-slate-400 font-bold">
                            {dateRangeLabel || `Senaste ${days} dagar`} · {stats.totalWorkouts} pass · {stats.totalHours}h totalt
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1 mb-4 relative z-10">
                {[
                    { id: 'sessions', label: 'Pass', icon: '🏋️' },
                    { id: 'volume', label: 'Ton', icon: '📊' },
                    { id: 'sets', label: 'Set', icon: '🔢' },
                    { id: 'exercises', label: 'Övn', icon: '💪' },
                    { id: 'pbs', label: 'PBs', icon: '🏆' }
                ].map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id as ViewMode)}
                        className={`text-[8px] font-black uppercase px-2 py-1 rounded transition-all ${viewMode === mode.id
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-slate-950 text-slate-500 hover:text-white border border-white/5'
                            }`}
                    >
                        {mode.icon} {mode.label}
                    </button>
                ))}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2 mb-4 relative z-10">
                <div className="text-center">
                    <p className="text-xl font-black text-white">{stats.totalWorkouts}</p>
                    <p className="text-[8px] text-slate-500 uppercase">Pass</p>
                </div>
                <div className="text-center">
                    <p className="text-xl font-black text-emerald-400">{stats.totalVolume}t</p>
                    <p className="text-[8px] text-slate-500 uppercase">Volym</p>
                </div>
                <div className="text-center">
                    <p className="text-xl font-black text-rose-400">{stats.totalSets}</p>
                    <p className="text-[8px] text-slate-500 uppercase">Set</p>
                </div>
                <div className="text-center">
                    <p className="text-xl font-black text-amber-400">{stats.totalPBs}</p>
                    <p className="text-[8px] text-slate-500 uppercase">PBs</p>
                </div>
            </div>

            {/* Chart */}
            <div className="pt-3 border-t border-white/5 relative z-10">
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-2 text-center">
                    {getViewLabel()} per veckodag
                </p>
                <div className="flex items-end justify-around gap-1">
                    {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map((day, i) => {
                        const value = chartData[i];
                        const isZero = value === 0;
                        const barHeight = isZero ? 2 : Math.max(6, Math.round((value / maxValue) * maxBarHeight));

                        return (
                            <div key={day} className="flex flex-col items-center gap-0.5 flex-1">
                                {/* Always show value label */}
                                <span
                                    className="text-[9px] font-bold h-4"
                                    style={{ color: isZero ? '#475569' : viewMode === 'pbs' ? '#fbbf24' : viewMode === 'volume' ? '#34d399' : viewMode === 'exercises' ? '#22d3ee' : viewMode === 'sets' ? '#fb7185' : '#a855f7' }}
                                >
                                    {isZero ? '-' : getValueLabel(value)}
                                </span>
                                {/* Bar */}
                                <div
                                    className={`w-full max-w-6 rounded-t transition-all duration-300 ${getBarColor(isZero)}`}
                                    style={{ height: `${barHeight}px` }}
                                />
                                {/* Day label */}
                                <span className={`text-[7px] font-bold uppercase ${getDayColor(isZero)}`}>{day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
