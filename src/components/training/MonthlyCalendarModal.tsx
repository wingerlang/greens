import React, { useMemo, useEffect } from 'react';
import { ExerciseEntry } from '../../models/types.ts';

interface MonthlyCalendarModalProps {
    monthIndex: number; // 0-11
    year: number;
    exercises: ExerciseEntry[];
    onClose: () => void;
}

export function MonthlyCalendarModal({ monthIndex, year, exercises, onClose }: MonthlyCalendarModalProps) {
    const monthName = new Date(year, monthIndex).toLocaleString('sv-SE', { month: 'long' });

    // ESC key listener
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Filter exercises for this month
    const monthData = useMemo(() => {
        return exercises.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === monthIndex && d.getFullYear() === year;
        });
    }, [exercises, monthIndex, year]);

    // Calendar Grid Logic
    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Adjust for Swedish week (Monday start)
        // getDay(): Sun=0, Mon=1...Sat=6
        // We want Mon=0...Sun=6
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;

        const days = [];

        // Empty slots for start
        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = new Date(year, monthIndex, i, 12).toISOString().split('T')[0];
            const dayExercises = monthData.filter(e => e.date === dateStr);
            days.push({ day: i, exercises: dayExercises });
        }

        return days;
    }, [year, monthIndex, monthData]);

    const stats = useMemo(() => {
        const distance = monthData.reduce((sum, e) => sum + (e.distance || 0), 0);
        const duration = monthData.reduce((sum, e) => sum + e.durationMinutes, 0);
        const count = monthData.length;
        const tonnage = monthData.reduce((sum, e) => sum + (e.tonnage || 0), 0);

        // Pass per week (approximate)
        const weeks = 4.33; // Average weeks per month
        const perWeek = count > 0 ? (count / weeks).toFixed(1) : '0';

        // Distribution by Time (Request: "fördelning av tiden")
        const timeDist = monthData.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + e.durationMinutes;
            return acc;
        }, {} as Record<string, number>);

        return { distance, duration, count, tonnage, timeDist, perWeek };
    }, [monthData]);

    if (monthIndex < 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-3xl p-0 shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Side Panel: Summary */}
                <div className="md:w-96 bg-slate-950/50 border-r border-white/5 p-8 flex flex-col gap-6 overflow-y-auto">
                    <div>
                        <h2 className="text-3xl font-black text-white capitalize mb-1">{monthName}</h2>
                        <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">{year}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Pass Totalt</p>
                                <p className="text-3xl font-black text-white">{stats.count} <span className="text-sm font-medium text-slate-400">st</span></p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Pass / Vecka</p>
                                <p className="text-3xl font-black text-sky-400">{stats.perWeek}</p>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Tid</p>
                            <p className="text-3xl font-black text-white">{Math.floor(stats.duration / 60)}h {Math.round(stats.duration % 60)}m</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-500/10">
                                <p className="text-[10px] text-emerald-500/80 uppercase font-black tracking-widest mb-1">Distans</p>
                                <p className="text-2xl font-black text-emerald-400">{stats.distance.toFixed(1)} <span className="text-xs">km</span></p>
                            </div>
                            <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-500/10">
                                <p className="text-[10px] text-indigo-500/80 uppercase font-black tracking-widest mb-1">Volym</p>
                                <p className="text-2xl font-black text-indigo-400">{(stats.tonnage / 1000).toFixed(1)} <span className="text-xs">t</span></p>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-4 rounded-xl border border-white/5">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Tidsfördelning</p>
                            <div className="space-y-3">
                                {Object.entries(stats.timeDist).sort((a, b) => b[1] - a[1]).map(([type, mins]) => {
                                    const percent = Math.round((mins / stats.duration) * 100);
                                    return (
                                        <div key={type} className="text-sm">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-slate-300 capitalize flex items-center gap-2 text-xs font-bold">
                                                    {type.includes('running') || type.includes('run') ? '🏃 Löpning' :
                                                        type === 'strength' ? '🏋️ Styrka' :
                                                            type === 'cycling' ? '🚴 Cykling' :
                                                                type === 'walking' ? '🚶 Promenad' :
                                                                    type}
                                                </span>
                                                <span className="font-mono font-bold text-white text-xs">{percent}% <span className="text-slate-500">({Math.round(mins)}m)</span></span>
                                            </div>
                                            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${type.includes('running') ? 'bg-emerald-500' :
                                                            type === 'strength' ? 'bg-indigo-500' :
                                                                type === 'cycling' ? 'bg-sky-500' : 'bg-slate-400'
                                                        }`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content: Calendar Grid */}
                <div className="flex-1 p-8 bg-gradient-to-br from-slate-900 to-slate-800/50 overflow-y-auto">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => (
                            <div key={d} className="text-center text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2 auto-rows-[100px]">
                        {calendarDays.map((date, i) => {
                            if (!date) return <div key={`empty-${i}`} className="bg-transparent" />;

                            const hasExercise = date.exercises.length > 0;
                            const isHeavyDay = date.exercises.some(e => e.type === 'strength' && (e.tonnage || 0) > 5000);
                            const isLongRun = date.exercises.some(e => (e.type === 'running' && (e.distance || 0) > 5));

                            return (
                                <div key={date.day} className={`
                                    relative p-2 rounded-xl border transition-all duration-300 group
                                    ${hasExercise
                                        ? 'bg-slate-800 border-white/10 hover:border-white/30 hover:bg-slate-700 hover:scale-105 shadow-lg'
                                        : 'bg-white/[0.02] border-transparent hover:bg-white/5 opacity-50 hover:opacity-100'}
                                `}>
                                    <span className={`text-xs font-bold leading-none ${hasExercise ? 'text-white' : 'text-slate-600'}`}>
                                        {date.day}
                                    </span>

                                    <div className="flex flex-wrap content-end gap-1 mt-2">
                                        {date.exercises.map(ex => {
                                            let icon = '⚡';
                                            let color = 'text-slate-400';
                                            const type = ex.type.toLowerCase();

                                            if (type.includes('run') || type.includes('löp')) { icon = '🏃'; color = 'text-emerald-400'; }
                                            if (type.includes('strength') || type.includes('styrka')) { icon = '🏋️'; color = 'text-indigo-400'; }
                                            if (type.includes('cycl') || type.includes('cyk')) { icon = '🚴'; color = 'text-sky-400'; }
                                            if (type.includes('walk') || type.includes('prom')) { icon = '🚶'; color = 'text-amber-400'; }
                                            if (type.includes('swim') || type.includes('sim')) { icon = '🏊'; color = 'text-cyan-400'; }

                                            return (
                                                <div key={ex.id} title={`${ex.type} - ${ex.durationMinutes}m`} className="hover:scale-125 transition-transform cursor-help">
                                                    <span className={`text-sm ${color}`}>{icon}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Tooltip on Hover */}
                                    {hasExercise && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-lg p-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden md:block">
                                            <div className="text-[10px] text-slate-500 font-bold mb-1 border-b border-white/5 pb-1">{date.day} {monthName}</div>
                                            {date.exercises.map((e, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs mb-1 last:mb-0">
                                                    <span className="text-white capitalize">{e.type.replace('strength', 'Styrka').replace('running', 'Löpning')}</span>
                                                    <span className="text-slate-400 font-mono">
                                                        {e.distance ? `${e.distance}km` : e.tonnage ? `${(e.tonnage / 1000).toFixed(1)}t` : `${e.durationMinutes}m`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Visual Flair for notable days */}
                                    {isHeavyDay && <div className="absolute inset-0 bg-indigo-500/5 rounded-xl pointer-events-none" />}
                                    {isLongRun && <div className="absolute inset-0 bg-emerald-500/5 rounded-xl pointer-events-none" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 transition-colors z-50 md:hidden"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
