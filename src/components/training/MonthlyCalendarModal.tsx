import React, { useMemo, useEffect } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { Activity } from 'lucide-react';

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
            days.push({ day: i, exercises: dayExercises, dateStr });
        }

        // Empty slots for end to complete the week
        while (days.length % 7 !== 0) {
            days.push(null);
        }

        // Chunk into weeks
        const weeks = [];
        for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
        }

        return { days, weeks, daysInMonth };
    }, [year, monthIndex, monthData]);

    const stats = useMemo(() => {
        const distance = monthData.reduce((sum, e) => sum + (e.distance || 0), 0);
        const duration = monthData.reduce((sum, e) => sum + e.durationMinutes, 0);
        const count = monthData.length;
        const tonnage = monthData.reduce((sum, e) => sum + (e.tonnage || 0), 0);

        // Pass per week (approximate)
        const weeksCount = 4.33; // Average weeks per month
        const perWeek = count > 0 ? (count / weeksCount).toFixed(1) : '0';

        // Days passed calculation for frequency/averages
        const today = new Date();
        const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year;
        const isPastMonth = new Date(year, monthIndex, 1) < today;
        let daysPassedForStats = calendarDays.daysInMonth;
        if (isCurrentMonth) {
            daysPassedForStats = today.getDate();
        } else if (!isPastMonth) {
            daysPassedForStats = 1; // Future month, avoid divide by zero
        }

        // Math.min to cap at 100% just in case of multiple workouts a day, but user might want >100%. User asked for "x / 30 dagar 72%".
        const freqPercent = Math.round((monthData.filter((v, i, a) => a.findIndex(t => (t.date === v.date)) === i).length / daysPassedForStats) * 100);
        const timePerDay = Math.round(duration / daysPassedForStats);

        // Distribution by Time (Request: "fördelning av tiden")
        const timeDist = monthData.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + e.durationMinutes;
            return acc;
        }, {} as Record<string, number>);

        return { distance, duration, count, tonnage, timeDist, perWeek, freqPercent, timePerDay };
    }, [monthData, monthIndex, year, calendarDays.daysInMonth]);

    if (monthIndex < 0) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-2 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="bg-slate-900 border-0 sm:border border-white/10 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-[98vw] lg:w-[98vw] lg:max-w-[1600px] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Side Panel: Summary */}
                <div className="md:w-56 lg:w-64 bg-slate-950/50 border-b md:border-b-0 md:border-r border-white/5 p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto shrink-0 max-h-[35vh] md:max-h-full">
                    <div>
                        <h2 className="text-2xl font-black text-white capitalize mb-0.5">{monthName}</h2>
                        <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">{year}</p>
                    </div>

                    <div className="space-y-3">
                        <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5 grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Pass Totalt</p>
                                <p className="text-2xl font-black text-white flex items-baseline gap-1.5">
                                    {stats.count}
                                    <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">{stats.freqPercent}%</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Pass / Vecka</p>
                                <p className="text-2xl font-black text-sky-400">{stats.perWeek}</p>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Total Tid</p>
                                <p className="text-2xl font-black text-white">{Math.floor(stats.duration / 60)}h {Math.round(stats.duration % 60)}m</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt / Dag</p>
                                <p className="text-lg font-bold text-slate-300">{stats.timePerDay}m</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/10">
                                <p className="text-[9px] text-emerald-500/80 uppercase font-black tracking-widest mb-0.5">Distans</p>
                                <p className="text-xl font-black text-emerald-400">{stats.distance.toFixed(1)} <span className="text-[10px]">km</span></p>
                            </div>
                            <div className="bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/10">
                                <p className="text-[9px] text-indigo-500/80 uppercase font-black tracking-widest mb-0.5">Volym</p>
                                <p className="text-xl font-black text-indigo-400">{(stats.tonnage / 1000).toFixed(1)} <span className="text-[10px]">t</span></p>
                            </div>
                        </div>

                        <div className="bg-slate-800/40 p-3 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Tidsfördelning</p>
                            <div className="space-y-2">
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
                                                <span className="font-mono font-bold text-white text-xs">
                                                    {percent}% <span className="text-slate-500">
                                                        ({mins >= 60 ? `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m` : `${Math.round(mins)}m`})
                                                    </span>
                                                </span>
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
                <div className="flex-1 p-2 sm:p-3 lg:p-4 bg-gradient-to-br from-slate-900 to-slate-800/50 overflow-y-auto">
                    <div className="grid grid-cols-8 gap-1 mb-1 sm:mb-2">
                        {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön', 'Tot'].map((d, i) => (
                            <div key={d} className={`text-center text-[9px] sm:text-[10px] uppercase font-bold tracking-wider ${i === 7 ? 'text-slate-400' : 'text-slate-600'}`}>
                                {d}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-1">
                        {calendarDays.weeks.map((week, weekIdx) => {
                            // Calculate weekly stats for the 8th column
                            const weekExercises = week.flatMap(d => d ? d.exercises : []);
                            const weekRunDist = weekExercises.filter(e => e.type.includes('run')).reduce((sum, e) => sum + (e.distance || 0), 0);
                            const weekStrengthMin = weekExercises.filter(e => e.type.includes('strength')).reduce((sum, e) => sum + e.durationMinutes, 0);
                            const weekTotalMin = weekExercises.reduce((sum, e) => sum + e.durationMinutes, 0);

                            // ISO Week Number mapping approx
                            const firstValidDay = week.find(d => d !== null);
                            let weekNumberStr = '';
                            if (firstValidDay) {
                                const dObj = new Date(year, monthIndex, firstValidDay.day);
                                const dNum = dObj.getDay();
                                const diff = dObj.getDate() - dNum + (dNum === 0 ? -6 : 1);
                                const mon = new Date(dObj.setDate(diff));
                                const jan4 = new Date(mon.getFullYear(), 0, 4);
                                const w = 1 + Math.round((((mon.getTime() - jan4.getTime()) / 86400000) - 3 + ((jan4.getDay() + 6) % 7)) / 7);
                                weekNumberStr = `v. ${w}`;
                            }

                            return (
                                <div key={weekIdx} className={`grid grid-cols-8 gap-0.5 sm:gap-1 ${weekExercises.length === 0 ? 'opacity-75' : ''}`}>
                                    {/* 7 Days of the Week */}
                                    {week.map((date, dayIdx) => {
                                        if (!date) return <div key={`empty-${weekIdx}-${dayIdx}`} className="bg-transparent" />;

                                        const isToday = new Date().getDate() === date.day && new Date().getMonth() === monthIndex && new Date().getFullYear() === year;
                                        const hasExercise = date.exercises.length > 0;
                                        const isRace = date.exercises.some(e => e.subType === 'race');

                                        return (
                                            <div key={date.day} className={`
                                                relative p-1 flex flex-col gap-0.5 rounded-lg sm:rounded-xl border transition-all duration-300 group
                                                ${isToday ? 'bg-sky-950/40 border-sky-500/50 shadow-[0_0_15px_rgba(56,189,248,0.1)]' :
                                                    isRace ? 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/20' :
                                                        hasExercise ? 'bg-slate-800 border-white/10 hover:border-white/30 shadow-sm' :
                                                            'bg-white/[0.02] border-transparent'}
                                            `}>
                                                <div className="flex justify-between items-start mb-0">
                                                    <span className={`text-[9px] sm:text-[10px] font-black leading-none ${isToday ? 'text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded-sm' : isRace ? 'text-amber-400' : hasExercise ? 'text-white' : 'text-slate-600'}`}>
                                                        {date.day}
                                                    </span>
                                                    {isRace && <span className="text-[9px] sm:text-[10px] animate-pulse">🏆</span>}
                                                </div>

                                                <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar pr-0.5 pb-0.5 pt-0.5">
                                                    {date.exercises.map(ex => {
                                                        const isRun = ex.type.includes('run') || ex.type.includes('löp');
                                                        const isStrength = ex.type.includes('strength') || ex.type.includes('styrka');

                                                        let icon = '⚡';
                                                        let typeName = 'Pass';
                                                        let colorClass = 'border-slate-500 text-slate-300 bg-slate-500/10';

                                                        if (isRun) {
                                                            icon = '🏃‍♂️';
                                                            typeName = ex.subType === 'race' ? 'Tävling' : 'Löpning';
                                                            colorClass = 'border-emerald-500 text-emerald-100 bg-emerald-500/10';
                                                        } else if (isStrength) {
                                                            icon = '💪';
                                                            typeName = 'Styrka';
                                                            colorClass = 'border-indigo-500 text-indigo-100 bg-indigo-500/10';
                                                        } else if (ex.type.includes('cycl')) {
                                                            icon = '🚴';
                                                            typeName = 'Cykling';
                                                            colorClass = 'border-sky-500 text-sky-100 bg-sky-500/10';
                                                        } else if (ex.type.includes('walk')) {
                                                            icon = '🚶';
                                                            typeName = 'Promenad';
                                                            colorClass = 'border-amber-500 text-amber-100 bg-amber-500/10';
                                                        }

                                                        if (ex.subType === 'race') {
                                                            colorClass = 'border-amber-400 text-amber-100 bg-amber-500/20';
                                                        }

                                                        const fullVal = ex.distance ? `${ex.distance.toFixed(1)} km` : `${Math.round(ex.durationMinutes)} min`;
                                                        const shortVal = ex.distance ? `${Math.round(ex.distance)}k` : `${Math.round(ex.durationMinutes)}m`;

                                                        return (
                                                            <div key={ex.id} title={`${typeName} - ${fullVal}`}
                                                                className={`text-[9px] sm:text-[10px] leading-none px-1 py-1 rounded-md border-l-2 ${colorClass} truncate cursor-help flex justify-between items-center gap-1`}>
                                                                <span className="truncate opacity-90 font-bold flex gap-1 items-center">
                                                                    {icon} <span className="hidden sm:inline">{typeName}</span>
                                                                </span>
                                                                <span className="font-mono opacity-90 font-bold shrink-0 text-[9px]">
                                                                    {shortVal}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Tooltip on Hover */}
                                                {hasExercise && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950 border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 hidden md:block z-[60]">
                                                        <div className="text-[10px] text-slate-400 font-bold mb-2 pb-1 border-b border-white/10 flex justify-between">
                                                            <span>{date.day} {monthName}</span>
                                                            {isToday && <span className="text-sky-400">IDAG</span>}
                                                        </div>
                                                        {date.exercises.map((e, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-xs mb-1.5 last:mb-0">
                                                                <span className={`capitalize ${e.subType === 'race' ? 'text-amber-400 font-bold' : 'text-slate-200'}`}>
                                                                    {e.subType === 'race' ? '🏆 ' : ''}{e.type.replace('strength', 'Styrka').replace('running', 'Löpning')}
                                                                </span>
                                                                <span className="text-white font-mono font-bold">
                                                                    {e.distance ? `${e.distance.toFixed(1)} km` : `${Math.round(e.durationMinutes)}m`}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* 8th Column: Weekly Summary */}
                                    <div className="bg-slate-950/40 border border-white/[0.02] rounded-xl p-1.5 sm:p-2 flex flex-col justify-center relative group shadow-inner overflow-hidden min-h-[40px]">
                                        <div className="absolute inset-0 flex items-center justify-center text-3xl sm:text-5xl font-black text-white/[0.03] pointer-events-none select-none z-0">
                                            {weekNumberStr}
                                        </div>

                                        <div className="flex flex-row flex-wrap gap-1 text-[9px] sm:text-[10px] font-mono font-bold relative z-10 w-full items-center justify-start mt-0.5">
                                            {weekRunDist > 0 && (
                                                <div className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded cursor-help" title={`Löpning: ${weekRunDist.toFixed(1)} km`}>
                                                    <Activity className="w-3 h-3 stroke-[3]" />
                                                    <span>{Math.round(weekRunDist)}k</span>
                                                </div>
                                            )}
                                            {weekStrengthMin > 0 && (
                                                <div className="flex items-center gap-0.5 bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded cursor-help" title={`Styrka: ${Math.floor(weekStrengthMin / 60)}h ${Math.round(weekStrengthMin % 60)}m`}>
                                                    <span className="text-[10px] leading-none">💪</span>
                                                    <span>
                                                        {Math.floor(weekStrengthMin / 60) > 0 ? `${Math.floor(weekStrengthMin / 60)}h` : ''}
                                                        {Math.floor(weekStrengthMin / 60) > 0 && Math.round(weekStrengthMin % 60) === 0 ? '' : `${Math.round(weekStrengthMin % 60)}m`}
                                                    </span>
                                                </div>
                                            )}
                                            {weekTotalMin === 0 && (
                                                <div className="text-slate-600 italic text-[9px]">Ingen träning</div>
                                            )}
                                        </div>
                                    </div>
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
