import React, { useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ExerciseEntry } from '../../models/types.ts';
import { Activity, ArrowDownUp, Dumbbell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MonthlyCalendarModalProps {
    monthIndex: number; // 0-11
    year: number;
    exercises: ExerciseEntry[];
    initialDay?: number;
    onClose: () => void;
    onExerciseClick?: (exercise: ExerciseEntry) => void;
}

import { DailyDetailModal } from './DailyDetailModal.tsx';

const getTooltipPositionClasses = (weekIdx: number, dayIdx: number): string => {
    let classes = "";

    // Y-axis: Top 2 rows appear below to prevent cutoff
    if (weekIdx <= 1) {
        classes += "top-[120%] ";
    } else {
        classes += "bottom-[120%] ";
    }

    // X-axis: Leftmost cols align left, rightmost align right
    if (dayIdx <= 1) {
        classes += "left-0 ";
    } else if (dayIdx >= 5) {
        classes += "-right-4 ";
    } else {
        classes += "left-1/2 -translate-x-1/2 ";
    }

    return classes;
};

export function MonthlyCalendarModal({ monthIndex, year, exercises, onClose, initialDay, onExerciseClick }: MonthlyCalendarModalProps) {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = React.useState<string | null>(() => {
        if (initialDay) {
            return new Date(year, monthIndex, initialDay, 12).toISOString().split('T')[0];
        }
        return null;
    });
    const [isReversed, setIsReversed] = React.useState(false);
    const monthName = new Date(year, monthIndex).toLocaleString('sv-SE', { month: 'long' });

    // Keyboard navigation
    const switchMonth = useCallback((direction: 'next' | 'prev') => {
        const newMonthIndex = direction === 'next' ? monthIndex + 1 : monthIndex - 1;
        if (newMonthIndex >= 0 && newMonthIndex <= 11) {
            const newMonthName = new Date(year, newMonthIndex).toLocaleString('sv-SE', { month: 'long' });
            navigate(`/träning/${year}/${newMonthName.toLowerCase()}`, { replace: true });
        } else if (newMonthIndex < 0) {
            // Go to prev year december
            navigate(`/träning/${year - 1}/december`, { replace: true });
        } else if (newMonthIndex > 11) {
            // Go to next year januari
            navigate(`/träning/${year + 1}/januari`, { replace: true });
        }
    }, [monthIndex, year, navigate]);

    // Keyboard shortcuts listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !selectedDate) {
                onClose();
            }
            if (e.ctrlKey && e.key === 'ArrowRight' && !selectedDate) {
                switchMonth('next');
            }
            if (e.ctrlKey && e.key === 'ArrowLeft' && !selectedDate) {
                switchMonth('prev');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, selectedDate, switchMonth]);

    // Filter exercises for this month
    const monthData = useMemo(() => {
        return exercises.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === monthIndex && d.getFullYear() === year;
        });
    }, [exercises, monthIndex, year]);

    // Calendar Grid Logic
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, monthIndex, 1);
        const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        // Adjust for Swedish week (Monday start)
        let startDayOffset = firstDayOfMonth.getDay() - 1;
        if (startDayOffset < 0) startDayOffset = 6;

        const days = [];

        // Helper to get YYYY-MM-DD in local time
        const formatLocalDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        // Leading padding days (from previous month)
        for (let i = startDayOffset; i > 0; i--) {
            const date = new Date(year, monthIndex, 1 - i, 12);
            const dateStr = formatLocalDate(date);
            const dayExercises = exercises.filter(e => e.date === dateStr);
            days.push({
                day: date.getDate(),
                exercises: dayExercises,
                dateStr,
                isCurrentMonth: false
            });
        }

        // Actual days of current month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, monthIndex, i, 12);
            const dateStr = formatLocalDate(date);
            const dayExercises = monthData.filter(e => e.date === dateStr);
            days.push({
                day: i,
                exercises: dayExercises,
                dateStr,
                isCurrentMonth: true
            });
        }

        // Trailing padding days (from next month)
        let nextDayCounter = 1;
        while (days.length % 7 !== 0) {
            const date = new Date(year, monthIndex + 1, nextDayCounter, 12);
            const dateStr = formatLocalDate(date);
            const dayExercises = exercises.filter(e => e.date === dateStr);
            days.push({
                day: date.getDate(),
                exercises: dayExercises,
                dateStr,
                isCurrentMonth: false
            });
            nextDayCounter++;
        }

        // Chunk into weeks
        const weeks = [];
        for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
        }

        return { days, weeks, daysInMonth };
    }, [year, monthIndex, monthData, exercises]);

    const stats = useMemo(() => {
        const distance = monthData.reduce((sum, e) => {
            const isRun = e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp');
            return sum + (isRun ? (e.distance || 0) : 0);
        }, 0);
        const duration = monthData.reduce((sum, e) => sum + e.durationMinutes, 0);
        const count = monthData.length;
        const tonnage = monthData.reduce((sum, e) => sum + (e.tonnage || 0), 0);

        const today = new Date();
        const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year;

        // Days passed calculation for frequency/averages
        const isPastMonth = new Date(year, monthIndex, 1) < today;
        let daysPassedForStats = calendarDays.daysInMonth;
        if (isCurrentMonth) {
            daysPassedForStats = Math.max(1, today.getDate());
        } else if (!isPastMonth) {
            daysPassedForStats = 1; // Future month, avoid divide by zero
        }

        // Pass per week (dynamic calculation based on exact days passed, not calendar rows)
        const weeksForFreq = daysPassedForStats / 7;
        const perWeek = count > 0 ? (count / weeksForFreq).toFixed(1) : '0';

        // Math.min to cap at 100% just in case of multiple workouts a day, but user might want >100%. User asked for "x / 30 dagar 72%".
        const uniqueActiveDays = monthData.filter((v, i, a) => a.findIndex(t => (t.date === v.date)) === i).length;
        const freqPercent = Math.round((uniqueActiveDays / daysPassedForStats) * 100);
        const timePerDay = Math.round(duration / daysPassedForStats);
        const distancePerWeek = daysPassedForStats > 0 ? (distance / daysPassedForStats) * 7 : 0;

        // Sessions per active day
        const sessionsPerActiveDay = uniqueActiveDays > 0 ? (count / uniqueActiveDays).toFixed(1) : '0';

        // Distribution by Time (Request: "fördelning av tiden")
        const timeDist = monthData.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + e.durationMinutes;
            return acc;
        }, {} as Record<string, number>);

        return { distance, duration, count, tonnage, timeDist, perWeek, freqPercent, timePerDay, distancePerWeek, sessionsPerActiveDay };
    }, [monthData, monthIndex, year, calendarDays.daysInMonth]);

    if (monthIndex < 0) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-2 bg-slate-950/90 [backdrop-filter:blur(8px)] transition-opacity duration-300" onClick={onClose} style={{ transform: 'translateZ(0)' }}>
            <div
                className="bg-slate-900 border-0 sm:border border-white/10 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-[98vw] lg:w-[98vw] lg:max-w-[1600px] overflow-hidden flex flex-col md:flex-row transition-all duration-300"
                onClick={e => e.stopPropagation()}
                style={{ transform: 'translateZ(0)' }}
            >
                {/* Side Panel: Summary */}
                <div className="md:w-56 lg:w-64 bg-slate-950/50 border-b md:border-b-0 md:border-r border-white/5 p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto shrink-0 max-h-[35vh] md:max-h-full">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black text-white capitalize mb-0.5">{monthName}</h2>
                            <div className="flex items-center gap-1">
                                <button onClick={() => switchMonth('prev')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Föregående månad (Ctrl + ←)">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => switchMonth('next')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Nästa månad (Ctrl + →)">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <button
                                onClick={() => setIsReversed(!isReversed)}
                                className={`p-1.5 rounded-lg border transition-colors ${isReversed ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                title="Senaste veckan överst"
                            >
                                <ArrowDownUp className="w-4 h-4" />
                            </button>
                            <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] pr-1 mt-1">{year}</p>
                        </div>
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
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5" title="Baserat på exact antal dagar in i månaden">Pass / Vecka</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-black text-sky-400 leading-none">{stats.perWeek}</p>
                                </div>
                                {parseFloat(stats.sessionsPerActiveDay) > 1.0 && (
                                    <div className="text-[9px] text-sky-500/80 font-bold mt-1 flex items-center gap-1.5" title="Eftersom du tränat flera pass samma dag">
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500/50"></div>
                                        {stats.sessionsPerActiveDay} pass / träningsdag
                                    </div>
                                )}
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
                            <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/10 flex flex-col justify-between">
                                <div>
                                    <p className="text-[9px] text-emerald-500/80 uppercase font-black tracking-widest mb-0.5">Distans</p>
                                    <p className="text-xl font-black text-emerald-400">{stats.distance.toFixed(1)} <span className="text-[10px]">km</span></p>
                                </div>
                                <div className="mt-1 flex items-center gap-1 group/avg relative">
                                    <p className="text-[9px] font-bold text-emerald-500/60 uppercase">
                                        Snitt/v: <span className="text-emerald-400 font-black">{stats.distancePerWeek.toFixed(1)} km</span>
                                    </p>
                                </div>
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
                        {(() => {
                            const now = new Date();
                            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                            return (isReversed ? [...calendarDays.weeks].reverse() : calendarDays.weeks).map((week, weekIdx) => {
                                // Calculate weekly stats for the 8th column
                                const weekExercises = week.flatMap(d => d ? d.exercises : []);
                                const runExercises = weekExercises.filter(e => e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp'));
                                const strengthExercises = weekExercises.filter(e => e.type.toLowerCase().includes('strength') || e.type.toLowerCase().includes('styrka'));
                                const weekRunDist = runExercises.reduce((sum, e) => sum + (e.distance || 0), 0);
                                const weekStrengthMin = strengthExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                                const weekTotalMin = weekExercises.reduce((sum, e) => sum + e.durationMinutes, 0);

                                // ISO Week Number mapping approx
                                const firstValidDay = week[0];
                                let weekNumberStr = '';
                                if (firstValidDay) {
                                    // Robust ISO week calculation
                                    const d = new Date(firstValidDay.dateStr + 'T12:00:00');
                                    const dayNum = d.getDay() || 7;
                                    d.setDate(d.getDate() + 4 - dayNum);
                                    const yearStart = new Date(d.getFullYear(), 0, 1);
                                    const w = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
                                    weekNumberStr = `v. ${w}`;
                                }

                                return (
                                    <div key={weekIdx} className={`grid grid-cols-8 gap-0.5 sm:gap-1 ${weekExercises.length === 0 ? 'opacity-75' : ''}`}>
                                        {/* 7 Days of the Week */}
                                        {week.map((date, dayIdx) => {
                                            const isToday = todayStr === date.dateStr;
                                            const hasExercise = date.exercises.length > 0;
                                            const isRace = date.exercises.some(e => e.subType === 'race');

                                            return (
                                                <div key={date.dateStr}
                                                    onClick={() => {
                                                        const [dYear, dMonth, dDay] = date.dateStr.split('-');
                                                        const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                        const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                        setSelectedDate(date.dateStr);
                                                        navigate(`/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`, { replace: true });
                                                    }}
                                                    className={`
                                                relative p-1 flex flex-col gap-0.5 rounded-lg sm:rounded-xl border group cursor-pointer
                                                ${!date.isCurrentMonth ? 'opacity-40 grayscale-[0.5] hover:opacity-80' : ''}
                                                ${isToday ? 'bg-sky-950/40 border-sky-500/50 shadow-[0_0_15px_rgba(56,189,248,0.1)] hover:bg-sky-900/50' :
                                                            isRace ? 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/20 hover:bg-amber-500/20' :
                                                                hasExercise ? 'bg-slate-800 border-white/10 hover:border-white/30 hover:bg-slate-700/80 shadow-sm' :
                                                                    'bg-white/[0.02] border-transparent hover:bg-white/[0.05]'}
                                            `}>
                                                    <div className="flex justify-between items-start mb-0">
                                                        <span className={`text-[9px] sm:text-[10px] font-black leading-none 
                                                        ${!date.isCurrentMonth ? 'text-slate-500' :
                                                                isToday ? 'text-sky-400 bg-sky-500/10 px-1 py-0.5 rounded-sm' :
                                                                    isRace ? 'text-amber-400' :
                                                                        hasExercise ? 'text-white' : 'text-slate-600'}`}>
                                                            {date.day}
                                                        </span>
                                                        <div className="flex items-center gap-1 group/dayinfo relative">
                                                            {hasExercise && (() => {
                                                                const totMins = Math.round(date.exercises.reduce((sum, e) => sum + e.durationMinutes, 0));
                                                                const timeStr = totMins >= 60 ? `${Math.floor(totMins / 60)}h${totMins % 60}min` : `${totMins}min`;
                                                                return (
                                                                    <span className="text-[7px] sm:text-[8px] text-slate-500 font-bold bg-white/5 px-1 rounded-sm cursor-help">
                                                                        {date.exercises.length}st • {timeStr}
                                                                    </span>
                                                                );
                                                            })()}
                                                            {isRace && <span className="text-[9px] sm:text-[10px] animate-pulse">🏆</span>}

                                                            {/* Day Total Tooltip - Only visible when hovering the summary pill */}
                                                            {hasExercise && (
                                                                <div className={`absolute top-full right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/dayinfo:opacity-100 group-hover/dayinfo:pointer-events-auto transition-all duration-300 translate-y-2 group-hover/dayinfo:translate-y-0 z-[60] hidden md:block pointer-events-none scale-95 group-hover/dayinfo:scale-100`}>
                                                                    <div className="text-[10px] text-slate-400 font-bold mb-2 pb-1 border-b border-white/10 flex justify-between">
                                                                        <span>{date.day} {monthName}</span>
                                                                        <span>{date.exercises.length} pass</span>
                                                                    </div>

                                                                    {/* List of Exercises for Day Tooltip */}
                                                                    <div className="flex flex-col gap-2 mb-2 pb-2 border-b border-white/5 text-xs">
                                                                        {date.exercises.map((e, idx) => (
                                                                            <div key={idx} className="flex justify-between items-start gap-2">
                                                                                <span className={`capitalize truncate ${e.subType === 'race' ? 'text-amber-400 font-bold' : 'text-slate-200'}`} title={e.title || e.type}>
                                                                                    {e.subType === 'race' ? '🏆 ' : ''}{e.title || e.type.replace('strength', 'Styrka').replace('running', 'Löpning')}
                                                                                </span>
                                                                                <span className="text-white font-mono font-bold shrink-0 text-[10px] mt-0.5">
                                                                                    {e.distance ? `${e.distance.toFixed(1)}km` : `${Math.round(e.durationMinutes)}m`}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {/* Aggregate Stats */}
                                                                    <div className="flex flex-col gap-1 text-[10px]">
                                                                        {(() => {
                                                                            const d = date.exercises.reduce((acc, e) => acc + (e.distance || 0), 0);
                                                                            const t = date.exercises.reduce((acc, e) => acc + e.durationMinutes, 0);
                                                                            const c = date.exercises.reduce((acc, e) => acc + (e.caloriesBurned || 0), 0);
                                                                            const v = date.exercises.reduce((acc, e) => acc + (e.tonnage || 0), 0);
                                                                            return (
                                                                                <>
                                                                                    <div className="flex justify-between"><span className="text-slate-500">Total Tid</span><span className="text-white font-mono">{Math.floor(t / 60) > 0 ? `${Math.floor(t / 60)}h ` : ''}{Math.round(t % 60)}m</span></div>
                                                                                    {d > 0 && <div className="flex justify-between"><span className="text-emerald-500/80">Tot. Distans</span><span className="text-emerald-400 font-mono">{d.toFixed(1)} km</span></div>}
                                                                                    {c > 0 && <div className="flex justify-between"><span className="text-rose-500/80">Tot. Energi</span><span className="text-rose-400 font-mono">{Math.round(c)} kcal</span></div>}
                                                                                    {v > 0 && <div className="flex justify-between"><span className="text-indigo-500/80">Tot. Volym</span><span className="text-indigo-400 font-mono">{(v / 1000).toFixed(1)} t</span></div>}
                                                                                </>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-0.5 pr-0.5 pb-0.5 pt-0.5">
                                                        {date.exercises.map(ex => {
                                                            const isRun = ex.type.includes('run') || ex.type.includes('löp');
                                                            const isStrength = ex.type.includes('strength') || ex.type.includes('styrka');

                                                            let icon: React.ReactNode = '⚡';
                                                            let typeName = 'Pass';
                                                            let colorClass = 'border-slate-500 text-slate-300 bg-slate-500/10';

                                                            if (isRun) {
                                                                icon = <Activity className="w-3 h-3 stroke-[3] text-emerald-500" />;
                                                                typeName = ex.subType === 'race' ? 'Tävling' : 'Löpning';
                                                                colorClass = 'border-emerald-500 text-emerald-100 bg-emerald-500/10';
                                                            } else if (isStrength) {
                                                                icon = <Dumbbell className="w-3 h-3 text-indigo-500" />;
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
                                                                <div key={ex.id}
                                                                    className={`relative text-[9px] sm:text-[10px] leading-none px-1 py-1 rounded-md border-l-2 ${colorClass} cursor-pointer flex justify-between items-center gap-1 group/ex min-w-0`}>
                                                                    <span className="font-bold flex gap-1 items-center min-w-0 shrink truncate opacity-90">
                                                                        {icon} <span className="hidden sm:inline truncate">{typeName}</span>
                                                                    </span>
                                                                    <span className="font-mono opacity-90 font-bold shrink-0 text-[9px]">
                                                                        {shortVal}
                                                                    </span>

                                                                    {/* Rich Tooltip per Activity */}
                                                                    <div className={`absolute ${getTooltipPositionClasses(weekIdx, dayIdx)} w-48 sm:w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 sm:p-3 shadow-2xl opacity-0 group-hover/ex:opacity-100 group-hover/ex:pointer-events-auto transition-all duration-300 translate-y-2 group-hover/ex:translate-y-0 z-[70] hidden md:block pointer-events-none scale-95 group-hover/ex:scale-100`}>
                                                                        <div className="flex flex-col gap-1.5 whitespace-normal">
                                                                            <div className="flex items-start gap-2 mb-1 pb-1.5 border-b border-white/10">
                                                                                <div className="p-1 rounded-lg bg-slate-800/50 text-white shrink-0 mt-0.5">
                                                                                    {icon}
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                                    <span className="text-xs font-bold text-white uppercase tracking-wider truncate" title={ex.title || typeName}>
                                                                                        {ex.title || typeName}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-slate-400 font-medium truncate">
                                                                                        {ex.subType === 'race' ? 'Tävling' : typeName}
                                                                                    </span>
                                                                                </div>
                                                                            </div>

                                                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-left">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Tid</span>
                                                                                    <span className="font-mono text-slate-200">{Math.round(ex.durationMinutes)} min</span>
                                                                                </div>
                                                                                {ex.distance !== undefined && ex.distance > 0 && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[8px] text-emerald-500/80 uppercase font-black tracking-widest">Distans</span>
                                                                                        <span className="font-mono text-emerald-400">{ex.distance.toFixed(2)} km</span>
                                                                                    </div>
                                                                                )}
                                                                                {ex.tonnage !== undefined && ex.tonnage > 0 && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[8px] text-indigo-500/80 uppercase font-black tracking-widest">Volym</span>
                                                                                        <span className="font-mono text-indigo-400">{(ex.tonnage / 1000).toFixed(1)} t</span>
                                                                                    </div>
                                                                                )}
                                                                                {ex.caloriesBurned !== undefined && ex.caloriesBurned > 0 && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[8px] text-rose-500/80 uppercase font-black tracking-widest">Energi</span>
                                                                                        <span className="font-mono text-rose-400">{Math.round(ex.caloriesBurned)} kcal</span>
                                                                                    </div>
                                                                                )}
                                                                                {ex.averageWatts !== undefined && ex.averageWatts > 0 && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[8px] text-sky-500/80 uppercase font-black tracking-widest">Effekt</span>
                                                                                        <span className="font-mono text-sky-400">{ex.averageWatts} W</span>
                                                                                    </div>
                                                                                )}
                                                                                {ex.heartRateAvg !== undefined && ex.heartRateAvg > 0 && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-[8px] text-amber-500/80 uppercase font-black tracking-widest">Puls</span>
                                                                                        <span className="font-mono text-amber-400">{Math.round(ex.heartRateAvg)} bpm</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            <div className="mt-2 text-[9px] text-sky-400/80 text-right font-bold pt-1.5 border-t border-sky-500/10">
                                                                                Klicka för dagsvy
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* 8th Column: Weekly Summary */}
                                        <div className="bg-slate-950/40 border border-white/[0.02] rounded-xl p-1.5 sm:p-2 flex flex-col justify-start relative group shadow-inner min-h-[40px]">
                                            {weekNumberStr && (
                                                <div className="absolute top-1 right-1 text-[7px] font-black uppercase text-slate-500 bg-black/20 px-1 py-0.5 rounded-sm line-clamp-1 truncate max-w-[90%]">
                                                    {weekNumberStr}
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-1 text-[9px] sm:text-[10px] font-mono font-bold relative z-10 w-full mt-3">
                                                <div className="flex flex-row flex-wrap gap-1">
                                                    {weekRunDist > 0 && (
                                                        <div className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded cursor-help relative group/weekrun">
                                                            <Activity className="w-3 h-3 stroke-[3]" />
                                                            <span>{Math.round(weekRunDist)}k</span>
                                                            {/* Rich Tooltip */}
                                                            <div className="absolute right-[calc(100%+0.5rem)] sm:right-full sm:mr-2 top-0 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 xl:group-hover/weekrun:opacity-100 xl:group-hover/weekrun:pointer-events-auto transition-all duration-300 translate-x-2 xl:group-hover/weekrun:translate-x-0 z-[70] hidden xl:block pointer-events-none cursor-default scale-95 xl:group-hover/weekrun:scale-100 shadow-emerald-500/10" onClick={e => e.stopPropagation()}>
                                                                <div className="text-[10px] text-slate-400 font-bold mb-2 pb-1 border-b border-white/10">Veckans Löpning</div>
                                                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                    {runExercises.map((e, idx) => (
                                                                        <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1 -mx-1 rounded cursor-pointer transition-colors"
                                                                            onClick={() => {
                                                                                const [dYear, dMonth, dDay] = e.date.split('-');
                                                                                const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                                const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                                                setSelectedDate(e.date);
                                                                                navigate(`/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`, { replace: true });
                                                                            }}>
                                                                            <span className="capitalize truncate text-slate-200" title={e.title || e.type}>{e.title || 'Löpning'}</span>
                                                                            <span className="text-white font-mono font-bold shrink-0 text-[10px]">{e.distance?.toFixed(1)}km</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] font-bold">
                                                                    <span className="text-slate-500">Totalt</span>
                                                                    <span className="text-emerald-400 font-mono">{weekRunDist.toFixed(1)} km</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {weekStrengthMin > 0 && (
                                                        <div className="flex items-center gap-0.5 bg-indigo-500/10 text-indigo-400 px-1 py-0.5 rounded cursor-help relative group/weekstr">
                                                            <span className="text-[10px] leading-none">💪</span>
                                                            <span>
                                                                {Math.floor(weekStrengthMin / 60) > 0 ? `${Math.floor(weekStrengthMin / 60)}h` : ''}
                                                                {Math.floor(weekStrengthMin / 60) > 0 && Math.round(weekStrengthMin % 60) === 0 ? '' : `${Math.round(weekStrengthMin % 60)}m`}
                                                            </span>
                                                            {/* Rich Tooltip */}
                                                            <div className="absolute right-[calc(100%+0.5rem)] sm:right-full sm:mr-2 top-0 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 xl:group-hover/weekstr:opacity-100 xl:group-hover/weekstr:pointer-events-auto transition-all duration-300 translate-x-2 xl:group-hover/weekstr:translate-x-0 z-[70] hidden xl:block pointer-events-none cursor-default scale-95 xl:group-hover/weekstr:scale-100 shadow-indigo-500/10" onClick={e => e.stopPropagation()}>
                                                                <div className="text-[10px] text-slate-400 font-bold mb-2 pb-1 border-b border-white/10">Veckans Styrka</div>
                                                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                    {strengthExercises.map((e, idx) => (
                                                                        <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1 -mx-1 rounded cursor-pointer transition-colors"
                                                                            onClick={() => {
                                                                                const [dYear, dMonth, dDay] = e.date.split('-');
                                                                                const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                                const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                                                setSelectedDate(e.date);
                                                                                navigate(`/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`, { replace: true });
                                                                            }}>
                                                                            <span className="capitalize truncate text-slate-200" title={e.title || e.type}>{e.title || 'Styrka'}</span>
                                                                            <span className="text-white font-mono font-bold shrink-0 text-[10px]">{Math.round(e.durationMinutes)}m</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] font-bold">
                                                                    <span className="text-slate-500">Totalt</span>
                                                                    <span className="text-indigo-400 font-mono">
                                                                        {Math.floor(weekStrengthMin / 60) > 0 ? `${Math.floor(weekStrengthMin / 60)}h ` : ''}{Math.round(weekStrengthMin % 60)}m
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {weekTotalMin === 0 && (
                                                        <div className="text-slate-600 italic text-[9px]">Ingen träning</div>
                                                    )}
                                                </div>

                                                {weekTotalMin > 0 && (
                                                    <div className="flex items-center justify-between border-t border-white/5 pt-1 mt-0.5 w-full text-[9px] relative group/weektot cursor-help">
                                                        <span className="text-slate-500 hidden xl:inline">Tot:</span>
                                                        <span className="text-slate-300 ml-auto flex items-center gap-1">
                                                            <span className="text-slate-500">{weekExercises.length}st</span>
                                                            <span>
                                                                {Math.floor(weekTotalMin / 60) > 0 ? `${Math.floor(weekTotalMin / 60)}h ` : ''}
                                                                {Math.round(weekTotalMin % 60)}m
                                                            </span>
                                                        </span>
                                                        {/* Rich Tooltip */}
                                                        <div className="absolute right-[calc(100%+0.5rem)] sm:right-full sm:mr-2 bottom-0 sm:bottom-auto sm:top-0 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 xl:group-hover/weektot:opacity-100 xl:group-hover/weektot:pointer-events-auto transition-all duration-300 translate-x-2 xl:group-hover/weektot:translate-x-0 z-[70] hidden xl:block pointer-events-none cursor-default scale-95 xl:group-hover/weektot:scale-100 shadow-sky-500/10" onClick={e => e.stopPropagation()}>
                                                            <div className="text-[10px] text-slate-400 font-bold mb-2 pb-1 border-b border-white/10">Veckans Alla Pass</div>
                                                            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                {weekExercises.map((e, idx) => (
                                                                    <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1 -mx-1 rounded cursor-pointer transition-colors"
                                                                        onClick={() => {
                                                                            const [dYear, dMonth, dDay] = e.date.split('-');
                                                                            const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                            const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                                            setSelectedDate(e.date);
                                                                            navigate(`/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`, { replace: true });
                                                                        }}>
                                                                        <span className="capitalize truncate text-slate-200" title={e.title || e.type}>
                                                                            {e.subType === 'race' ? '🏆 ' : ''}{e.title || e.type.replace('strength', 'Styrka').replace('running', 'Löpning')}
                                                                        </span>
                                                                        <span className="text-white font-mono font-bold shrink-0 text-[10px]">
                                                                            {e.distance ? `${e.distance.toFixed(1)}km` : `${Math.round(e.durationMinutes)}m`}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-[10px] font-bold">
                                                                <span className="text-slate-500">Totalt</span>
                                                                <span className="text-sky-400 font-mono">
                                                                    {Math.floor(weekTotalMin / 60) > 0 ? `${Math.floor(weekTotalMin / 60)}h ` : ''}{Math.round(weekTotalMin % 60)}m
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
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

            {/* Daily Detail Modal */}
            {selectedDate && (
                <DailyDetailModal
                    date={selectedDate}
                    allExercises={exercises}
                    onClose={() => {
                        setSelectedDate(null);
                        navigate(`/träning/${year}/${monthName.toLowerCase()}`, { replace: true });
                    }}
                    onDateChange={(newDate) => {
                        const [dYear, dMonth, dDay] = newDate.split('-');
                        const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                        const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                        setSelectedDate(newDate);
                        navigate(`/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`, { replace: true });
                    }}
                    onExerciseClick={onExerciseClick}
                />
            )}
        </div>,
        document.body
    );
}
