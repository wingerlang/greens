import React, { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { ExerciseEntry } from '../../models/types.ts';
import { Activity, ArrowDownUp, Dumbbell, ChevronLeft, ChevronRight, ChevronDown as LucideChevronDown, ChevronUp as LucideChevronUp, Flame, Scale, HeartPulse, Heart, Footprints, Bike, Route, Trophy, Zap, Sigma, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DailyDetailModal } from './DailyDetailModal.tsx';
import { useData } from '../../context/DataContext.tsx';
import { isWarmupOrCooldown, isCompetition, isQualitySession, isRun, isTempoInterval, isStrength, isRecovery } from '../../utils/activityUtils.ts';

interface TrainingCalendarProps {
    monthIndex: number; // 0-11
    year: number;
    exercises: ExerciseEntry[];
    plannedActivities?: any[];
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

const formatHhMm = (mins: number) => {
    const rounded = Math.round(mins);
    const h = Math.floor(rounded / 60);
    const m = rounded % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const MONTHS = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

export function TrainingCalendar({ monthIndex, year, exercises: allExercises, plannedActivities, initialDay, onExerciseClick }: TrainingCalendarProps) {
    const navigate = useNavigate();
    const { reorderActivity, getVitalsForDate } = useData();

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

    // Filter State
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    const { userSettings } = useData();
    const longRunThreshold = userSettings?.longRunThreshold || 20;

    const FILTER_OPTIONS = useMemo(() => [
        { id: 'distance', label: 'Löpning', filter: (e: any) => isRun(e) },
        { id: 'quality', label: 'Kvalitet', filter: (e: any) => isQualitySession(e) },
        { id: 'longrun', label: 'Långpass', filter: (e: any) => {
            if (isRun(e)) {
                if (e.distance) return e.distance >= longRunThreshold;
                return e.durationMinutes >= 120;
            }
            return e.durationMinutes >= 150;
        } },
        { id: 'race', label: 'Tävling', filter: (e: any) => e.subType === 'race' || isCompetition(e) },
        { id: 'cycling', label: 'Cykling', filter: (e: any) => (e.type || '').toLowerCase().includes('cycl') || (e.type || '').toLowerCase().includes('cykel') },
        { id: 'strength', label: 'Styrka', filter: (e: any) => (e.type || '').toLowerCase().includes('strength') || (e.type || '').toLowerCase().includes('styrka') },
        { id: 'recovery', label: 'Återhämtning', filter: (e: any) => isRecovery(e) }
    ], [longRunThreshold]);

    const monthName = MONTHS[monthIndex];

    const exercises = useMemo(() => {
        let base = allExercises.filter(e => {
            const perf = (e as any)._mergeData?.universalActivity?.performance;
            return !(e.isHiddenInCalendar || perf?.isHiddenInCalendar) && !e.extractedFromId;
        });

        // Add planned races that aren't already matched/completed
        const plannedRaces = (plannedActivities || [])
            .filter(p => p.category === 'RACE' && (p.status === 'PLANNED' || p.status === 'DRAFT'))
            .filter(p => !allExercises.some(e => e.id === p.id || (e as any)._mergeData?.universalActivity?.plan?.id === p.id))
            .map(p => ({
                id: p.id,
                date: p.date,
                type: (p.type || 'RUN').toLowerCase() as any,
                title: p.title,
                durationMinutes: p.durationMinutes || 0,
                distance: p.estimatedDistance,
                subType: 'race',
                isPlanned: true,
                source: 'planned'
            } as any));

        base = [...base, ...plannedRaces];

        if (activeFilter) {
            const opt = FILTER_OPTIONS.find(o => o.id === activeFilter);
            if (opt) base = base.filter(opt.filter);
        }

        return base;
    }, [allExercises, activeFilter, FILTER_OPTIONS, plannedActivities]);

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

        const getExercisePriority = (e: any) => {
            const title = (e.title || '').toLowerCase();
            const subType = (e.subType || '').toLowerCase();
            const category = (e.category || '').toLowerCase();
            
            const isWarmup = subType === 'warmup' || category === 'warmup' || title.includes('uppjogg') || title.includes('uppvärmning') || title.includes('warmup');
            if (isWarmup) return 1;

            const isCooldown = subType === 'cooldown' || category === 'cooldown' || title.includes('nerjogg') || title.includes('nedjogg') || title.includes('nedvärmning') || title.includes('cooldown') || title.includes('nedvarvning');
            if (isCooldown) return 4;

            if (isCompetition(e) || e.subType === 'race' || e.category === 'RACE') return 2;
            return 3;
        };

        const sortExercises = (exs: any[]) => {
            return [...exs].sort((a, b) => {
                // 1. Sort by type priority (Warmup -> Race -> Main -> Cooldown)
                const pA = getExercisePriority(a);
                const pB = getExercisePriority(b);
                if (pA !== pB) return pA - pB;

                // 2. Sort by explicit startTime
                const timeA = a.startTime || (a.date && a.date.includes('T') ? a.date.split('T')[1].substring(0, 5) : '');
                const timeB = b.startTime || (b.date && b.date.includes('T') ? b.date.split('T')[1].substring(0, 5) : '');
                
                if (timeA && !timeB) return -1;
                if (!timeA && timeB) return 1;
                if (timeA && timeB) {
                    const cmp = timeA.localeCompare(timeB);
                    if (cmp !== 0) return cmp;
                }

                // 3. Sort by order
                const orderA = a.order ?? 999;
                const orderB = b.order ?? 999;
                return orderA - orderB;
            });
        };

        for (let i = startDayOffset; i > 0; i--) {
            const date = new Date(year, monthIndex, 1 - i, 12);
            const dateStr = formatLocalDate(date);
            days.push({ day: date.getDate(), exercises: sortExercises(exercises.filter(e => e.date === dateStr)), dateStr, isCurrentMonth: false });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, monthIndex, i, 12);
            const dateStr = formatLocalDate(date);
            const dayExercises = sortExercises(monthData.filter(e => e.date === dateStr));
            days.push({ day: i, exercises: dayExercises, dateStr, isCurrentMonth: true });
        }

        let nextDayCounter = 1;
        while (days.length % 7 !== 0) {
            const date = new Date(year, monthIndex + 1, nextDayCounter, 12);
            const dateStr = formatLocalDate(date);
            days.push({ day: date.getDate(), exercises: sortExercises(exercises.filter(e => e.date === dateStr)), dateStr, isCurrentMonth: false });
            nextDayCounter++;
        }

        const weeks = [];
        for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

        return { days, weeks, daysInMonth };
    }, [year, monthIndex, monthData, exercises]);

    const stats = useMemo(() => {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Only count completed activities up to today
        const completedMonthData = monthData.filter(e => !e.isPlanned && e.date <= todayStr);

        const countableExercises = completedMonthData.filter(e => 
            !e.type.toLowerCase().includes('walk') && 
            !e.type.toLowerCase().includes('promenad')
        );

        const distance = countableExercises.reduce((sum, e) => {
            const isRunActivity = isRun(e);
            return sum + (isRunActivity ? (e.distance || 0) : 0);
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
        const uniqueActiveDays = completedMonthData.filter((v, i, a) => a.findIndex(t => t.date === v.date) === i).length;
        const freqPercent = Math.round((uniqueActiveDays / daysPassedForStats) * 100);
        const timePerDay = Math.round(duration / daysPassedForStats);
        const distancePerWeek = daysPassedForStats > 0 ? (distance / daysPassedForStats) * 7 : 0;
        const sessionsPerActiveDay = uniqueActiveDays > 0 ? (count / uniqueActiveDays).toFixed(1) : '0';

        const plannedCount = (plannedActivities || [])
            .filter(a => {
                const d = new Date(a.date);
                return (a.status === 'PLANNED' || a.status === 'DRAFT') && 
                       d.getMonth() === monthIndex && 
                       d.getFullYear() === year &&
                       a.category !== 'RACE';
            }).length;

        const plannedRaceCount = (plannedActivities || [])
            .filter(a => {
                const d = new Date(a.date);
                return (a.status === 'PLANNED' || a.status === 'DRAFT') && 
                       d.getMonth() === monthIndex && 
                       d.getFullYear() === year &&
                       a.category === 'RACE';
            }).length;

        const plannedActivitiesInRange = (plannedActivities || [])
            .filter(a => {
                const d = new Date(a.date);
                return (a.status === 'PLANNED' || a.status === 'DRAFT') && 
                       d.getMonth() === monthIndex && 
                       d.getFullYear() === year;
            });

        const plannedRaceDuration = plannedActivitiesInRange
            .filter(a => a.category === 'RACE')
            .reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
            
        const plannedTrainingDuration = plannedActivitiesInRange
            .filter(a => a.category !== 'RACE')
            .reduce((sum, a) => sum + (a.durationMinutes || 0), 0);

        const futureCompletedDuration = monthData
            .filter(e => !e.isPlanned && e.date > todayStr)
            .reduce((sum, e) => sum + e.durationMinutes, 0);

        const totalExtraDuration = plannedRaceDuration + plannedTrainingDuration + futureCompletedDuration;
        const totalProjectedDuration = duration + totalExtraDuration;

        const timeDist = countableExercises.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + e.durationMinutes;
            return acc;
        }, {} as Record<string, number>);

        const countDist = sessions.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const warmupCountDist = warmups.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const hrActivities = completedMonthData.filter(e => e.heartRateAvg && e.heartRateAvg > 0);
        const avgHr = hrActivities.length > 0 
            ? Math.round(hrActivities.reduce((sum, e) => sum + e.heartRateAvg!, 0) / hrActivities.length) 
            : 0;
        const inactiveDays = Math.max(0, daysPassedForStats - uniqueActiveDays);

        const timePerWeek = weeksForFreq > 0 ? (duration / weeksForFreq) : 0;
        const tonnagePerWeek = weeksForFreq > 0 ? (tonnage / weeksForFreq) : 0;

        let sickDays = 0;
        let sickFeelingDays = 0;
        let longestStreak = 0;
        let longestStreakPasses = 0;
        let currentStreak = 0;
        let currentStreakPasses = 0;

        for (let day = 1; day <= calendarDays.daysInMonth; day++) {
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const vitals = getVitalsForDate(dateStr);
            if (vitals?.illnessStatus) {
                if (vitals.illnessStatus === 'severe' || vitals.illnessStatus === 'moderate') {
                    sickDays++;
                } else if (vitals.illnessStatus === 'mild') {
                    sickFeelingDays++;
                }
            }
            
            const isFutureDay = isCurrentMonth && day > today.getDate();
            if (!isFutureDay) {
                const dayEx = completedMonthData.filter(e => e.date === dateStr && !isWarmupOrCooldown(e));
                if (dayEx.length > 0) {
                    currentStreak++;
                    currentStreakPasses += dayEx.length;
                    if (currentStreak > longestStreak) {
                        longestStreak = currentStreak;
                        longestStreakPasses = currentStreakPasses;
                    } else if (currentStreak === longestStreak && currentStreakPasses > longestStreakPasses) {
                        longestStreakPasses = currentStreakPasses;
                    }
                } else {
                    currentStreak = 0;
                    currentStreakPasses = 0;
                }
            }
        }

        const dailyCounts = {} as Record<string, number>;
        const dailyVolumes = {} as Record<string, { duration: number, dist: number, hrSum: number, count: number }>;
        let longestSession = { duration: 0, title: '', type: '', distance: 0, hr: 0, date: '' };
        let qualityCount = 0;
        let longRunCount = 0;
        let raceCount = 0;

        sessions.forEach(e => {
            dailyCounts[e.date] = (dailyCounts[e.date] || 0) + 1;
            
            if (!dailyVolumes[e.date]) dailyVolumes[e.date] = { duration: 0, dist: 0, hrSum: 0, count: 0 };
            dailyVolumes[e.date].duration += e.durationMinutes;
            dailyVolumes[e.date].dist += (e.distance || 0);
            if (e.heartRateAvg) {
                dailyVolumes[e.date].hrSum += e.heartRateAvg;
                dailyVolumes[e.date].count++;
            }

            if (e.subType === 'race' || isCompetition(e)) {
                raceCount++;
            }

            if (e.durationMinutes > longestSession.duration) {
                longestSession = { 
                    duration: e.durationMinutes, 
                    title: e.title || '', 
                    type: e.type || '', 
                    distance: e.distance || 0, 
                    hr: e.heartRateAvg || 0,
                    date: e.date
                };
            }

            const isRunActivity = isRun(e);
            if (isQualitySession(e)) {
                qualityCount++;
            }
            if (isRunActivity) {
                const dist = Number(e.distance) || 0;
                if (dist >= longRunThreshold) {
                    longRunCount++;
                } else if (dist === 0 && e.durationMinutes >= 120) {
                    longRunCount++;
                }
            } else if (e.durationMinutes >= 150) {
                longRunCount++;
            }
        });

        let maxDailyVol = 0;
        let maxDailyDate = '';
        Object.entries(dailyVolumes).forEach(([d, vol]) => {
            if (vol.duration > maxDailyVol) {
                maxDailyVol = vol.duration;
                maxDailyDate = d;
            }
        });

        const doubleDays = Object.values(dailyCounts).filter(c => c === 2).length;
        const tripleDays = Object.values(dailyCounts).filter(c => c >= 3).length;
        
        const bDay = maxDailyDate ? dailyVolumes[maxDailyDate] : null;
        const biggestDay = { 
            duration: maxDailyVol, 
            date: maxDailyDate, 
            distance: bDay?.dist || 0, 
            hr: bDay && bDay.count > 0 ? bDay.hrSum / bDay.count : 0 
        };

        const runningExercises = sessions.filter(e => e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp'));
        const totalRunDist = runningExercises.reduce((sum, e) => sum + (e.distance || 0), 0);
        const totalRunTime = runningExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
        const avgRunPace = totalRunDist > 0 ? totalRunTime / totalRunDist : 0;

        const distExercises = sessions.filter(e => e.distance && e.distance > 0);
        const avgDist = distExercises.length > 0 ? distExercises.reduce((sum, e) => sum + (e.distance || 0), 0) / distExercises.length : 0;

        return { 
            distance, duration, count, warmupCount, warmups, 
            tonnage, timeDist, countDist, warmupCountDist, perWeek, freqPercent, 
            timePerDay, distancePerWeek, sessionsPerActiveDay, avgHr, inactiveDays,
            timePerWeek, tonnagePerWeek, sickDays, sickFeelingDays, longestStreak, 
            longestStreakPasses, doubleDays, tripleDays, longestSession, biggestDay,
            qualityCount, longRunCount, raceCount, avgRunPace, avgDist,
            plannedCount, plannedRaceCount, totalExtraDuration, 
            plannedRaceDuration, plannedTrainingDuration, totalProjectedDuration
        };
    }, [monthData, monthIndex, year, calendarDays.daysInMonth, getVitalsForDate, plannedActivities]);

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

                    {/* Filter Bar */}
                    <div className="flex items-center gap-1.5 mt-3 overflow-x-auto custom-scrollbar pb-1">
                        {FILTER_OPTIONS.map(opt => {
                            const isActive = activeFilter === opt.id || activeFilter === null;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => setActiveFilter(activeFilter === opt.id ? null : opt.id)}
                                    className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-sm transition-all whitespace-nowrap border shrink-0 ${
                                        isActive
                                            ? 'bg-slate-700/50 text-white border-slate-500/50 shadow-sm'
                                            : 'bg-slate-900/50 text-slate-500 border-white/5 hover:bg-slate-800 hover:text-slate-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
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
                            
                            // Running variables (Completed vs Planned)
                            const runExercises = weekExercises.filter(e => e.type.toLowerCase().includes('run') || e.type.toLowerCase().includes('löp'));
                            const completedRunExercises = runExercises.filter(e => !e.isPlanned && e.date <= todayStr);
                            const completedRunDist = completedRunExercises.reduce((sum, e) => sum + (e.distance || 0), 0);
                            const completedRunTime = completedRunExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const totalRunDist = runExercises.reduce((sum, e) => sum + (e.distance || 0), 0);
                            const totalRunTime = runExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const hasPlannedRuns = runExercises.some(e => e.isPlanned);

                            // Strength variables (Completed vs Planned)
                            const strengthExercises = weekExercises.filter(e => e.type.toLowerCase().includes('strength') || e.type.toLowerCase().includes('styrka'));
                            const completedStrengthExercises = strengthExercises.filter(e => !e.isPlanned && e.date <= todayStr);
                            const completedStrengthMin = completedStrengthExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const completedTonnage = completedStrengthExercises.reduce((sum, e) => sum + (e.tonnage || 0), 0);
                            const totalStrengthMin = strengthExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const totalTonnage = strengthExercises.reduce((sum, e) => sum + (e.tonnage || 0), 0);
                            const hasPlannedStrength = strengthExercises.some(e => e.isPlanned);

                            // Other cardio variables (Completed vs Planned)
                            const otherCardioExercises = weekExercises.filter(e => {
                                const type = e.type.toLowerCase();
                                return !type.includes('run') && !type.includes('löp') && !type.includes('strength') && !type.includes('styrka');
                            });
                            const completedOtherCardioExercises = otherCardioExercises.filter(e => !e.isPlanned && e.date <= todayStr);
                            const completedOtherCardioMin = completedOtherCardioExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const completedOtherCardioCount = completedOtherCardioExercises.length;
                            const totalOtherCardioMin = otherCardioExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const totalOtherCardioCount = otherCardioExercises.length;
                            const hasPlannedOther = otherCardioExercises.some(e => e.isPlanned);

                            // Weekly totals (Completed vs Planned)
                            const completedTotalExercises = weekExercises.filter(e => !e.isPlanned && e.date <= todayStr);
                            const completedTotalMin = completedTotalExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const completedCalories = completedTotalExercises.reduce((sum, e) => sum + (e.caloriesBurned || 0), 0);
                            
                            const weekTotalMin = weekExercises.reduce((sum, e) => sum + e.durationMinutes, 0);
                            const weekCalories = weekExercises.reduce((sum, e) => sum + (e.caloriesBurned || 0), 0);
                            const hasPlannedInWeek = weekExercises.some(e => e.isPlanned);

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
                                        const isRace = date.exercises.some(e => isCompetition(e));
                                        const vitals = getVitalsForDate(date.dateStr);
                                        const isSick = vitals.illnessStatus && vitals.illnessStatus !== 'none';
                                        
                                        let sickBg = '';
                                        if (vitals.illnessStatus === 'severe') sickBg = 'bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-red-500/20';
                                        else if (vitals.illnessStatus === 'moderate') sickBg = 'bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/20 shadow-sm';
                                        else if (vitals.illnessStatus === 'mild') sickBg = 'bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10 shadow-sm';

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
                                            relative p-0.5 flex flex-col rounded-md sm:rounded-sm border group cursor-pointer transition-all duration-200 min-h-[70px] hover:z-[100]
                                            ${!date.isCurrentMonth ? 'opacity-60 grayscale-[0.3] hover:opacity-90 hover:grayscale-0' : ''}
                                            ${isSick ? sickBg : 
                                                isToday ? 'bg-sky-950/40 border-sky-500/50 shadow-[0_0_15px_rgba(56,189,248,0.1)] hover:bg-sky-900/50 hover:border-sky-400' :
                                                        isRace ? 'bg-amber-500/5 border-amber-500/30 shadow-amber-500/5 hover:bg-amber-500/10 hover:border-amber-400/50' :
                                                            hasExercise ? 'bg-slate-800 border-white/10 hover:border-white/30 hover:bg-slate-700/80 shadow-sm' :
                                                                'bg-slate-900/50 border-white/[0.03] hover:bg-white/[0.05] hover:border-white/10'}
                                        `}>
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className={`text-[10px] sm:text-sm font-bold leading-none 
                                                    ${!date.isCurrentMonth ? 'text-slate-500' :
                                                            isToday ? 'text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-sm' :
                                                                isRace ? 'text-amber-400' :
                                                                    hasExercise ? 'text-white' : 'text-slate-600'}`}>
                                                        {date.day}
                                                    </span>
                                                    <div className="flex items-center gap-1 group/dayinfo relative hover:z-[110]">
                                                        {hasExercise && (() => {
                                                            const actualExercises = date.exercises.filter(e => !e.isPlanned);
                                                            const plannedRaces = date.exercises.filter(e => e.isPlanned && isCompetition(e));

                                                            const sessions = actualExercises.filter(e => !isWarmupOrCooldown(e));
                                                            const warmCount = actualExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                            const plannedRaceCount = plannedRaces.length;

                                                            const actualMins = Math.round(actualExercises.reduce((sum, e) => sum + e.durationMinutes, 0));
                                                            const plannedMins = Math.round(plannedRaces.reduce((sum, e) => sum + e.durationMinutes, 0));
                                                            const totalMins = actualMins + plannedMins;

                                                            const bonusParts = [];
                                                            if (warmCount > 0) bonusParts.push(`+${warmCount}`);
                                                            if (plannedRaceCount > 0) bonusParts.push(`+${plannedRaceCount}`);
                                                            const bonusStr = bonusParts.length > 0 ? ` (${bonusParts.join(', ')})` : '';
                                                            const counterStr = `${sessions.length > 0 || bonusStr === '' ? sessions.length : ''}${bonusStr}`;

                                                            const formatTime = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${Math.round(mins % 60)}m` : `${mins}m`;
                                                            const timeStr = actualMins > 0 
                                                                ? formatTime(actualMins)
                                                                : (plannedMins > 0 ? `(${formatTime(plannedMins)})` : '0m');

                                                            return (
                                                                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold bg-white/5 px-1 py-0.5 rounded-sm cursor-help transition-colors hover:text-slate-200 hover:bg-white/10 whitespace-nowrap">
                                                                    {counterStr} pass • {timeStr}
                                                                </span>
                                                            );
                                                        })()}
                                                        {isRace && <span className="text-[10px] sm:text-xs animate-pulse leading-none">🏆</span>}
                                                        {isSick && (
                                                            <span className={`text-[10px] sm:text-xs leading-none ${vitals.illnessStatus === 'severe' ? 'text-red-500 animate-pulse' : vitals.illnessStatus === 'moderate' ? 'text-rose-400' : 'text-amber-400'}`} title={vitals.notes || 'Sjukdom'}>
                                                                {vitals.illnessStatus === 'severe' ? '🤒' : vitals.illnessStatus === 'moderate' ? '🤒' : '🤧'}
                                                            </span>
                                                        )}

                                                        {/* Day Total Tooltip */}
                                                        {hasExercise && (
                                                            <div className={`absolute mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 group-hover/dayinfo:opacity-100 transition-all duration-300 translate-y-2 group-hover/dayinfo:translate-y-0 z-[10000] hidden md:block pointer-events-none scale-95 group-hover/dayinfo:scale-100`} style={{ left: '50%', transform: 'translateX(-50%)', top: '100%' }}>
                                                                <div className="text-xs text-slate-400 font-bold mb-2 pb-1 border-b border-white/10 flex justify-between">
                                                                    <span>{date.day} {monthName}</span>
                                                                    {(() => {
                                                                        const actualExercises = date.exercises.filter(e => !e.isPlanned);
                                                                        const plannedRaces = date.exercises.filter(e => e.isPlanned && isCompetition(e));

                                                                        const sessions = actualExercises.filter(e => !isWarmupOrCooldown(e));
                                                                        const warmCount = actualExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                        const plannedRaceCount = plannedRaces.length;

                                                                        return <span>{sessions.length}{warmCount > 0 || plannedRaceCount > 0 ? ` (+${warmCount}${plannedRaceCount > 0 ? `, +${plannedRaceCount}` : ''})` : ''} pass</span>;
                                                                    })()}
                                                                </div>

                                                                <div className="flex flex-col gap-2 mb-2 pb-2 border-b border-white/5 text-xs">
                                                                    {date.exercises.map((e, idx) => (
                                                                        <div key={idx} className="flex justify-between items-start gap-2">
                                                                            <span className={`capitalize truncate ${isCompetition(e) ? 'text-amber-400 font-bold' : 'text-slate-200'}`} title={e.title || e.type}>
                                                                                {isCompetition(e) ? '🏆 ' : ''}{e.title || e.type.replace('strength', 'Styrka').replace('running', 'Löpning').replace('cardio', 'Cardio').replace('CARDIO', 'Cardio')}
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
                                                                        const c = date.exercises.reduce((acc, e) => acc + (e.caloriesBurned || 0), 0);
                                                                        const v = date.exercises.reduce((acc, e) => acc + (e.tonnage || 0), 0);
                                                                        return (
                                                                            <>
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-slate-500">Total Tid</span>
                                                                                    <span className="text-white font-mono">
                                                                                        {(() => {
                                                                                            const actualExercises = date.exercises.filter(e => !e.isPlanned);
                                                                                            const plannedRaces = date.exercises.filter(e => e.isPlanned && isCompetition(e));
                                                                                            
                                                                                            const actualMins = actualExercises.reduce((acc, e) => acc + e.durationMinutes, 0);
                                                                                            const plannedMins = plannedRaces.reduce((acc, e) => acc + e.durationMinutes, 0);
                                                                                            const totalMins = actualMins + plannedMins;

                                                                                            const formatTime = (mins: number) => {
                                                                                                const h = Math.floor(mins / 60);
                                                                                                const m = Math.round(mins % 60);
                                                                                                return h > 0 ? `${h}h ${m}m` : `${m}m`;
                                                                                            };

                                                                                            return plannedMins > 0 && actualMins === 0
                                                                                                ? `(${formatTime(plannedMins)})`
                                                                                                : formatTime(actualMins);
                                                                                        })()}
                                                                                    </span>
                                                                                </div>
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
                                                        const isRunActivity = isRun(ex);
                                                        const isStrengthActivity = isStrength(ex);

                                                        let icon: React.ReactNode = <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />;
                                                        let typeName = 'Pass';
                                                        let colorClass = 'border-slate-500 text-slate-300 bg-slate-500/10 hover:bg-slate-500/20';

                                                        if (isCompetition(ex)) {
                                                            icon = <Trophy className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${ex.isPlanned ? 'text-amber-500/50' : 'text-amber-500'}`} />;
                                                            typeName = 'Tävling';
                                                            colorClass = ex.isPlanned 
                                                                ? 'border-amber-500/30 border-dashed text-amber-200/50 bg-amber-500/5 hover:bg-amber-500/10'
                                                                : 'border-amber-400/40 text-amber-100 bg-amber-500/20 hover:bg-amber-500/30';
                                                        } else if (isRunActivity) {
                                                            icon = <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3] text-emerald-500" />;
                                                            typeName = ex.subType === 'race' ? 'Tävling' : 'Löpning';
                                                            colorClass = 'border-emerald-500 text-emerald-100 bg-emerald-500/10 hover:bg-emerald-500/20';
                                                        } else if (isStrengthActivity) {
                                                            icon = <Dumbbell className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />;
                                                            typeName = 'Styrka';
                                                            colorClass = 'border-indigo-500 text-indigo-100 bg-indigo-500/10 hover:bg-indigo-500/20';
                                                        } else if (['cycl', 'cykel', 'cykl', 'ride', 'bike'].some(k => ex.type.toLowerCase().includes(k))) {
                                                            icon = <Bike className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500" />;
                                                            typeName = 'Cykling';
                                                            colorClass = 'border-sky-500 text-sky-100 bg-sky-500/10 hover:bg-sky-500/20';
                                                        } else if (ex.type.includes('walk')) {
                                                            icon = <Footprints className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />;
                                                            typeName = 'Promenad';
                                                            colorClass = 'border-amber-500 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20';
                                                        } else if (ex.type.toLowerCase().includes('cardio') || ['cross', 'elliptical', 'stair', 'row', 'skierg'].some(k => ex.type.toLowerCase().includes(k))) {
                                                            const lowType = ex.type.toLowerCase();
                                                            const sub = ex.subType?.toLowerCase() || '';
                                                            
                                                            if (sub === 'cross-trainer' || lowType.includes('cross') || lowType.includes('elliptical')) {
                                                                icon = <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />;
                                                                typeName = 'Cardio';
                                                            } else if (sub === 'rowing' || lowType.includes('row')) {
                                                                icon = <Waves className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />;
                                                                typeName = 'Cardio';
                                                            } else if (sub === 'stair-master' || lowType.includes('stair')) {
                                                                icon = <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />;
                                                                typeName = 'Cardio';
                                                            } else if (sub === 'skierg' || lowType.includes('ski')) {
                                                                icon = <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />;
                                                                typeName = 'Cardio';
                                                            } else {
                                                                icon = <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />;
                                                                typeName = 'Cardio';
                                                            }
                                                            colorClass = 'border-rose-500 text-rose-100 bg-rose-500/10 hover:bg-rose-500/30';
                                                        }

                                                        const displayName = ex.title || typeName;

                                                        return (
                                                            <div key={ex.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigate({
                                                                        pathname: `/träning/${year}/${monthName.toLowerCase()}`,
                                                                        search: `?activityId=${ex.id}${window.location.search ? '&' + window.location.search.replace('?', '') : ''}`
                                                                    }, { replace: true });
                                                                }}
                                                                className={`relative text-[9px] sm:text-[9.5px] leading-tight px-1 py-0.5 rounded border ${colorClass} cursor-pointer flex flex-col group/ex min-w-0 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md hover:z-[110]`}>
                                                                <span className="font-bold flex items-center min-w-0 shrink z-10 w-full">
                                                                    <div className="opacity-70 shrink-0 z-0 scale-[1.1]">{icon}</div>
                                                                    <span className="flex items-center gap-0.5 leading-none relative z-10 ml-0.5 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.8)] text-white/95 truncate">
                                                                        {(ex.subType === 'interval' || ex.subType === 'tempo' || ex.title?.toLowerCase().includes('intervall')) && <span className="text-amber-400 shrink-0">⚡</span>}
                                                                        <span className="truncate">{displayName}</span>
                                                                    </span>
                                                                </span>
                                                                <div className={`flex items-center gap-1 text-[8px] font-mono text-slate-300 z-10 whitespace-nowrap mt-0.5 w-full justify-between`}>
                                                                    <div className="flex items-center">
                                                                        {ex.distance !== undefined && ex.distance > 0 && <span className="text-emerald-400/90 font-bold">{ex.distance.toFixed(1)}<span className="text-[7.5px] opacity-70">k</span></span>}
                                                                        {ex.distance !== undefined && ex.distance > 0 && <span className="text-slate-500 mx-1">•</span>}

                                                                        {ex.heartRateAvg !== undefined && ex.heartRateAvg > 0 && !isStrengthActivity && (
                                                                            <>
                                                                                <span className="text-red-400/90 font-bold">{Math.round(ex.heartRateAvg)}<Heart className="w-2 h-2 text-red-500/70 inline-block ml-0.5" /></span>
                                                                                <span className="text-slate-500 mx-1">•</span>
                                                                            </>
                                                                        )}

                                                                        {ex.distance !== undefined && ex.distance > 0 && ex.durationMinutes > 0 && isRunActivity && (
                                                                            <>
                                                                                <span className="text-sky-400">
                                                                                    {(() => {
                                                                                        const paceDecimal = ex.durationMinutes / ex.distance;
                                                                                        const mins = Math.floor(paceDecimal);
                                                                                        const secs = Math.round((paceDecimal - mins) * 60);
                                                                                        return `${mins}:${secs.toString().padStart(2, '0')}`;
                                                                                    })()}
                                                                                </span>
                                                                                <span className="text-slate-500 mx-1">•</span>
                                                                            </>
                                                                        )}
                                                                        <span>{Math.round(ex.durationMinutes)}m</span>
                                                                    </div>
                                                                    
                                                                    {!ex.startTime && (
                                                                        <div className="hidden group-hover/ex:flex items-center gap-0.5 ml-auto">
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
                                                                    )}
                                                                </div>

                                                                {/* Rich Tooltip per Activity - positioned absolutely inside the relative day cell */}
                                                                <div className={`absolute ${weekIdx <= 1 ? 'mt-2 top-full' : 'mb-2 bottom-full'} ${dayIdx <= 3 ? 'left-[-10%]' : 'right-[-10%]'} w-56 sm:w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 sm:p-4 shadow-2xl opacity-0 group-hover/ex:opacity-100 transition-all duration-300 z-[10000] hidden md:block pointer-events-none scale-95 group-hover/ex:scale-100`}>
                                                                    <div className="flex flex-col gap-2 whitespace-normal">
                                                                        <div className="flex items-start gap-3 mb-2 pb-2 border-b border-white/10">
                                                                            <div className="p-2 rounded-xl bg-slate-800/80 text-white shrink-0 shadow-inner">
                                                                                {icon}
                                                                            </div>
                                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                                <span className="text-sm font-bold text-white uppercase tracking-wider truncate mb-0.5" title={ex.title || typeName}>
                                                                                    {ex.title || typeName}
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-400 font-bold truncate">
                                                        {ex.subType === 'race' ? 'Tävling' : typeName}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-left px-1">
                                                                            <div className="flex flex-col">
                                                                                 <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Tid</span>
                                                                                 <span className="font-mono text-slate-200 font-bold">
                                                                                    {Math.round(ex.durationMinutes)} min
                                                                                    {ex.elapsedTimeSeconds && Math.abs(ex.elapsedTimeSeconds - (ex.durationMinutes * 60)) > 0.1 && (
                                                                                        <span className="text-[9px] text-slate-500 ml-1"> (Tot: {Math.round(ex.elapsedTimeSeconds / 60)}m)</span>
                                                                                    )}
                                                                                 </span>
                                                                             </div>
                                                                             {ex.startTime && (
                                                                                 <div className="flex flex-col">
                                                                                     <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Start</span>
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
                                                                                        {ex.elapsedTimeSeconds && Math.abs(ex.elapsedTimeSeconds - (ex.durationMinutes * 60)) > 0.1 && (
                                                                                            <span className="text-[8px] text-slate-500 ml-1">
                                                                                               (T: {(() => {
                                                                                                   const paceDecimal = (ex.elapsedTimeSeconds / 60) / ex.distance!;
                                                                                                   const mins = Math.floor(paceDecimal);
                                                                                                   const secs = Math.round((paceDecimal - mins) * 60);
                                                                                                   const finalSecs = secs === 60 ? 0 : secs;
                                                                                                   const finalMins = secs === 60 ? mins + 1 : mins;
                                                                                                   return `${finalMins}:${finalSecs.toString().padStart(2, '0')}`;
                                                                                               })()})
                                                                                            </span>
                                                                                        )}
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
                                                                                    <span className="font-mono text-rose-400 font-bold flex items-center gap-1">
                                                                                        {Math.round(ex.caloriesBurned)} kcal
                                                                                        {ex.isCalorieAdjusted && (
                                                                                            <span 
                                                                                                className="text-[10px] text-amber-500 cursor-help" 
                                                                                                title={`Justerat från ${ex.originalCalories} kcal (Strava) pga låg heart rate/effekt.`}
                                                                                            >
                                                                                                ✨
                                                                                            </span>
                                                                                        )}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            {ex.averageWatts !== undefined && ex.averageWatts > 0 && (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[9px] text-sky-500/80 uppercase font-black tracking-widest">Effekt</span>
                                                                                    <span className="font-mono text-sky-400 font-bold">{ex.averageWatts} W</span>
                                                                                </div>
                                                                            )}
                                                                            {ex.heartRateAvg !== undefined && ex.heartRateAvg > 0 && !ex.excludeHeartRate && (
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

                                        <div className="flex flex-col items-center gap-0 text-[9px] sm:text-[10px] font-mono font-bold w-full mt-1.5 sm:mt-2">
                                            <div className="flex flex-col gap-[1px] w-full">
                                                {runExercises.length > 0 && (
                                                    <div
                                                        className="flex flex-col bg-emerald-500/10 text-emerald-400 px-1 py-[2px] rounded cursor-help relative group/weekrun hover:bg-emerald-500/20 transition-colors w-full border border-emerald-500/10 mb-0.5 calendar-tooltip-container"
                                                        onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `run-${weekIdx}` ? null : `run-${weekIdx}`) }}
                                                    >
                                                        {/* Line 1: Distance and Pass count */}
                                                        <div className="flex items-center justify-between w-full">
                                                            {/* Left side: Icon + Distance */}
                                                            <div className="flex items-center gap-0.5">
                                                                <Activity className="w-3 h-3 stroke-[3] shrink-0" />
                                                                <div className="flex flex-col items-start leading-none">
                                                                    <span className="text-[9px] sm:text-[10px] font-bold">
                                                                        {hasPlannedRuns ? `${Math.round(completedRunDist)}/${Math.round(totalRunDist)}` : `${Math.round(completedRunDist)}`}
                                                                        <span className="text-[7px] sm:text-[7.5px] ml-0.5 font-bold uppercase text-emerald-500/70">km</span>
                                                                    </span>
                                                                    {(() => {
                                                                        const now = new Date();
                                                                        const isCurrentWeek = week.some(d => d && d.dateStr === todayStr);
                                                                        if (isCurrentWeek) {
                                                                            const dayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
                                                                            const projected = (completedRunDist / dayOfWeek) * 7;
                                                                            return <span className="text-[6.5px] sm:text-[7px] text-emerald-500/60 leading-none">Proj: {Math.round(projected)}k</span>;
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            </div>

                                                            {/* Right side: Pass count */}
                                                            <div className="flex flex-col items-end leading-none">
                                                                <span className="text-[9px] sm:text-[10px] font-bold">
                                                                    {hasPlannedRuns ? `${completedRunExercises.length}/${runExercises.length}` : `${completedRunExercises.length}`}
                                                                    <span className="text-[7px] sm:text-[7.5px] ml-0.5 opacity-60 font-normal">p</span>
                                                                </span>
                                                                {(() => {
                                                                    const now = new Date();
                                                                    const isCurrentWeek = week.some(d => d && d.dateStr === todayStr);
                                                                    if (isCurrentWeek) {
                                                                        const dayOfWeek = now.getDay() || 7;
                                                                        const projectedFreq = (runExercises.length / dayOfWeek) * 7;
                                                                        return <span className="text-[6.5px] sm:text-[7px] text-slate-500 leading-none">{projectedFreq.toFixed(1)}/v</span>;
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        </div>

                                                        {/* Line 2: Duration and Pace/HR */}
                                                        <div className="flex items-center justify-between w-full mt-[2px] pt-[2px] border-t border-emerald-500/10">
                                                            {/* Left side: Duration */}
                                                            <div className="text-[8px] sm:text-[9px] font-medium leading-none text-emerald-300">
                                                                {(() => {
                                                                    const fmt = (mins: number) => {
                                                                        const rounded = Math.round(mins);
                                                                        const h = Math.floor(rounded / 60);
                                                                        const m = rounded % 60;
                                                                        return h > 0 ? `${h}h${m === 0 ? '' : `${m}m`}` : `${m}m`;
                                                                    };
                                                                    return hasPlannedRuns ? `${fmt(completedRunTime)}/${fmt(totalRunTime)}` : fmt(completedRunTime);
                                                                })()}
                                                            </div>

                                                            {/* Right side: Pace and optional HR */}
                                                            <div className="flex items-center gap-1 leading-none shrink-0">
                                                                <span className="text-[8px] sm:text-[9px] text-sky-400 font-bold">
                                                                    {(() => {
                                                                        const distToUse = completedRunDist > 0 ? completedRunDist : totalRunDist;
                                                                        const timeToUse = completedRunDist > 0 ? completedRunTime : totalRunTime;
                                                                        if (distToUse > 0) {
                                                                            const paceDecimal = timeToUse / distToUse;
                                                                            const m = Math.floor(paceDecimal);
                                                                            const s = Math.round((paceDecimal - m) * 60);
                                                                            const finalS = s === 60 ? 0 : s;
                                                                            const finalM = s === 60 ? m + 1 : m;
                                                                            return `${finalM}:${finalS.toString().padStart(2, '0')}`;
                                                                        }
                                                                        return '-';
                                                                    })()}
                                                                </span>
                                                                {(() => {
                                                                    const hrExs = completedRunExercises.filter(e => e.heartRateAvg && e.heartRateAvg > 0 && !e.excludeHeartRate);
                                                                    if (hrExs.length > 0) {
                                                                        const avgHr = Math.round(hrExs.reduce((sum, e) => sum + e.heartRateAvg!, 0) / hrExs.length);
                                                                        return <span className="text-[7.5px] sm:text-[8px] text-red-400 font-bold">{avgHr}</span>;
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
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
                                                                    <div className="text-emerald-400 font-mono">
                                                                        {completedRunDist > 0 && <span>{completedRunDist.toFixed(1)}k / </span>}
                                                                        {totalRunDist.toFixed(1)} km
                                                                    </div>
                                                                    <div className="text-slate-400 font-mono text-[9px] font-normal">
                                                                        {completedRunTime > 0 && <span>{Math.round(completedRunTime)}m / </span>}
                                                                        {Math.round(totalRunTime)}m
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {totalStrengthMin > 0 && (
                                                    <div
                                                        className="flex items-center justify-between bg-indigo-500/10 text-indigo-400 px-1 py-[2px] rounded cursor-help relative group/weekstr hover:bg-indigo-500/20 transition-colors w-full border border-indigo-500/10 mb-0.5 calendar-tooltip-container"
                                                        onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `str-${weekIdx}` ? null : `str-${weekIdx}`) }}
                                                    >
                                                        <Dumbbell className="w-3 h-3 shrink-0" />
                                                        <div className="flex items-baseline gap-1 font-mono text-[9px] font-bold">
                                                            <span>
                                                                {(() => {
                                                                    const fmt = (mins: number) => {
                                                                        const rounded = Math.round(mins);
                                                                        const h = Math.floor(rounded / 60);
                                                                        const m = rounded % 60;
                                                                        return h > 0 ? `${h}h${m === 0 ? '' : `${m}m`}` : `${m}m`;
                                                                    };
                                                                    return hasPlannedStrength ? `${fmt(completedStrengthMin)}/${fmt(totalStrengthMin)}` : fmt(completedStrengthMin);
                                                                })()}
                                                            </span>
                                                            <span className="text-[8px] opacity-40 mx-0.5">•</span>
                                                            <span>
                                                                {hasPlannedStrength ? `${completedStrengthExercises.length}/${strengthExercises.length}` : `${completedStrengthExercises.length}`}
                                                                <span className="text-[7.5px] ml-0.5 opacity-60 font-normal">p</span>
                                                            </span>
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
                                                                        {completedStrengthMin > 0 && <span>{Math.round(completedStrengthMin)}m / </span>}
                                                                        {Math.round(totalStrengthMin)}m
                                                                    </div>
                                                                    <div className="text-slate-400 font-mono text-[9px] font-normal">
                                                                        {completedTonnage > 0 && <span>{(completedTonnage / 1000).toFixed(1)}t / </span>}
                                                                        {(totalTonnage / 1000).toFixed(1)}t
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {totalOtherCardioMin > 0 && (
                                                    <div
                                                         className="flex items-center justify-between bg-sky-500/10 text-sky-400 px-1 py-[1px] rounded cursor-help relative group/weekother hover:bg-sky-500/20 transition-colors w-full border border-sky-500/10 mb-0.5 calendar-tooltip-container"
                                                         onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `other-${weekIdx}` ? null : `other-${weekIdx}`) }}
                                                    >
                                                         <HeartPulse className="w-3 h-3 shrink-0" />
                                                         <div className="flex items-baseline gap-1 font-mono text-[9px] font-bold">
                                                             <span>
                                                                 {(() => {
                                                                     const fmt = (mins: number) => {
                                                                         const rounded = Math.round(mins);
                                                                         const h = Math.floor(rounded / 60);
                                                                         const m = rounded % 60;
                                                                         return h > 0 ? `${h}h${m === 0 ? '' : `${m}m`}` : `${m}m`;
                                                                     };
                                                                     return hasPlannedOther ? `${fmt(completedOtherCardioMin)}/${fmt(totalOtherCardioMin)}` : fmt(completedOtherCardioMin);
                                                                 })()}
                                                             </span>
                                                             <span className="text-[8px] opacity-40 mx-0.5">•</span>
                                                             <span>
                                                                 {hasPlannedOther ? `${completedOtherCardioCount}/${totalOtherCardioCount}` : `${completedOtherCardioCount}`}
                                                                 <span className="text-[7.5px] ml-0.5 opacity-60 font-normal">p</span>
                                                             </span>
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
                                                                         {completedOtherCardioMin > 0 && <span>{Math.round(completedOtherCardioMin)}m / </span>}
                                                                         {Math.round(totalOtherCardioMin)}m
                                                                     </div>
                                                                     <div className="text-slate-400 font-mono text-[9px] font-normal">
                                                                         {otherCardioExercises.reduce((acc, e) => acc + (e.caloriesBurned || 0), 0)} kcal
                                                                     </div>
                                                                 </div>
                                                             </div>
                                                         </div>
                                                     </div>
                                                )}
                                                {totalTonnage > 0 && (
                                                    <div className="flex items-center justify-between bg-slate-800/50 text-indigo-400 px-1 py-[1px] rounded cursor-help relative group/weektng hover:bg-slate-700/50 transition-colors w-full border border-white/5 mb-0.5">
                                                        <Scale className="w-3 h-3 shrink-0" />
                                                        <span className="font-mono text-[9px] font-bold">
                                                            {hasPlannedStrength ? `${(completedTonnage / 1000).toFixed(1)}/${(totalTonnage / 1000).toFixed(1)}` : `${(completedTonnage / 1000).toFixed(1)}`}
                                                            <span className="text-[7.5px] ml-0.5 opacity-60 font-normal">t</span>
                                                        </span>
                                                        <div className="absolute right-full mr-2 top-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl opacity-0 xl:group-hover/weektng:opacity-100 transition-all duration-300 -translate-x-2 xl:group-hover/weektng:translate-x-0 z-[9999] hidden xl:block pointer-events-none cursor-default scale-95 xl:group-hover/weektng:scale-100 shadow-indigo-500/10">
                                                            <div className="text-xs text-slate-400 font-bold mb-3 pb-2 border-b border-white/10">Veckans Styrkevolym</div>
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Avklarat</span>
                                                                    <span className="text-indigo-400 font-mono font-bold">{completedTonnage.toLocaleString('sv-SE')} kg</span>
                                                                </div>
                                                                {hasPlannedStrength && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-500">Totalt (inkl planerat)</span>
                                                                        <span className="text-indigo-400 font-mono font-bold">{totalTonnage.toLocaleString('sv-SE')} kg</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {weekTotalMin === 0 && (
                                                    <div className="text-slate-600 italic text-[9px] text-center w-full py-2">Vila</div>
                                                )}
                                            </div>

                                            {weekTotalMin > 0 && (
                                                <div
                                                    className="flex flex-col border-t border-white/5 pt-1 w-full relative group/weektot cursor-help calendar-tooltip-container mt-1"
                                                    onClick={(e) => { e.stopPropagation(); setPinnedTooltip(pinnedTooltip === `tot-${weekIdx}` ? null : `tot-${weekIdx}`) }}
                                                >
                                                    {hasPlannedInWeek ? (
                                                        <div className="flex flex-col gap-[1px] w-full">
                                                            {/* Row 1: FAKT */}
                                                            <div className="flex items-center justify-between w-full px-1 bg-white/5 rounded py-[1px] hover:bg-white/10 transition-colors text-[9px] font-bold">
                                                                <span className="flex items-center text-slate-500" title="Faktiskt avklarat">
                                                                    <Sigma className="w-3 h-3 text-slate-400 shrink-0" />
                                                                </span>
                                                                <div className="flex items-center gap-0.5 text-[9px] font-bold leading-none font-mono">
                                                                    {completedRunDist > 0 && (
                                                                        <>
                                                                            <span className="text-emerald-400">{Math.round(completedRunDist)}k</span>
                                                                            <span className="text-slate-500 opacity-60">•</span>
                                                                        </>
                                                                    )}
                                                                    {(() => {
                                                                        const sessions = completedTotalExercises.filter(e => !isWarmupOrCooldown(e));
                                                                        const warmCount = completedTotalExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                        return <span className="text-slate-400">{sessions.length}{warmCount > 0 ? `(+${warmCount})` : ''}p</span>;
                                                                    })()}
                                                                    <span className="text-slate-500 opacity-60">•</span>
                                                                    <span className="text-slate-300">
                                                                        {(() => {
                                                                            const rounded = Math.round(completedTotalMin);
                                                                            const h = Math.floor(rounded / 60);
                                                                            const m = rounded % 60;
                                                                            return h > 0 ? `${h}h${m === 0 ? '' : `${m}m`}` : `${m}m`;
                                                                        })()}
                                                                    </span>
                                                                    {completedCalories > 0 && (
                                                                        <>
                                                                            <span className="text-slate-500 opacity-60">•</span>
                                                                            <span className="text-rose-400/90">{Math.round(completedCalories)}<span className="text-[7.5px] ml-0.25 opacity-70">c</span></span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Row 2: INKL */}
                                                            <div className="flex items-center justify-between w-full px-1 bg-emerald-500/5 border border-emerald-500/10 rounded py-[1px] hover:bg-emerald-500/10 transition-colors text-[9px] font-bold">
                                                                <span className="flex items-center text-emerald-500/85" title="Inklusive planerat (prognos)">
                                                                    <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                                                                </span>
                                                                <div className="flex items-center gap-0.5 text-[9px] font-bold leading-none font-mono">
                                                                    {totalRunDist > 0 && (
                                                                        <>
                                                                            <span className="text-emerald-400">{Math.round(totalRunDist)}k</span>
                                                                            <span className="text-slate-500 opacity-60">•</span>
                                                                        </>
                                                                    )}
                                                                    {(() => {
                                                                        const sessions = weekExercises.filter(e => !isWarmupOrCooldown(e));
                                                                        const warmCount = weekExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                        return <span className="text-slate-400">{sessions.length}{warmCount > 0 ? `(+${warmCount})` : ''}p</span>;
                                                                    })()}
                                                                    <span className="text-slate-500 opacity-60">•</span>
                                                                    <span className="text-slate-300">
                                                                        {(() => {
                                                                            const rounded = Math.round(weekTotalMin);
                                                                            const h = Math.floor(rounded / 60);
                                                                            const m = rounded % 60;
                                                                            return h > 0 ? `${h}h${m === 0 ? '' : `${m}m`}` : `${m}m`;
                                                                        })()}
                                                                    </span>
                                                                    {weekCalories > 0 && (
                                                                        <>
                                                                            <span className="text-slate-500 opacity-60">•</span>
                                                                            <span className="text-rose-400/90">{Math.round(weekCalories)}<span className="text-[7.5px] ml-0.25 opacity-70">c</span></span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* Single Row: TOT */
                                                        <div className="flex items-center justify-between w-full px-1 bg-white/5 rounded py-[1px] hover:bg-white/10 transition-colors text-[9px] font-bold">
                                                            <span className="text-slate-500 uppercase font-black tracking-widest leading-none">TOT</span>
                                                            <div className="flex items-center gap-0.5 text-[9px] font-bold leading-none font-mono">
                                                                {completedRunDist > 0 && (
                                                                    <>
                                                                        <span className="text-emerald-400">{Math.round(completedRunDist)}k</span>
                                                                        <span className="text-slate-500 opacity-60">•</span>
                                                                    </>
                                                                )}
                                                                {(() => {
                                                                    const sessions = completedTotalExercises.filter(e => !isWarmupOrCooldown(e));
                                                                    const warmCount = completedTotalExercises.filter(e => isWarmupOrCooldown(e)).length;
                                                                    return <span className="text-slate-400">{sessions.length}{warmCount > 0 ? `(+${warmCount})` : ''}p</span>;
                                                                })()}
                                                                <span className="text-slate-500 opacity-60">•</span>
                                                                <span className="text-slate-300">
                                                                    {(() => {
                                                                        const rounded = Math.round(completedTotalMin);
                                                                        const h = Math.floor(rounded / 60);
                                                                        const m = rounded % 60;
                                                                        return h > 0 ? `${h}h${m === 0 ? '' : `${m}m`}` : `${m}m`;
                                                                    })()}
                                                                </span>
                                                                {completedCalories > 0 && (
                                                                    <>
                                                                        <span className="text-slate-500 opacity-60">•</span>
                                                                        <span className="text-rose-400/90">{Math.round(completedCalories)}<span className="text-[7.5px] ml-0.25 opacity-70">c</span></span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

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

                                                                const isRunActivity = isRun(e);
                                                                const isStrengthActivity = isStrength(e);
                                                                const isRace = e.subType === 'race';

                                                                let colorName = 'text-slate-200';
                                                                if (isRace) colorName = 'text-amber-400 font-bold';
                                                                else if (isRunActivity) colorName = 'text-emerald-100';
                                                                else if (isStrengthActivity) colorName = 'text-indigo-100';
                                                                else if (e.type.includes('cycl')) colorName = 'text-sky-100';
                                                                else if (e.type.includes('walk')) colorName = 'text-amber-100';

                                                                let valueStr = Math.round(e.durationMinutes) + 'm';
                                                                if (e.distance && e.distance > 0) valueStr = e.distance.toFixed(1) + 'km';

                                                                let valColor = 'text-slate-300';
                                                                if (isRunActivity) valColor = 'text-emerald-400';
                                                                else if (isStrengthActivity) valColor = 'text-indigo-400';
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
                                                                            {isRace ? '🏆 ' : ''}{e.title || e.type.replace('strength', 'Styrka').replace('running', 'Löpning').replace('cardio', 'Allmän Cardio')}
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
                                                                    {completedTotalMin > 0 && <span>{formatHhMm(completedTotalMin)} / </span>}
                                                                    {formatHhMm(weekTotalMin)}
                                                                </div>
                                                                <div className="text-slate-500 font-mono text-[9px] font-normal">
                                                                    {completedCalories > 0 && <span>{Math.round(completedCalories)} kcal / </span>}
                                                                    {Math.round(weekCalories)} kcal
                                                                </div>
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
                    <div className="group bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:from-slate-800/60 hover:to-slate-900/80 p-3 sm:p-4 rounded-3xl border border-white/5 hover:border-white/10 shadow-lg transition-all duration-500 flex flex-col justify-between relative">
                        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                            <div className="absolute -right-8 -top-8 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl group-hover:bg-sky-500/10 transition-colors duration-500"></div>
                        </div>
                        <div className="relative z-10 flex justify-between items-start mb-2">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-tight">Pass & Frekvens</p>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full ring-1 ring-emerald-500/20">{stats.freqPercent}% aktiva | {stats.inactiveDays || 0} vilodgr</span>
                        </div>
                        <div className="relative z-10 flex items-center justify-between gap-4 mb-3">
                            <div className="flex-1 flex flex-col border-r border-white/5 pr-4">
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Pass</p>
                                <div className="flex items-end gap-1.5">
                                    <p className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 tracking-tighter leading-none">
                                        {stats.count}{stats.warmupCount > 0 && <span className="text-xl sm:text-2xl opacity-40 ml-0.5">+{stats.warmupCount}</span>}
                                    </p>
                                    <div className="flex flex-col items-start pb-0.5">
                                        {stats.warmupCount > 0 && (
                                            <div className="group/wu relative mb-0.5">
                                                <span className="text-[10px] leading-none font-black text-rose-400 bg-rose-400/10 px-1 py-0.5 rounded cursor-help transition-colors hover:bg-rose-400/20">+{stats.warmupCount}</span>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-md border border-rose-500/20 rounded-xl p-3 shadow-2xl opacity-0 group-hover/wu:opacity-100 transition-all duration-300 pointer-events-none z-50 transform group-hover/wu:-translate-y-1">
                                                    <p className="text-[10px] font-black text-rose-400 uppercase mb-2 flex items-center gap-1.5"><Flame className="w-3 h-3" /> Upp/nerjogg</p>
                                                    <div className="space-y-1.5">
                                                        {stats.warmups.map((w : any, i : number) => (
                                                            <div key={i} className="flex justify-between items-center text-[10px]">
                                                                <span className="text-slate-300 truncate max-w-[100px] font-medium">{w.title || w.type}</span>
                                                                <span className="text-slate-500 font-mono bg-slate-950 px-1 rounded">{w.distance?.toFixed(1)}k</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="mt-2 pt-2 border-t border-white/5 text-[9px] text-slate-400 italic">Undantagna från pass-räkningen.</p>
                                                </div>
                                            </div>
                                        )}
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter leading-none">totalt</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col">
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Tid</p>
                                <div className="flex flex-col items-start gap-0.5">
                                    <div className="flex items-end gap-0.5">
                                        <p className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 tracking-tighter leading-none">
                                            {Math.floor(stats.duration / 60)}<span className="text-xs sm:text-lg font-bold text-slate-500 mx-0.5">h</span>
                                            {Math.round(stats.duration % 60)}<span className="text-xs sm:text-lg font-bold text-slate-500 ml-0.5">m</span>
                                        </p>
                                    </div>
                                    {/* The planned/extra duration block has been removed to save space */}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-10 grid grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-white/5">
                            <div className="bg-sky-900/10 rounded-lg py-0.5 px-1.5 text-center border border-sky-500/10">
                                <p className="text-[8px] text-sky-500/70 uppercase font-black tracking-widest mb-0.5">Tävling</p>
                                <p className="text-xs font-black text-sky-400">
                                    {stats.raceCount}
                                    {stats.plannedRaceCount > 0 && <span className="text-[10px] opacity-60 ml-0.5"> (+{stats.plannedRaceCount})</span>}
                                </p>
                            </div>
                            <div className="group/qual relative bg-amber-900/10 rounded-lg py-0.5 px-1.5 text-center border border-amber-500/10 cursor-help transition-colors hover:bg-amber-900/20">
                                <p className="text-[8px] text-amber-500/70 uppercase font-black tracking-widest mb-0.5">Kvalitet</p>
                                <p className="text-xs font-black text-amber-400">{stats.qualityCount}</p>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-md border border-amber-500/20 rounded-xl p-3 shadow-2xl opacity-0 group-hover/qual:opacity-100 transition-all duration-300 pointer-events-none z-50 transform group-hover/qual:-translate-y-1">
                                    <p className="text-[10px] font-black text-amber-400 uppercase mb-2 flex items-center gap-1.5"><Activity className="w-3 h-3" /> Kvalitetspass</p>
                                    <p className="text-[10px] text-slate-300 leading-relaxed">
                                        Pass markerade som <span className="text-white font-bold">Intervall</span>, <span className="text-white font-bold">Tempo</span>, <span className="text-white font-bold">Tävling</span> eller med dessa ord i titeln.
                                    </p>
                                </div>
                            </div>
                            <div className="group/lp relative bg-orange-900/10 rounded-lg py-0.5 px-1.5 text-center border border-orange-500/10 cursor-help transition-colors hover:bg-orange-900/20">
                                <p className="text-[8px] text-orange-500/70 uppercase font-black tracking-widest mb-0.5">Långpass</p>
                                <p className="text-xs font-black text-orange-400">{stats.longRunCount}</p>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-md border border-orange-500/20 rounded-xl p-3 shadow-2xl opacity-0 group-hover/lp:opacity-100 transition-all duration-300 pointer-events-none z-50 transform group-hover/lp:-translate-y-1 text-left">
                                    <p className="text-[10px] font-black text-orange-400 uppercase mb-2 flex items-center gap-1.5"><Route className="w-3 h-3" /> Krav för långpass</p>
                                    <div className="space-y-1.5 text-[10px] text-slate-300">
                                        <div className="flex justify-between border-b border-white/5 pb-1">
                                            <span>Löpning (dist):</span>
                                            <span className="font-bold text-white">≥ {longRunThreshold} km</span>
                                        </div>
                                        <div className="flex justify-between border-b border-white/5 pb-1">
                                            <span>Löpning (tid):</span>
                                            <span className="font-bold text-white">≥ 120 min</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Annan sport:</span>
                                            <span className="font-bold text-white">≥ 150 min</span>
                                        </div>
                                    </div>
                                    <p className="mt-2 pt-2 border-t border-white/5 text-[9px] text-slate-400 italic">Pass på 15km räknas nu som "Längre distans" och exkluderas.</p>
                                </div>
                            </div>
                            <div className="bg-rose-900/10 rounded-lg py-0.5 px-1.5 text-center border border-rose-500/10">
                                <p className="text-[8px] text-rose-500/70 uppercase font-black tracking-widest mb-0.5">Sjukdgr</p>
                                <p className="text-xs font-black text-rose-400">
                                    {stats.sickDays}
                                    {stats.sickFeelingDays > 0 && <span className="text-[9px] font-bold text-amber-500/80 ml-0.5">+{stats.sickFeelingDays}</span>}
                                </p>
                            </div>

                            <div className="bg-slate-900/30 rounded-lg py-0.5 px-1.5 text-center border border-white/[0.02]">
                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Pass/V</p>
                                <p className="text-xs font-black text-white">{stats.perWeek}</p>
                            </div>
                            <div className="bg-slate-900/30 rounded-lg py-0.5 px-1.5 text-center border border-white/[0.02]">
                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt/V</p>
                                <p className="text-xs font-black text-white">
                                    {Math.floor(stats.timePerWeek / 60)}<span className="text-[9px] font-bold text-slate-500 mx-0.5">h</span>{Math.round(stats.timePerWeek % 60)}<span className="text-[9px] font-bold text-slate-500 ml-0.5">m</span>
                                </p>
                            </div>
                            <div className="bg-slate-900/30 rounded-lg py-0.5 px-1.5 text-center border border-white/[0.02]">
                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt/D</p>
                                <p className="text-xs font-black text-white">{stats.timePerDay}<span className="text-[9px] font-bold text-slate-500 ml-0.5">m</span></p>
                            </div>
                            <div className="bg-slate-900/30 rounded-lg py-0.5 px-1.5 text-center border border-white/[0.02]">
                                <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Snitt/P</p>
                                <p className="text-xs font-black text-white">{stats.count > 0 ? Math.round(stats.duration / stats.count) : 0}<span className="text-[9px] font-bold text-slate-500 ml-0.5">m</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Kolumn 2: Tid & Duration */}
                    <div className="group bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:from-slate-800/60 hover:to-slate-900/80 p-3 sm:p-4 rounded-3xl border border-white/5 hover:border-white/10 shadow-lg transition-all duration-500 flex flex-col justify-between relative">
                        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                            <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
                        </div>
                        <div className="relative z-10 flex justify-between items-start mb-2">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-tight">Analys & Höjdpunkter</p>
                            <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-0.5 rounded-full border border-white/5">
                                {(() => {
                                    const runCount = Object.entries(stats.countDist).filter(([k]) => k.includes('run') || k.includes('löp')).reduce((sum, [, v]) => sum + v, 0);
                                    const runWarmups = Object.entries(stats.warmupCountDist).filter(([k]) => k.includes('run') || k.includes('löp')).reduce((sum, [, v]) => sum + v, 0);
                                    if (runCount === 0 && runWarmups === 0) return null;
                                    return (
                                        <span className="text-[9px] font-black text-emerald-400 flex items-center gap-1">
                                            <Footprints className="w-2.5 h-2.5" /> {runCount}{runWarmups > 0 ? `+${runWarmups}` : ''}
                                        </span>
                                    );
                                })()}
                                {(() => {
                                    const bikeCount = Object.entries(stats.countDist).filter(([k]) => k.includes('cycl') || k.includes('cyk')).reduce((sum, [, v]) => sum + v, 0);
                                    const bikeWarmups = Object.entries(stats.warmupCountDist).filter(([k]) => k.includes('cycl') || k.includes('cyk')).reduce((sum, [, v]) => sum + v, 0);
                                    if (bikeCount === 0 && bikeWarmups === 0) return null;
                                    return (
                                        <span className="text-[9px] font-black text-sky-400 flex items-center gap-1">
                                            <Bike className="w-2.5 h-2.5" /> {bikeCount}{bikeWarmups > 0 ? `+${bikeWarmups}` : ''}
                                        </span>
                                    );
                                })()}
                                {(() => {
                                    const strengthCount = Object.entries(stats.countDist).filter(([k]) => k.includes('strength') || k.includes('styrk')).reduce((sum, [, v]) => sum + v, 0);
                                    const strengthWarmups = Object.entries(stats.warmupCountDist).filter(([k]) => k.includes('strength') || k.includes('styrk')).reduce((sum, [, v]) => sum + v, 0);
                                    if (strengthCount === 0 && strengthWarmups === 0) return null;
                                    return (
                                        <span className="text-[9px] font-black text-indigo-400 flex items-center gap-1">
                                            <Dumbbell className="w-2.5 h-2.5" /> {strengthCount}{strengthWarmups > 0 ? `+${strengthWarmups}` : ''}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="relative z-10 flex flex-col gap-1.5 mt-1 mb-auto">
                                <div className="flex items-center justify-between bg-slate-950/40 hover:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-white/[0.03] transition-colors group/item">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1.5 group-hover/item:text-slate-300 transition-colors">
                                        <Flame className="w-3 h-3 text-orange-500" /> Längsta svit
                                    </span>
                                    <span className="text-xs font-black text-white">{stats.longestStreak} <span className="text-[9px] text-slate-500 font-bold">dgr</span> {stats.longestStreakPasses > 0 && <span className="text-[9px] font-black text-orange-400 bg-orange-500/10 px-1.5 rounded ml-1">({stats.longestStreakPasses}p)</span>}</span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-950/40 hover:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-white/[0.03] transition-colors group/item">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1.5 group-hover/item:text-slate-300 transition-colors">
                                        <Activity className="w-3 h-3 text-sky-400" /> Dubbel / Trippel
                                    </span>
                                    <span className="text-xs font-black text-white">
                                        {stats.doubleDays}
                                        {stats.tripleDays > 0 && <span className="text-sky-400/80 mx-1">/ {stats.tripleDays}</span>}
                                        <span className="text-[9px] text-slate-500 font-bold ml-1">dgr</span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between bg-slate-950/40 hover:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-white/[0.03] transition-colors group/item">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 group-hover/item:text-slate-300 transition-colors">Längsta pass</span>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 mr-1.5 border-r border-white/10 pr-2">
                                            {stats.longestSession.distance > 0 && <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">{Math.floor(stats.longestSession.duration/stats.longestSession.distance)}:{Math.round((stats.longestSession.duration/stats.longestSession.distance % 1)*60).toString().padStart(2,'0')}/k</span>}
                                            {stats.longestSession.hr > 0 && <span className="text-[8px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded">{Math.round(stats.longestSession.hr)}bpm</span>}
                                        </div>
                                        {stats.longestSession.duration > 0 && (
                                            <span className="text-[9px] text-slate-500 uppercase font-black" title={stats.longestSession.title}>
                                                {new Date(stats.longestSession.date).getDate()} {MONTHS[new Date(stats.longestSession.date).getMonth()].substring(0,3)}
                                            </span>
                                        )}
                                        <span className="text-xs font-black text-white ml-0.5">{Math.floor(stats.longestSession.duration/60) > 0 ? `${Math.floor(stats.longestSession.duration/60)}h ` : ''}{Math.round(stats.longestSession.duration%60)}m</span>
                                    </div>
                                </div>
                                {!(stats.biggestDay.date === stats.longestSession.date && Math.round(stats.biggestDay.duration) === Math.round(stats.longestSession.duration)) && (
                                    <div className="flex items-center justify-between bg-slate-950/40 hover:bg-slate-900/60 px-2.5 py-1.5 rounded-xl border border-white/[0.03] transition-colors group/item">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 group-hover/item:text-slate-300 transition-colors">Största dag</span>
                                        <div className="flex items-center gap-2">
                                            {stats.biggestDay.duration > 0 && (
                                                <div className="flex items-center gap-2 mr-1.5 border-r border-white/10 pr-2">
                                                    {stats.biggestDay.distance > 0 && <span className="text-[8px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">{stats.biggestDay.distance.toFixed(1)}k</span>}
                                                    {stats.biggestDay.hr > 0 && <span className="text-[8px] font-mono font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded">{Math.round(stats.biggestDay.hr)}bpm</span>}
                                                </div>
                                            )}
                                            {stats.biggestDay.duration > 0 && (
                                                <span className="text-[9px] text-slate-500 uppercase font-black" title="Månadens mest volymrika dag">
                                                    {new Date(stats.biggestDay.date).getDate()} {MONTHS[new Date(stats.biggestDay.date).getMonth()].substring(0,3)}
                                                </span>
                                            )}
                                            <span className="text-xs font-black text-white ml-0.5">{Math.floor(stats.biggestDay.duration/60) > 0 ? `${Math.floor(stats.biggestDay.duration/60)}h ` : ''}{Math.round(stats.biggestDay.duration%60)}m</span>
                                        </div>
                                    </div>
                                )}
                        </div>

                        <div className="relative z-10 grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-white/5">
                            <div className="bg-emerald-900/10 rounded-lg py-0.5 px-1.5 border border-emerald-500/10 flex flex-col items-center">
                                <p className="text-[8px] text-emerald-500/70 uppercase font-black tracking-widest mb-0.5 flex items-center gap-1"><Footprints className="w-2.5 h-2.5" /> Snitt Fart</p>
                                <p className="text-xs font-black text-emerald-400">{stats.avgRunPace > 0 ? `${Math.floor(stats.avgRunPace)}:${Math.round((stats.avgRunPace % 1)*60).toString().padStart(2,'0')}` : '-'} <span className="text-[9px] font-bold text-emerald-500/50">/k</span></p>
                            </div>
                            <div className="bg-sky-900/10 rounded-lg py-0.5 px-1.5 border border-sky-500/10 flex flex-col items-center">
                                <p className="text-[8px] text-sky-500/70 uppercase font-black tracking-widest mb-0.5 flex items-center gap-1"><Route className="w-2.5 h-2.5" /> Snitt Dist</p>
                                <p className="text-xs font-black text-sky-400">{stats.avgDist > 0 ? stats.avgDist.toFixed(1) : '-'} <span className="text-[9px] font-bold text-sky-500/50">km</span></p>
                            </div>
                            <div className="bg-rose-900/10 rounded-lg py-0.5 px-1.5 border border-rose-500/10 flex flex-col items-center">
                                <p className="text-[8px] text-rose-500/70 uppercase font-black tracking-widest mb-0.5 flex items-center gap-1"><Heart className="w-2.5 h-2.5" /> Snitt Puls</p>
                                <p className="text-xs font-black text-rose-400">{stats.avgHr > 0 ? stats.avgHr : '-'} <span className="text-[9px] font-bold text-rose-500/50">bpm</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Kolumn 3: Distans & Styrkevolym */}
                    <div className="flex flex-col gap-4 lg:col-span-1">
                        <div className="flex-1 bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/10 shadow-inner flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[10px] text-emerald-500/80 uppercase font-black tracking-widest flex items-center gap-1.5"><Activity className="w-3 h-3" /> Löpning</p>
                                <div className="flex gap-1.5">
                                    {stats.qualityCount > 0 && <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="Kvalitetspass">Kvalitet: {stats.qualityCount}</span>}
                                    {stats.raceCount > 0 && <span className="text-[8px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20" title="Tävlingar">🏆 {stats.raceCount}</span>}
                                </div>
                            </div>
                            <div className="flex items-baseline justify-between mb-3">
                                <div className="flex flex-col">
                                    <p className="text-3xl font-black text-emerald-400 leading-none">{stats.distance.toFixed(1)} <span className="text-sm font-bold text-emerald-500/60">km</span></p>
                                    <p className="text-[9px] font-bold text-emerald-500/40 uppercase mt-1">Totalt denna månad</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-emerald-500/60 uppercase">Snitt / v</p>
                                    <p className="text-sm font-black text-emerald-400">{stats.distancePerWeek.toFixed(1)} km</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/5">
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-emerald-500/50 uppercase font-black">Långpass</span>
                                    <span className="text-xs font-black text-emerald-200">{stats.longRunCount} st</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[8px] text-emerald-500/50 uppercase font-black">Snitt-tempo</span>
                                    <span className="text-xs font-black text-emerald-200">{stats.avgRunPace > 0 ? `${Math.floor(stats.avgRunPace)}:${Math.round((stats.avgRunPace % 1)*60).toString().padStart(2,'0')}` : '-'} <span className="text-[9px] font-bold opacity-50">/k</span></span>
                                </div>
                            </div>
                        </div>

                        {stats.tonnage > 0 && (
                            <div className="flex-1 bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/10 shadow-inner flex flex-col justify-center">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-[10px] text-indigo-500/80 uppercase font-black tracking-widest flex items-center gap-1.5"><Dumbbell className="w-3 h-3" /> Styrka</p>
                                    <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">{stats.countDist['strength'] || 0} pass</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div className="flex flex-col">
                                        <p className="text-3xl font-black text-indigo-400 leading-none">{(stats.tonnage / 1000).toFixed(1)} <span className="text-sm font-bold text-indigo-500/60">ton</span></p>
                                        <p className="text-[9px] font-bold text-indigo-500/40 uppercase mt-1">Total volym</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-bold text-indigo-500/60 uppercase">Snitt / v</p>
                                        <p className="text-sm font-black text-indigo-400">{(stats.tonnagePerWeek / 1000).toFixed(1)} t</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-900/60 p-4 sm:p-5 rounded-3xl border border-white/5 shadow-2xl flex flex-col relative group/dist-card overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                        <div className="flex justify-between items-center mb-5 relative z-10">
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em]">
                                {distMode === 'time' ? 'Tidsfördelning' : 'Passfördelning'}
                            </p>
                            <button 
                                onClick={() => setDistMode(distMode === 'time' ? 'count' : 'time')} 
                                className="text-[9px] font-black text-slate-400 hover:text-white bg-white/5 border border-white/10 px-2.5 py-1 rounded-full transition-all hover:bg-white/10 hover:border-white/20 uppercase tracking-wider"
                            >
                                {distMode === 'time' ? 'Visa Pass' : 'Visa Tid'}
                            </button>
                        </div>
                        <div className="space-y-3.5 w-full my-auto relative z-10">
                            {Object.entries(distMode === 'time' ? stats.timeDist : stats.countDist).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([type, value]) => {
                                const percent = Math.round(((value as number) / (distMode === 'time' ? stats.duration : stats.count)) * 100);
                                
                                let IconComp = Activity;
                                let iconColor = 'text-slate-400';
                                let barColor = 'bg-slate-400';

                                if (type.includes('running') || type.includes('run')) {
                                    IconComp = Zap;
                                    iconColor = 'text-emerald-500';
                                    barColor = 'bg-emerald-500';
                                } else if (type === 'strength') {
                                    IconComp = Dumbbell;
                                    iconColor = 'text-indigo-500';
                                    barColor = 'bg-indigo-500';
                                } else if (type === 'cycling') {
                                    IconComp = Bike;
                                    iconColor = 'text-sky-500';
                                    barColor = 'bg-sky-500';
                                } else if (type === 'walking') {
                                    IconComp = Footprints;
                                    iconColor = 'text-amber-500';
                                    barColor = 'bg-amber-500';
                                } else if (type === 'cardio') {
                                    IconComp = HeartPulse;
                                    iconColor = 'text-rose-500';
                                    barColor = 'bg-rose-500';
                                }

                                const label = type.includes('running') || type.includes('run') ? 'Löpning' :
                                    type === 'strength' ? 'Styrka' :
                                        type === 'cycling' ? 'Cykling' :
                                            type === 'walking' ? 'Promenad' : 
                                                type === 'cardio' ? 'Allmän Cardio' : type;

                                return (
                                    <div key={type} className="flex items-center gap-3 group/dist-row">
                                        <div className={`w-8 h-8 shrink-0 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center transition-all group-hover/dist-row:bg-white/10 group-hover/dist-row:border-white/10 ${iconColor}`}>
                                            <IconComp className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between mb-1.5 items-end">
                                                <span className="text-white text-[10px] font-black uppercase tracking-tight truncate leading-none">
                                                    {label}
                                                </span>
                                                <div className="flex items-baseline gap-1.5 leading-none shrink-0 ml-2">
                                                    <span className="font-mono font-black text-white text-[10px]">
                                                        {percent}%
                                                    </span>
                                                    <span className="text-slate-500 font-bold text-[9px] uppercase">
                                                        {distMode === 'time' ? (
                                                            `${value >= 60 ? `${Math.floor(value as number / 60)}h ${Math.round(value as number % 60)}m` : `${Math.round(value as number)}m`}`
                                                        ) : (
                                                            `${value} pass`
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden relative">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,0,0,0.5)] ${barColor}`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(stats.timeDist).length === 0 && (
                                <div className="text-center text-slate-500 italic text-xs py-8 bg-white/5 rounded-2xl border border-dashed border-white/10">Ingen data registrerad</div>
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
