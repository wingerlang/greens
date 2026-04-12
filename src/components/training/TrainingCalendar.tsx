import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { Activity, ArrowDownUp, Dumbbell, ChevronLeft, ChevronRight, ChevronDown as LucideChevronDown, ChevronUp as LucideChevronUp, Flame, Scale, HeartPulse, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DailyDetailModal } from './DailyDetailModal.tsx';
import { useData } from '../../context/DataContext.tsx';
import { isWarmupOrCooldown } from '../../utils/activityUtils.ts';

interface TrainingCalendarProps {
    monthIndex: number; // 0-11
    year: number;
    exercises: ExerciseEntry[];
    initialDay?: number;
    onExerciseClick?: (exercise: ExerciseEntry) => void;
}

const getTooltipPositionClasses = (weekIdx: number, dayIdx: number): string => {
    let classes = "";
    if (weekIdx <= 1) classes += "top-[120%] ";
    else classes += "bottom-[120%] ";

    if (dayIdx <= 1) classes += "left-0 ";
    else if (dayIdx >= 5) classes += "-right-4 ";
    else classes += "left-1/2 -translate-x-1/2 ";

    return classes;
};

const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

export function TrainingCalendar({ monthIndex, year, exercises: allExercises, initialDay, onExerciseClick }: TrainingCalendarProps) {
    const navigate = useNavigate();
    const { reorderActivity } = useData();

    const [selectedDate, setSelectedDate] = useState<string | null>(() => {
        if (initialDay) return new Date(year, monthIndex, initialDay, 12).toISOString().split('T')[0];
        return null;
    });
    const [isReversed, setIsReversed] = useState(false);

    // Dropdown states
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    // Pinned Tooltip State
    const [pinnedTooltip, setPinnedTooltip] = useState<string | null>(null);
    const [distMode, setDistMode] = useState<'time' | 'count'>('time');

    const monthName = MONTHS[monthIndex];

    const exercises = useMemo(() => {
        return allExercises.filter(e => {
            const perf = (e as any)._mergeData?.universalActivity?.performance;
            return !(e.isHiddenInCalendar || perf?.isHiddenInCalendar);
        });
    }, [allExercises]);

    // Handle clicks outside dropdowns
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(e.target as Node)) {
                setIsMonthDropdownOpen(false);
            }
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) {
                setIsYearDropdownOpen(false);
            }
            // Clear pinned tooltip if clicking outside
            if (pinnedTooltip && !(e.target as Element).closest('.calendar-tooltip-container')) {
                setPinnedTooltip(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [pinnedTooltip]);

    // Navigation helpers
    const navigateTo = useCallback((newYear: number, newMonthIdx: number) => {
        const newMonthName = MONTHS[newMonthIdx].toLowerCase();
        navigate({ pathname: `/träning/${newYear}/${newMonthName}`, search: window.location.search }, { replace: true });
    }, [navigate]);

    const switchMonth = useCallback((direction: 'next' | 'prev') => {
        let newMonthIndex = direction === 'next' ? monthIndex + 1 : monthIndex - 1;
        let newYear = year;

        if (newMonthIndex < 0) {
            newMonthIndex = 11;
            newYear -= 1;
        } else if (newMonthIndex > 11) {
            newMonthIndex = 0;
            newYear += 1;
        }
        navigateTo(newYear, newMonthIndex);
    }, [monthIndex, year, navigateTo]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'ArrowRight' && !selectedDate) switchMonth('next');
            if (e.ctrlKey && e.key === 'ArrowLeft' && !selectedDate) switchMonth('prev');
            // Allow closing dropdowns with escape
            if (e.key === 'Escape') {
                setIsMonthDropdownOpen(false);
                setIsYearDropdownOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedDate, switchMonth]);

    const monthData = useMemo(() => {
        return exercises.filter(e => {
            const parts = e.date.split('-');
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[0]);
            return m === monthIndex && y === year;
        });
    }, [exercises, monthIndex, year]);

    // Calendar Grid Logic
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(year, monthIndex, 1);
        const lastDayOfMonth = new Date(year, monthIndex + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        let startDayOffset = firstDayOfMonth.getDay() - 1;
        if (startDayOffset < 0) startDayOffset = 6;

        const days = [];
        const formatLocalDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        for (let i = startDayOffset; i > 0; i--) {
            const date = new Date(year, monthIndex, 1 - i, 12);
            const dateStr = formatLocalDate(date);
            days.push({ day: date.getDate(), exercises: exercises.filter(e => e.date === dateStr), dateStr, isCurrentMonth: false });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, monthIndex, i, 12);
            const dateStr = formatLocalDate(date);
            const dayExercises = monthData.filter(e => e.date === dateStr).sort((a, b) => {
                const orderA = a.order ?? 999;
                const orderB = b.order ?? 999;
                if (orderA !== orderB) return orderA - orderB;
                
                const timeA = a.startTime || (a.date.includes('T') ? a.date.split('T')[1].substring(0, 5) : '23:59');
                const timeB = b.startTime || (b.date.includes('T') ? b.date.split('T')[1].substring(0, 5) : '23:59');
                return timeA.localeCompare(timeB);
            });
            days.push({ day: i, exercises: dayExercises, dateStr, isCurrentMonth: true });
        }

        let nextDayCounter = 1;
        while (days.length % 7 !== 0) {
            const date = new Date(year, monthIndex + 1, nextDayCounter, 12);
            const dateStr = formatLocalDate(date);
            days.push({ day: date.getDate(), exercises: exercises.filter(e => e.date === dateStr), dateStr, isCurrentMonth: false });
            nextDayCounter++;
        }

        const weeks = [];
        for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

        return { days, weeks, daysInMonth };
    }, [year, monthIndex, monthData, exercises]);

    const stats = useMemo(() => {
        const countableExercises = monthData.filter(e => 
            !e.type.toLowerCase().includes('walk') && 
            !e.type.toLowerCase().includes('promenad')
        );

        const distance = countableExercises.reduce((sum, e) => {
            const isRun = e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp');
            return sum + (isRun ? (e.distance || 0) : 0);
        }, 0);
        const duration = countableExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
        
        const sessions = countableExercises.filter(e => !isWarmupOrCooldown(e));
        const warmups = countableExercises.filter(e => isWarmupOrCooldown(e));
        
        const count = sessions.length;
        const warmupCount = warmups.length;
        const tonnage = countableExercises.reduce((sum, e) => sum + (e.tonnage || 0), 0);

        const today = new Date();
        const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year;
        const isPastMonth = new Date(year, monthIndex, 1) < today;
        let daysPassedForStats = calendarDays.daysInMonth;

        if (isCurrentMonth) daysPassedForStats = Math.max(1, today.getDate());
        else if (!isPastMonth) daysPassedForStats = 1;

        const weeksForFreq = daysPassedForStats / 7;
        const perWeek = count > 0 ? (count / weeksForFreq).toFixed(1) : '0';
        const uniqueActiveDays = monthData.filter((v, i, a) => a.findIndex(t => t.date === v.date) === i).length;
        const freqPercent = Math.round((uniqueActiveDays / daysPassedForStats) * 100);
        const timePerDay = Math.round(duration / daysPassedForStats);
        const distancePerWeek = daysPassedForStats > 0 ? (distance / daysPassedForStats) * 7 : 0;
        const sessionsPerActiveDay = uniqueActiveDays > 0 ? (count / uniqueActiveDays).toFixed(1) : '0';

        const timeDist = countableExercises.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + e.durationMinutes;
            return acc;
        }, {} as Record<string, number>);

        const countDist = sessions.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const hrActivities = monthData.filter(e => e.heartRateAvg && e.heartRateAvg > 0);
        const avgHr = hrActivities.length > 0 
            ? Math.round(hrActivities.reduce((sum, e) => sum + e.heartRateAvg!, 0) / hrActivities.length) 
            : 0;
        const inactiveDays = Math.max(0, daysPassedForStats - uniqueActiveDays);

        return { 
            distance, duration, count, warmupCount, warmups, 
            tonnage, timeDist, countDist, perWeek, freqPercent, 
            timePerDay, distancePerWeek, sessionsPerActiveDay, avgHr, inactiveDays 
        };
    }, [monthData, monthIndex, year, calendarDays.daysInMonth]);

    if (monthIndex < 0) return null;

    // Available years based on data + current year
    const availableYears = useMemo(() => {
        const currentY = new Date().getFullYear();
        const startY = 2010;
        const years = [];
        for (let y = currentY + 1; y >= startY; y--) years.push(y);
        return years;
    }, []);

    return (
        <div className="bg-slate-900 border border-white/5 rounded-lg shadow-xl w-full flex flex-col overflow-visible transition-all duration-300 relative z-10 my-4">
            {/* Header: Month/Year Nav */}
            <div className="bg-slate-950/50 border-b border-white/5 p-4 flex items-center justify-between overflow-visible rounded-t-lg relative z-50">
                <div className="flex flex-col gap-2 relative z-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => switchMonth('prev')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Föregående (Ctrl + ←)">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="relative" ref={monthDropdownRef}>
                                <button
                                    onClick={() => { setIsMonthDropdownOpen(!isMonthDropdownOpen); setIsYearDropdownOpen(false); }}
                                    className={`flex items-center gap-1 text-xl sm:text-2xl font-black capitalize transition-colors ${isMonthDropdownOpen ? 'text-sky-400' : 'text-white hover:text-sky-300'}`}
                                >
                                    {monthName}
                                    <LucideChevronDown className={`w-4 h-4 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isMonthDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-32 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1 z-50 overflow-hidden">
                                        {MONTHS.map((m, idx) => (
                                            <button
                                                key={m}
                                                onClick={() => { navigateTo(year, idx); setIsMonthDropdownOpen(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors ${idx === monthIndex ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => switchMonth('next')} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="Nästa (Ctrl + →)">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative" ref={yearDropdownRef}>
                                <button
                                    onClick={() => { setIsYearDropdownOpen(!isYearDropdownOpen); setIsMonthDropdownOpen(false); }}
                                    className={`flex items-center gap-1 text-base sm:text-lg font-bold transition-colors border px-2 py-0.5 rounded-lg ${isYearDropdownOpen ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    {year}
                                    <LucideChevronDown className={`w-3 h-3 transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isYearDropdownOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-24 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-1 z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {availableYears.map(y => (
                                            <button
                                                key={y}
                                                onClick={() => { navigateTo(y, monthIndex); setIsYearDropdownOpen(false); }}
                                                className={`w-full text-center px-2 py-2 text-sm font-bold transition-colors ${y === year ? 'bg-sky-500/10 text-sky-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                                            >
                                                {y}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setIsReversed(!isReversed)}
                                className={`p-1.5 rounded-lg border transition-colors flex items-center text-xs font-bold shrink-0 ${isReversed ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}
                                title="Växla sorteringsordning på veckor"
                            >
                                <ArrowDownUp className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline ml-1">{isReversed ? 'Senaste först' : 'Äldsta först'}</span>
                            </button>
                        </div>
                    </div>


                </div>
            </div>

            {/* Main Content: Calendar Grid */}
            <div className="flex-1 p-1 sm:p-2 lg:p-3 bg-gradient-to-br from-slate-900 to-slate-800/50 relative z-10 flex flex-col justify-center">
                <div className="grid grid-cols-8 mb-1 sm:mb-1">
                    {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön', 'Tot'].map((d, i) => (
                        <div key={d} className={`text-center text-[10px] sm:text-xs uppercase font-bold tracking-wider ${i === 7 ? 'text-slate-400' : 'text-slate-500'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-1 sm:gap-2">
                    {(() => {
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                        return (isReversed ? [...calendarDays.weeks].reverse() : calendarDays.weeks).map((week, weekIdx) => {
                            const weekExercises = week.flatMap(d => d ? d.exercises : []);
                            const runExercises = weekExercises.filter(e => e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp'));
                            const strengthExercises = weekExercises.filter(e => e.type.toLowerCase().includes('strength') || e.type.toLowerCase().includes('styrka'));
                            const weekTotalMin = weekExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const weekRunDist = runExercises.reduce((sum, e) => sum + (e.distance || 0), 0);
                            const weekStrengthMin = strengthExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const weekTonnage = strengthExercises.reduce((sum, e) => sum + (e.tonnage || 0), 0);
                            const weekCalories = weekExercises.reduce((sum, e) => sum + (e.caloriesBurned || 0), 0);
                            const otherCardioExercises = weekExercises.filter(e => {
                                const type = e.type.toLowerCase();
                                return !type.includes('run') && !type.includes('löp') && !type.includes('strength') && !type.includes('styrka');
                            });
                            const weekOtherCardioMin = otherCardioExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const weekOtherCardioCount = otherCardioExercises.length;

                            const firstValidDay = week[0];
                            let weekNumberStr = '';
                            if (firstValidDay) {
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
                                                    setSelectedDate(date.dateStr);
                                                    navigate({
                                                        pathname: `/träning/${year}/${monthName.toLowerCase()}/${date.day}`,
                                                        search: window.location.search
                                                    }, { replace: true });
                                                }}
                                                className={`
                                            relative p-0.5 flex flex-col rounded-md sm:rounded-sm border group cursor-pointer transition-all duration-200 min-h-[70px] hover:z-50
                                            ${!date.isCurrentMonth ? 'opacity-60 grayscale-[0.3] hover:opacity-90 hover:grayscale-0' : ''}
                                            ${isToday ? 'bg-sky-950/40 border-sky-500/50 shadow-[0_0_15px_rgba(56,189,248,0.1)] hover:bg-sky-900/50 hover:border-sky-400' :
                                                        isRace ? 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/20 hover:bg-amber-500/20 hover:border-amber-400' :
                                                            hasExercise ? 'bg-slate-800 border-white/10 hover:border-white/30 hover:bg-slate-700/80 shadow-sm' :
                                                                'bg-slate-900/50 border-white/[0.03] hover:bg-white/[0.05] hover:border-white/10'}
                                        `}>
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className={`text-[10px] sm:text-sm font-black leading-none 
                                                    ${!date.isCurrentMonth ? 'text-slate-500' :
                                                            isToday ? 'text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-sm' :
                                                                isRace ? 'text-amber-400' :
                                                                    hasExercise ? 'text-white' : 'text-slate-600'}`}>
                                                        {date.day}
                                                    </span>
                                                    <div className="flex items-center gap-1 group/dayinfo relative">
                                                        {hasExercise && (() => {
                                                            const sessions = date.exercises.filter(e => !isWarmupOrCooldown(e));
                                                            const warmCount = date.exercises.filter(e => isWarmupOrCooldown(e)).length;
                                                            const totMins = Math.round(date.exercises.reduce((sum, e) => sum + e.durationMinutes, 0));
                                                            const timeStr = totMins >= 60 ? `${Math.floor(totMins / 60)}h${totMins % 60}m` : `${totMins}m`;
                                                            return (
                                                                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold bg-white/5 px-1 py-0.5 rounded-sm cursor-help transition-colors hover:text-slate-200 hover:bg-white/10">
                                                                    {sessions.length}{warmCount > 0 ? ` (+${warmCount})` : ''} pass • {timeStr}
                                                                </span>
                                                            );
                                                        })()}
                                                        {isRace && <span className="text-[10px] sm:text-xs animate-pulse">🏆</span>}

                                                        {/* Day Total Tooltip */}
                                                        {hasExercise && (
                                                            <div className={`absolute mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/dayinfo:opacity-100 transition-all duration-300 translate-y-2 group-hover/dayinfo:translate-y-0 z-[9999] hidden md:block pointer-events-none scale-95 group-hover/dayinfo:scale-100`} style={{ left: '50%', transform: 'translateX(-50%)', top: '100%' }}>
                                                                <div className="text-xs text-slate-400 font-bold mb-2 pb-1 border-b border-white/10 flex justify-between">
                                                                    <span>{date.day} {monthName}</span>
                                                                    {(() => {
                                                                        const sessions = date.exercises.filter(e => !isWarmupOrCooldown(e));
                                                                        const warmCount = date.exercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                        return <span>{sessions.length}{warmCount > 0 ? ` (+${warmCount})` : ''} pass</span>;
                                                                    })()}
                                                                </div>

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

                                                <div className="flex flex-col w-full flex-1">
                                                    {date.exercises.map(ex => {
                                                        const isRun = ex.type.includes('run') || ex.type.includes('löp');
                                                        const isStrength = ex.type.includes('strength') || ex.type.includes('styrka');

                                                        let icon: React.ReactNode = '⚡';
                                                        let typeName = 'Pass';
                                                        let colorClass = 'border-slate-500 text-slate-300 bg-slate-500/10 hover:bg-slate-500/20';

                                                        if (isRun) {
                                                            icon = <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3] text-emerald-500" />;
                                                            typeName = ex.subType === 'race' ? 'Tävling' : 'Löpning';
                                                            colorClass = 'border-emerald-500 text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20';
                                                        } else if (isStrength) {
                                                            icon = <Dumbbell className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />;
                                                            typeName = 'Styrka';
                                                            colorClass = 'border-indigo-500 text-indigo-100 bg-indigo-500/10 hover:bg-indigo-500/20';
                                                        } else if (ex.type.includes('cycl')) {
                                                            icon = '🚴';
                                                            typeName = 'Cykling';
                                                            colorClass = 'border-sky-500 text-sky-100 bg-sky-500/10 hover:bg-sky-500/20';
                                                        } else if (ex.type.includes('walk')) {
                                                            icon = '🚶';
                                                            typeName = 'Promenad';
                                                            colorClass = 'border-amber-500 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20';
                                                        }

                                                        if (ex.subType === 'race') {
                                                            colorClass = 'border-amber-400 text-amber-100 bg-amber-500/20 hover:bg-amber-500/30';
                                                        }

                                                        const displayName = ex.title || typeName;
                                                        const isLongName = displayName.length > 20;

                                                        return (
                                                            <div key={ex.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate({
                                                                        pathname: `/träning/${year}/${monthName.toLowerCase()}`,
                                                                        search: `?activityId=${ex.id}${window.location.search ? '&' + window.location.search.replace('?', '') : ''}`
                                                                    }, { replace: true });
                                                                }}
                                                                className={`relative text-[9.5px] sm:text-[10px] leading-tight pl-0.5 sm:pl-1 pr-1 sm:pr-1.5 py-0.5 sm:py-1 rounded border ${colorClass} cursor-pointer flex flex-row flex-wrap items-center justify-between gap-y-0.5 group/ex min-w-0 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md ${isLongName ? 'pb-1' : ''}`}>
                                                                <span className={`font-bold flex items-center min-w-0 shrink z-10 ${isLongName ? 'w-full mb-0.5' : 'truncate'}`}>
                                                                    <div className="opacity-70 shrink-0 z-0 scale-[1.1]">{icon}</div>
                                                                    <span className={`flex items-center gap-0.5 leading-none relative z-10 ml-0.5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.8)] text-white/95 ${isLongName ? '' : 'truncate'}`}>
                                                                        {(ex.subType === 'interval' || ex.subType === 'tempo' || ex.title?.toLowerCase().includes('intervall')) && <span className="text-amber-400 shrink-0">⚡</span>}
                                                                        <span className={isLongName ? '' : 'truncate'}>{displayName}</span>
                                                                    </span>
                                                                </span>
                                                                <div className={`flex items-center gap-1 text-[8.5px] font-mono text-slate-300 z-10 whitespace-nowrap ${isLongName ? 'pl-4' : 'ml-auto'}`}>
                                                                    {ex.distance !== undefined && ex.distance > 0 && <span className="text-emerald-400/90 font-bold">{ex.distance.toFixed(1)}<span className="text-[7.5px] opacity-70">k</span></span>}
                                                                    {ex.distance !== undefined && ex.distance > 0 && <span className="opacity-30">•</span>}
                                                                    <div className="hidden group-hover/ex:flex items-center gap-0.5 ml-1">
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); reorderActivity(ex.id, 'up'); }}
                                                                            className="p-0.5 hover:bg-white/20 rounded transition-colors"
                                                                        >
                                                                            <LucideChevronUp size={10} />
                                                                        </button>
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); reorderActivity(ex.id, 'down'); }}
                                                                            className="p-0.5 hover:bg-white/20 rounded transition-colors"
                                                                        >
                                                                            <LucideChevronDown size={10} />
                                                                        </button>
                                                                    </div>
                                                                    {ex.heartRateAvg !== undefined && ex.heartRateAvg > 0 && (
                                                                        <>
                                                                            <span className="opacity-30">•</span>
                                                                            <span className="text-red-400/90 font-bold">{Math.round(ex.heartRateAvg)}<Heart className="w-2 h-2 text-red-500/70 inline-block ml-0.5" /></span>
                                                                        </>
                                                                    )}
                                                                    {ex.distance !== undefined && ex.distance > 0 && ex.durationMinutes > 0 && (isRun || isLongName) && (
                                                                        <>
                                                                            <span className="opacity-30">•</span>
                                                                            <span className="text-sky-400">
                                                                                {(() => {
                                                                                    const paceDecimal = ex.durationMinutes / ex.distance;
                                                                                    const mins = Math.floor(paceDecimal);
                                                                                    const secs = Math.round((paceDecimal - mins) * 60);
                                                                                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                                                                                })()}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    <span className="opacity-30">•</span>
                                                                    <span>{Math.round(ex.durationMinutes)}m</span>
                                                                </div>

                                                                {/* Rich Tooltip per Activity - positioned absolutely inside the relative day cell */}
                                                                <div className={`absolute ${weekIdx <= 1 ? 'mt-2 top-full' : 'mb-2 bottom-full'} ${dayIdx <= 3 ? 'left-[-10%]' : 'right-[-10%]'} w-56 sm:w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 sm:p-4 shadow-2xl opacity-0 group-hover/ex:opacity-100 transition-all duration-300 z-[9999] hidden md:block pointer-events-none scale-95 group-hover/ex:scale-100`}>
                                                                    <div className="flex flex-col gap-2 whitespace-normal">
                                                                        <div className="flex items-start gap-3 mb-2 pb-2 border-b border-white/10">
                                                                            <div className="p-2 rounded-xl bg-slate-800/80 text-white shrink-0 shadow-inner">
                                                                                {icon}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                                <span className="text-sm font-black text-white uppercase tracking-wider truncate mb-0.5" title={ex.title || typeName}>
                                                                                    {ex.title || typeName}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 font-bold truncate">
                                                                                    {ex.subType === 'race' ? 'Tävling' : typeName}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-left px-1">
                                                                            <div className="flex flex-col">
                                                                                 <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Tid</span>
                                                                                 <span className="font-mono text-slate-200 font-bold">{Math.round(ex.durationMinutes)} min</span>
                                                                             </div>
                                                                             {ex.startTime && (
                                                                                 <div className="flex flex-col">
                                                                                     <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Start</span>
                                                                                     <span className="font-mono text-slate-200 font-bold">{ex.startTime}</span>
                                                                                 </div>
                                                                             )}
                                                                            {ex.distance !== undefined && ex.distance > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-emerald-500/80 uppercase font-black tracking-widest">Distans</span>
                                                                                    <span className="font-mono text-emerald-400 font-bold">{ex.distance.toFixed(2)} km</span>
                                                                                </div>
                                                                            )}
                                                                            {ex.distance !== undefined && ex.distance > 0 && ex.durationMinutes > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-sky-500/80 uppercase font-black tracking-widest">Tempo</span>
                                                                                    <span className="font-mono text-sky-400 font-bold">
                                                                                        {(() => {
                                                                                            const paceDecimal = ex.durationMinutes / ex.distance;
                                                                                            const mins = Math.floor(paceDecimal);
                                                                                            const secs = Math.round((paceDecimal - mins) * 60);
                                                                                            const finalSecs = secs === 60 ? 0 : secs;
                                                                                            const finalMins = secs === 60 ? mins + 1 : mins;
                                                                                            return `${finalMins}:${finalSecs.toString().padStart(2, '0')}`;
                                                                                        })()}
                                                                                        <span className="text-[8px] ml-0.5 opacity-70">min/km</span>
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {ex.tonnage !== undefined && ex.tonnage > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-indigo-500/80 uppercase font-black tracking-widest">Volym</span>
                                                                                    <span className="font-mono text-indigo-400 font-bold">{(ex.tonnage / 1000).toFixed(1)} t</span>
                                                                                </div>
                                                                            )}
                                                                            {ex.caloriesBurned !== undefined && ex.caloriesBurned > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-rose-500/80 uppercase font-black tracking-widest">Energi</span>
                                                                                    <span className="font-mono text-rose-400 font-bold">{Math.round(ex.caloriesBurned)} kcal</span>
                                                                                </div>
                                                                            )}
                                                                            {ex.averageWatts !== undefined && ex.averageWatts > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-sky-500/80 uppercase font-black tracking-widest">Effekt</span>
                                                                                    <span className="font-mono text-sky-400 font-bold">{ex.averageWatts} W</span>
                                                                                </div>
                                                                            )}
                                                                            {ex.heartRateAvg !== undefined && ex.heartRateAvg > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-amber-500/80 uppercase font-black tracking-widest">Puls</span>
                                                                                    <span className="font-mono text-amber-400 font-bold">{Math.round(ex.heartRateAvg)} bpm</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {ex.notes && (
                                                                            <div className="mt-3 pt-2 border-t border-white/5">
                                                                                <p className="text-[10px] text-slate-400 leading-relaxed italic whitespace-pre-wrap line-clamp-3">
                                                                                    {ex.notes}
                                                                                </p>
                                                                            </div>
                                                                        )}

                                                                        <div className="mt-3 text-[10px] text-sky-400/80 text-right font-bold pt-2 border-t border-sky-500/10">
                                                                            Klicka för dagsvy & detaljer
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
                                    <div className="bg-slate-900/80 border border-white/[0.05] rounded-lg sm:rounded-sm p-0.5 sm:p-0.5 flex flex-col justify-center items-center relative group shadow-inner min-h-[70px] hover:z-50">
                                        {weekNumberStr && (
                                            <div className="absolute top-0.5 right-0.5 text-[8px] font-black uppercase text-slate-500 bg-white/5 px-1 py-0.5 rounded-sm leading-none">
                                                {weekNumberStr}
                                            </div>
                                        )}

                                        <div className="flex flex-col items-center gap-0 text-[9px] sm:text-[10px] font-mono font-bold w-full mt-2 sm:mt-2.5">
                                            <div className="flex flex-col gap-0.5 w-full">
                                                {weekRunDist > 0 && (
                                                    <div
                                                        className="flex items-center justify-between bg-emerald-500/10 text-emerald-400 px-1.5 py-1 rounded cursor-help relative group/weekrun hover:bg-emerald-500/20 transition-colors w-full border border-emerald-500/10 mb-0.5 calendar-tooltip-container"
                                                        onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `run-${weekIdx}` ? null : `run-${weekIdx}`) }}
                                                    >
                                                        <Activity className="w-3.5 h-3.5 stroke-[3]" />
                                                        <div className="flex items-baseline gap-1">
                                                            <div className="flex flex-col items-end">
                                                                <span>{Math.round(weekRunDist)}<span className="text-[8px] ml-0.5 font-bold uppercase">km</span></span>
                                                                {(() => {
                                                                    const now = new Date();
                                                                    const isCurrentWeek = week.some(d => d.dateStr === todayStr);
                                                                    if (isCurrentWeek) {
                                                                        const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
                                                                        const projected = (weekRunDist / dayOfWeek) * 7;
                                                                        return <span className="text-[7.5px] text-emerald-500/60 leading-none">Proj: {Math.round(projected)}k</span>;
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            <span className="text-[8px] opacity-40 mx-0.5">•</span>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px]">{runExercises.length}<span className="text-[8px] ml-0.5 opacity-50 font-normal group-hover:opacity-80 transition-opacity">p</span></span>
                                                                {(() => {
                                                                    const now = new Date();
                                                                    const isCurrentWeek = week.some(d => d.dateStr === todayStr);
                                                                    if (isCurrentWeek) {
                                                                        const dayOfWeek = now.getDay() || 7;
                                                                        const projectedFreq = (runExercises.length / dayOfWeek) * 7;
                                                                        return <span className="text-[7.5px] text-slate-500 leading-none">{projectedFreq.toFixed(1)}/v</span>;
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            <span className="text-[8px] opacity-40 mx-0.5">•</span>
                                                            <span className="text-[10px]">
                                                                {(() => {
                                                                    const mins = runExercises.reduce((acc, e) => acc + e.durationMinutes, 0);
                                                                    return Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)}h${Math.round(mins % 60)}m` : `${Math.round(mins)}m`;
                                                                })()}
                                                            </span>
                                                        </div>

                                                        {/* Rich Tooltip */}
                                                        <div
                                                            className={`absolute right-full mr-2 top-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-sm p-3 shadow-2xl transition-all duration-300 z-[9999] hidden xl:block scale-95 shadow-emerald-500/10 ${pinnedTooltip === `run-${weekIdx}` ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto' : 'opacity-0 xl:group-hover/weekrun:opacity-100 -translate-x-2 xl:group-hover/weekrun:translate-x-0 pointer-events-none xl:group-hover/weekrun:scale-100 cursor-default'}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="text-xs text-slate-400 font-bold mb-2 pb-2 border-b border-white/10">Veckans Löpning</div>
                                                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                {runExercises.map((e, idx) => {
                                                                    const [dYear, dMonth, dDay] = e.date.split('-');
                                                                    const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                    const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                                    return (
                                                                        <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1.5 -mx-1.5 rounded-sm cursor-pointer transition-colors"
                                                                            onClick={() => {
                                                                                setSelectedDate(e.date);
                                                                                navigate({
                                                                                    pathname: `/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`,
                                                                                    search: window.location.search
                                                                                }, { replace: true });
                                                                            }}>
                                                                            <span className="capitalize text-emerald-100 font-medium truncate" title={e.title || e.type}>{e.subType === 'race' ? '🏆 ' : ''}{e.title || 'Löpning'}</span>
                                                                            <div className="text-right shrink-0 flex items-center gap-1 font-mono text-[10px] font-bold">
                                                                                 {e.distance && <span className="text-emerald-400">{e.distance.toFixed(1)}k</span>}
                                                                                 {e.distance && <span className="text-slate-500">•</span>}
                                                                                 <span className="text-sky-400">{Math.round(e.durationMinutes)}m</span>
                                                                                 {e.heartRateAvg && <span className="text-slate-500">•</span>}
                                                                                 {e.heartRateAvg && <span className="text-amber-400/90 flex items-center gap-0.5">{Math.round(e.heartRateAvg)}<Heart className="w-2 h-2 text-amber-500/50" /></span>}
                                                                                 <span className="text-slate-500">•</span>
                                                                                 <span className="text-rose-400/90">{Math.round(e.caloriesBurned || 0)}c</span>
                                                                             </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs font-black items-end">
                                                                <span className="text-slate-500 uppercase tracking-widest">Totalt</span>
                                                                <div className="text-right">
                                                                    <div className="text-emerald-400 font-mono">{weekRunDist.toFixed(1)} km</div>
                                                                    <div className="text-slate-400 font-mono text-[9px] font-normal">{runExercises.reduce((acc, e) => acc + e.durationMinutes, 0)}m</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {weekStrengthMin > 0 && (
                                                    <div
                                                        className="flex items-center justify-between bg-indigo-500/10 text-indigo-400 px-1.5 py-1 rounded cursor-help relative group/weekstr hover:bg-indigo-500/20 transition-colors w-full border border-indigo-500/10 mb-0.5 calendar-tooltip-container"
                                                        onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `str-${weekIdx}` ? null : `str-${weekIdx}`) }}
                                                    >
                                                        <Dumbbell className="w-3.5 h-3.5" />
                                                        <div className="flex items-baseline gap-1">
                                                            <span>
                                                                {Math.floor(weekStrengthMin / 60) > 0 ? `${Math.floor(weekStrengthMin / 60)}h` : ''}
                                                                {Math.floor(weekStrengthMin / 60) > 0 && Math.round(weekStrengthMin % 60) === 0 ? '' : `${Math.round(weekStrengthMin % 60)}m`}
                                                            </span>
                                                            <span className="text-[8px] opacity-40 mx-0.5">•</span>
                                                            <span className="text-[10px]">{strengthExercises.length}<span className="text-[8px] ml-0.5 opacity-50 font-normal group-hover:opacity-80 transition-opacity">pass</span></span>
                                                        </div>
                                                        {/* Rich Tooltip */}
                                                        <div
                                                            className={`absolute right-full mr-2 top-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl transition-all duration-300 z-[9999] hidden xl:block scale-95 shadow-indigo-500/10 ${pinnedTooltip === `str-${weekIdx}` ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto' : 'opacity-0 xl:group-hover/weekstr:opacity-100 -translate-x-2 xl:group-hover/weekstr:translate-x-0 pointer-events-none xl:group-hover/weekstr:scale-100 cursor-default'}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <div className="text-xs text-slate-400 font-bold mb-2 pb-2 border-b border-white/10">Veckans Styrka</div>
                                                            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                {strengthExercises.map((e, idx) => {
                                                                    const [dYear, dMonth, dDay] = e.date.split('-');
                                                                    const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                    const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                                    return (
                                                                        <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1.5 -mx-1.5 rounded-lg cursor-pointer transition-colors"
                                                                            onClick={() => {
                                                                                setSelectedDate(e.date);
                                                                                navigate({
                                                                                    pathname: `/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`,
                                                                                    search: window.location.search
                                                                                }, { replace: true });
                                                                            }}>
                                                                            <span className="capitalize text-indigo-100 font-medium truncate" title={e.title || e.type}>{e.title || 'Styrka'}</span>
                                                                            <div className="text-right shrink-0 flex items-center gap-1 font-mono text-[10px] font-bold">
                                                                                 <span className="text-sky-400">{Math.round(e.durationMinutes)}m</span>
                                                                                 {(e.tonnage || 0) > 0 && <span className="text-slate-500">•</span>}
                                                                                 {(e.tonnage || 0) > 0 && <span className="text-indigo-400">{(e.tonnage! / 1000).toFixed(1)}t</span>}
                                                                                 {e.heartRateAvg && <span className="text-slate-500">•</span>}
                                                                                 {e.heartRateAvg && <span className="text-amber-400/90 flex items-center gap-0.5">{Math.round(e.heartRateAvg)}<Heart className="w-2 h-2 text-amber-500/50" /></span>}
                                                                                 <span className="text-slate-500">•</span>
                                                                                 <span className="text-rose-400/90">{Math.round(e.caloriesBurned || 0)}c</span>
                                                                             </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs font-black items-end">
                                                                <span className="text-slate-500 uppercase tracking-widest">Totalt</span>
                                                                <div className="text-right">
                                                                    <div className="text-indigo-400 font-mono">
                                                                        {Math.floor(weekStrengthMin / 60) > 0 ? `${Math.floor(weekStrengthMin / 60)}h ` : ''}{Math.round(weekStrengthMin % 60)}m
                                                                    </div>
                                                                    <div className="text-slate-400 font-mono text-[9px] font-normal">{(weekTonnage / 1000).toFixed(1)}t</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {weekOtherCardioMin > 0 && (
                                                    <div
                                                         className="flex items-center justify-between bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded cursor-help relative group/weekother hover:bg-sky-500/20 transition-colors w-full border border-sky-500/10 mb-0.5 calendar-tooltip-container"
                                                         onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `other-${weekIdx}` ? null : `other-${weekIdx}`) }}
                                                     >
                                                         <HeartPulse className="w-3.5 h-3.5" />
                                                         <div className="flex items-baseline gap-1">
                                                             <span>
                                                                 {Math.floor(weekOtherCardioMin / 60) > 0 ? `${Math.floor(weekOtherCardioMin / 60)}h` : ''}
                                                                 {Math.floor(weekOtherCardioMin / 60) > 0 && Math.round(weekOtherCardioMin % 60) === 0 ? '' : `${Math.round(weekOtherCardioMin % 60)}m`}
                                                             </span>
                                                             <span className="text-[10px] ml-0.5 opacity-50 font-normal">{weekOtherCardioCount}p</span>
                                                         </div>

                                                         {/* Rich Tooltip */}
                                                         <div
                                                             className={`absolute right-full mr-2 top-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-sm p-3 shadow-2xl transition-all duration-300 z-[9999] hidden xl:block scale-95 shadow-sky-500/10 ${pinnedTooltip === `other-${weekIdx}` ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto' : 'opacity-0 xl:group-hover/weekother:opacity-100 -translate-x-2 xl:group-hover/weekother:translate-x-0 pointer-events-none xl:group-hover/weekother:scale-100 cursor-default'}`}
                                                             onClick={(e) => e.stopPropagation()}
                                                         >
                                                             <div className="text-xs text-slate-400 font-bold mb-2 pb-2 border-b border-white/10">Alternativ Cardio</div>
                                                             <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                 {otherCardioExercises.map((e, idx) => {
                                                                     const [dYear, dMonth, dDay] = e.date.split('-');
                                                                     const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                     const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                                                                     
                                                                     let typeStr = e.type.replace('cycling', 'Cykling').replace('walking', 'Promenad').replace('swimming', 'Simning').replace('cardio', 'Kondition');
                                                                     let valueStr = Math.round(e.durationMinutes) + 'm';
                                                                     if (e.distance && e.distance > 0) valueStr = e.distance.toFixed(1) + 'km';

                                                                     return (
                                                                         <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1.5 -mx-1.5 rounded-sm cursor-pointer transition-colors"
                                                                             onClick={() => {
                                                                                 setSelectedDate(e.date);
                                                                                 navigate({
                                                                                     pathname: `/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`,
                                                                                     search: window.location.search
                                                                                 }, { replace: true });
                                                                             }}>
                                                                             <span className="capitalize text-sky-100 font-medium truncate" title={e.title || e.type}>{e.title || typeStr}</span>
                                                                             <div className="text-right shrink-0 flex items-center gap-1 font-mono text-[10px] font-bold">
                                                                                 <span className="text-sky-400">{valueStr}</span>
                                                                                 {e.heartRateAvg && <span className="text-slate-500">•</span>}
                                                                                 {e.heartRateAvg && <span className="text-amber-400/90 flex items-center gap-0.5">{Math.round(e.heartRateAvg)}<Heart className="w-2 h-2 text-amber-500/50" /></span>}
                                                                                 <span className="text-slate-500">•</span>
                                                                                 <span className="text-rose-400/90">{Math.round(e.caloriesBurned || 0)}c</span>
                                                                             </div>
                                                                         </div>
                                                                     );
                                                                 })}
                                                             </div>
                                                             <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs font-black items-end">
                                                                 <span className="text-slate-500 uppercase tracking-widest">Totalt</span>
                                                                 <div className="text-right">
                                                                     <div className="text-sky-400 font-mono">
                                                                         {Math.floor(weekOtherCardioMin / 60) > 0 ? `${Math.floor(weekOtherCardioMin / 60)}h ` : ''}{Math.round(weekOtherCardioMin % 60)}m
                                                                     </div>
                                                                     <div className="text-slate-400 font-mono text-[9px] font-normal">{otherCardioExercises.reduce((acc, e) => acc + (e.caloriesBurned || 0), 0)} kcal</div>
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     </div>
                                                )}
                                                {weekTonnage > 0 && (
                                                    <div className="flex items-center justify-between bg-slate-800/50 text-indigo-400 px-1.5 py-1 rounded cursor-help relative group/weektng hover:bg-slate-700/50 transition-colors w-full border border-white/5 mb-0.5">
                                                        <Scale className="w-3.5 h-3.5" />
                                                        <span>{(weekTonnage / 1000).toFixed(1)}<span className="text-[8px] ml-0.5">t</span></span>
                                                        <div className="absolute right-full mr-2 top-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl opacity-0 xl:group-hover/weektng:opacity-100 transition-all duration-300 -translate-x-2 xl:group-hover/weektng:translate-x-0 z-[9999] hidden xl:block pointer-events-none cursor-default scale-95 xl:group-hover/weektng:scale-100 shadow-indigo-500/10">
                                                            <div className="text-xs text-slate-400 font-bold mb-3 pb-2 border-b border-white/10">Veckans Styrkevolym</div>
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Totalt</span>
                                                                    <span className="text-indigo-400 font-mono font-bold">{weekTonnage.toLocaleString('sv-SE')} kg</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">I ton</span>
                                                                    <span className="text-indigo-400 font-mono font-bold">{(weekTonnage / 1000).toFixed(2)} t</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {weekTotalMin === 0 && (
                                                    <div className="text-slate-600 italic text-[10px] text-center w-full py-2">Vila</div>
                                                )}
                                            </div>

                                            {weekTotalMin > 0 && (
                                                <div
                                                    className="flex flex-col border-t border-white/5 pt-1 w-full relative group/weektot cursor-help calendar-tooltip-container"
                                                    onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `tot-${weekIdx}` ? null : `tot-${weekIdx}`) }}
                                                >
                                                    <div className="flex items-center justify-between w-full px-1 bg-white/5 rounded py-0.5 hover:bg-white/10 transition-colors text-[9px] font-bold">
                                                        <span className="text-slate-500 uppercase font-black tracking-widest leading-none">TOT</span>
                                                        <div className="flex items-center gap-1 text-[9px] font-bold leading-none">
                                                            {(() => {
                                                                const sessions = weekExercises.filter(e => !isWarmupOrCooldown(e));
                                                                const warmCount = weekExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                return <span className="text-slate-400">{sessions.length}{warmCount > 0 ? ` (+${warmCount})` : ''}p</span>;
                                                            })()}
                                                            <span className="text-slate-500 opacity-60">•</span>
                                                            <span className="text-slate-300 font-mono">
                                                                {Math.floor(weekTotalMin / 60) > 0 ? `${Math.floor(weekTotalMin / 60)}h` : ''}
                                                                {Math.floor(weekTotalMin / 60) > 0 && Math.round(weekTotalMin % 60) === 0 ? '' : `${Math.round(weekTotalMin % 60)}m`}
                                                            </span>
                                                            {weekCalories > 0 && (
                                                                <>
                                                                    <span className="text-slate-500 opacity-60">•</span>
                                                                    <span className="text-rose-400/90 font-mono">{Math.round(weekCalories)}<span className="text-[7.5px] ml-0.25 opacity-70">c</span></span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Rich Tooltip */}
                                                    <div
                                                        className={`absolute right-full mr-2 bottom-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl transition-all duration-300 z-[9999] hidden xl:block scale-95 shadow-sky-500/10 ${pinnedTooltip === `tot-${weekIdx}` ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto' : 'opacity-0 xl:group-hover/weektot:opacity-100 -translate-x-2 xl:group-hover/weektot:translate-x-0 pointer-events-none xl:group-hover/weektot:scale-100 cursor-default'}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="text-xs text-slate-400 font-bold mb-2 pb-2 border-b border-white/10 flex justify-between">
                                                            <span>Alla pass v. {weekNumberStr.replace('v. ', '')}</span>
                                                            {(() => {
                                                                const sessions = weekExercises.filter(e => !isWarmupOrCooldown(e));
                                                                const warmCount = weekExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                return <span className="text-slate-500">{sessions.length}{warmCount > 0 ? ` (+${warmCount})` : ''} pass</span>;
                                                            })()}
                                                        </div>
                                                        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                            {weekExercises.map((e, idx) => {
                                                                const [dYear, dMonth, dDay] = e.date.split('-');
                                                                const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                                                                const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();

                                                                const isRun = e.type.includes('run') || e.type.includes('löp');
                                                                const isStrength = e.type.includes('strength') || e.type.includes('styrka');
                                                                const isRace = e.subType === 'race';

                                                                let colorName = 'text-slate-200';
                                                                if (isRace) colorName = 'text-amber-400 font-bold';
                                                                else if (isRun) colorName = 'text-emerald-100';
                                                                else if (isStrength) colorName = 'text-indigo-100';
                                                                else if (e.type.includes('cycl')) colorName = 'text-sky-100';
                                                                else if (e.type.includes('walk')) colorName = 'text-amber-100';

                                                                let valueStr = Math.round(e.durationMinutes) + 'm';
                                                                if (e.distance && e.distance > 0) valueStr = e.distance.toFixed(1) + 'km';

                                                                let valColor = 'text-slate-300';
                                                                if (isRun) valColor = 'text-emerald-400';
                                                                else if (isStrength) valColor = 'text-indigo-400';
                                                                else if (e.type.includes('cycl')) valColor = 'text-sky-400';

                                                                return (
                                                                    <div key={idx} className="flex justify-between items-start gap-2 hover:bg-white/5 p-1.5 -mx-1.5 rounded-lg cursor-pointer transition-colors"
                                                                        onClick={() => {
                                                                            navigate({
                                                                                pathname: `/träning/${dYear}/${dMonthName}`,
                                                                                search: `?activityId=${e.id}${window.location.search ? '&' + window.location.search.replace('?', '') : ''}`
                                                                            }, { replace: true });
                                                                        }}>
                                                                        <span className={`capitalize truncate text-[11px] ${colorName}`} title={e.title || e.type}>
                                                                            {isRace ? '🏆 ' : ''}{e.title || e.type.replace('strength', 'Styrka').replace('running', 'Löpning')}
                                                                        </span>
                                                                        <div className="text-right shrink-0 flex items-center gap-1.5 mt-0.5">
                                                                             <span className={`font-mono font-bold text-xs ${valColor}`}>
                                                                                 {valueStr}
                                                                             </span>
                                                                             <span className="text-slate-500 font-mono text-[9px]">• {Math.round(e.caloriesBurned || 0)} kcal</span>
                                                                         </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs font-black items-end">
                                                            <span className="text-slate-500 uppercase tracking-widest">Totalt</span>
                                                            <div className="text-right">
                                                                <div className="text-sky-400 font-mono">
                                                                    {Math.floor(weekTotalMin / 60) > 0 ? `${Math.floor(weekTotalMin / 60)}h ` : ''}{Math.round(weekTotalMin % 60)}m
                                                                </div>
                                                                <div className="text-slate-500 font-mono text-[9px] font-normal">{Math.round(weekCalories)} kcal</div>
                                                            </div>
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

            {/* Bottom Panel: Stats Summaries */}
            <div className="bg-slate-950/50 border-t border-white/5 p-4 sm:p-6 rounded-b-2xl relative z-10 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Kolumn 1: Pass & Frekvens */}
                    <div className="bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-white/5 shadow-inner flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-tight">Pass & Frekvens</p>
                            <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">{stats.freqPercent}% aktiva dagar</span>
                        </div>
                        <div className="flex items-end justify-between mb-4">
                            <div className="flex items-baseline gap-1">
                                <p className="text-4xl font-black text-white leading-none">{stats.count}</p>
                                <span className="text-lg font-bold text-slate-500 mr-2">pass</span>
                                {stats.warmupCount > 0 && (
                                    <div className="group/wu relative">
                                        <span className="text-sm font-black text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded cursor-help">+{stats.warmupCount}</span>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/wu:opacity-100 transition-opacity pointer-events-none z-50">
                                            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Identifierat som upp/nerjogg</p>
                                            <div className="space-y-1">
                                                {stats.warmups.map((w : any, i : number) => (
                                                    <div key={i} className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-300 truncate max-w-[100px]">{w.title || w.type}</span>
                                                        <span className="text-slate-500 font-mono">{w.distance?.toFixed(1)}km</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="mt-2 pt-1 border-t border-white/5 text-[9px] text-slate-600 italic">Undantagits från antal pass men räknas i totala stats.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-white/5">
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt / Vecka</p>
                                <p className="text-base font-black text-slate-300">{stats.perWeek} <span className="text-[10px] font-bold text-slate-500">pass</span></p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Per aktiv dag</p>
                                <p className="text-base font-black text-slate-300">{stats.sessionsPerActiveDay} <span className="text-[10px] font-bold text-slate-500">pass</span></p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Inaktiva dagar</p>
                                <p className="text-base font-black text-slate-300">{stats.inactiveDays || 0} <span className="text-[10px] font-bold text-slate-500">dagar</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Kolumn 2: Tid & Duration */}
                    <div className="bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-white/5 shadow-inner flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-tight">Tid & Duration</p>
                        </div>
                        <div className="flex items-end justify-between mb-4">
                            <p className="text-4xl font-black text-white leading-none">
                                {Math.floor(stats.duration / 60)}<span className="text-xl font-bold text-slate-500 mx-1">h</span>
                                {Math.round(stats.duration % 60)}<span className="text-xl font-bold text-slate-500 ml-1">m</span>
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-auto pt-4 border-t border-white/5">
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt / dag</p>
                                <p className="text-base font-black text-sky-400">{stats.timePerDay} <span className="text-[10px] font-bold text-sky-500/70">min</span></p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt/pass</p>
                                <p className="text-base font-black text-sky-400">{stats.count > 0 ? Math.round(stats.duration / stats.count) : 0} <span className="text-[10px] font-bold text-sky-500/70">min</span></p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snittpuls</p>
                                <p className="text-base font-black text-sky-400">{stats.avgHr > 0 ? `${stats.avgHr} ` : '-'}{stats.avgHr > 0 && <span className="text-[10px] font-bold text-sky-500/70">bpm</span>}</p>
                            </div>
                        </div>
                    </div>

                    {/* Kolumn 3: Distans & Styrkevolym */}
                    <div className="grid grid-rows-2 gap-4 lg:col-span-1">
                        <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/10 shadow-inner flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] text-emerald-500/80 uppercase font-black tracking-widest">Löpdistans</p>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <p className="text-3xl font-black text-emerald-400 leading-none">{stats.distance.toFixed(1)} <span className="text-sm font-bold text-emerald-500/60">km</span></p>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-emerald-500/60 uppercase">Snitt / v</p>
                                    <p className="text-sm font-black text-emerald-400">{stats.distancePerWeek.toFixed(1)} km</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/10 shadow-inner flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-1">
                                <p className="text-[10px] text-indigo-500/80 uppercase font-black tracking-widest">Styrkevolym</p>
                            </div>
                            <div className="flex items-baseline justify-between">
                                <p className="text-3xl font-black text-indigo-400 leading-none">{(stats.tonnage / 1000).toFixed(1)} <span className="text-sm font-bold text-indigo-500/60">ton</span></p>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-indigo-500/60 uppercase">Tonnage</p>
                                    <p className="text-sm font-black text-indigo-400">{stats.tonnage.toLocaleString('sv-SE')} kg</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Kolumn 4: Tidsfördelning */}
                    <div className="bg-slate-800/40 p-4 sm:p-5 rounded-2xl border border-white/5 shadow-inner flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                                {distMode === 'time' ? 'Tidsfördelning' : 'Passfördelning'}
                            </p>
                            <button onClick={() => setDistMode(distMode === 'time' ? 'count' : 'time')} className="text-[9px] font-bold text-slate-400 hover:text-sky-300 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md transition-colors">
                                {distMode === 'time' ? 'Visa Pass' : 'Visa Tid'}
                            </button>
                        </div>
                        <div className="space-y-1.5 w-full my-auto">
                            {Object.entries(distMode === 'time' ? stats.timeDist : stats.countDist).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([type, value]) => {
                                const percent = Math.round(((value as number) / (distMode === 'time' ? stats.duration : stats.count)) * 100);
                                const icon = type.includes('running') || type.includes('run') ? '🏃' :
                                    type === 'strength' ? '🏋️' :
                                        type === 'cycling' ? '🚴' :
                                            type === 'walking' ? '🚶' : '⚡';
                                const label = type.includes('running') || type.includes('run') ? 'Löpning' :
                                    type === 'strength' ? 'Styrka' :
                                        type === 'cycling' ? 'Cykling' :
                                            type === 'walking' ? 'Promenad' : type;

                                return (
                                    <div key={type} className="flex items-center gap-2 group/dist">
                                        <span className="w-5 shrink-0 text-xs grayscale-[0.5] group-hover/dist:grayscale-0 transition-all text-center">
                                            {icon}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-0.5 items-center">
                                                <span className="text-slate-400 capitalize text-[9px] font-black truncate leading-none uppercase tracking-tighter">
                                                    {label}
                                                </span>
                                                <span className="font-mono font-bold text-white text-[9px] leading-none shrink-0 ml-1">
                                                    {percent}% <span className="text-slate-500 font-normal">
                                                        {distMode === 'time' ? (
                                                            `(${value >= 60 ? `${Math.floor(value as number / 60)}h ${Math.round(value as number % 60)}m` : `${Math.round(value as number)}m`})`
                                                        ) : (
                                                            `(${value} pass)`
                                                        )}
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-slate-900/50 rounded-full overflow-hidden shadow-inner border border-white/5 relative">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${type.includes('running') ? 'bg-emerald-500' :
                                                        type === 'strength' ? 'bg-indigo-500' :
                                                            type === 'cycling' ? 'bg-sky-500' : 'bg-slate-400'
                                                        }`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(stats.timeDist).length === 0 && (
                                <div className="text-center text-slate-500 italic text-xs py-4">Ingen data</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Detail Modal */}
            {selectedDate && (
                <DailyDetailModal
                    date={selectedDate}
                    allExercises={exercises}
                    onClose={() => {
                        setSelectedDate(null);
                        const [dYear, dMonth] = selectedDate.split('-');
                        const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                        const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                        navigate({
                            pathname: `/träning/${dYear}/${dMonthName}`,
                            search: window.location.search
                        }, { replace: true });
                    }}
                    onDateChange={(newDate) => {
                        setSelectedDate(newDate);
                        const [dYear, dMonth, dDay] = newDate.split('-');
                        const dObj = new Date(parseInt(dYear), parseInt(dMonth) - 1, 1);
                        const dMonthName = dObj.toLocaleString('sv-SE', { month: 'long' }).toLowerCase();
                        navigate({
                            pathname: `/träning/${dYear}/${dMonthName}/${parseInt(dDay)}`,
                            search: window.location.search
                        }, { replace: true });
                    }}
                    onExerciseClick={onExerciseClick}
                />
            )}
        </div>
    );
}
