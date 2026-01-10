import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { getTrainingSuggestions, TrainingSuggestion } from '../utils/trainingSuggestions.ts';
import {
    PlannedActivity,
    generateId,
    getISODate,
    getWeekStartDate,
    WEEKDAYS,
    Weekday
} from '../models/types.ts';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    Plus,
    Dumbbell,
    Activity,
    Zap,
    X,
    Check,
    Target,
    TrendingUp,
    Clock,
    Trophy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDuration } from '../utils/dateUtils.ts';
import { TrainingPeriodBanner } from '../components/planning/TrainingPeriodBanner.tsx';
import { ActivityModal } from '../components/planning/ActivityModal.tsx';
import { WeeklyStatsAnalysis } from '../components/planning/WeeklyStatsAnalysis.tsx';

const SHORT_WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export function TrainingPlanningPage() {
    const navigate = useNavigate();
    const {
        strengthSessions,
        performanceGoals,
        plannedActivities,
        savePlannedActivities,
        deletePlannedActivity,
        updatePlannedActivity,
        universalActivities = [],
        unifiedActivities = []
    } = useData();

    const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<PlannedActivity | null>(null);

    // Keyboard Navigation & ESC handler
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Modal closing
            if (e.key === 'Escape' && isModalOpen) {
                setIsModalOpen(false);
                setEditingActivity(null);
                return;
            }

            // Week Navigation with Ctrl + Arrow
            if (e.ctrlKey && !isModalOpen) {
                if (e.key === 'ArrowLeft') {
                    handleWeekChange(-1);
                } else if (e.key === 'ArrowRight') {
                    handleWeekChange(1);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, currentWeekStart]);

    // Navigation
    const handleWeekChange = (offset: number) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + (offset * 7));
        setCurrentWeekStart(getISODate(d));
    };

    // Get dates for current week
    const weekDates = useMemo(() => {
        const dates: { date: string, weekday: Weekday, label: string }[] = [];
        const start = new Date(currentWeekStart);
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const iso = getISODate(d);
            dates.push({
                date: iso,
                weekday: WEEKDAYS[i],
                label: SHORT_WEEKDAYS[i]
            });
        }
        return dates;
    }, [currentWeekStart]);

    // Helper for calculating weekly stats
    const calculateWeeklyStats = (start: string) => {
        const weekStart = new Date(start);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const startStr = getISODate(weekStart);
        const endStr = getISODate(weekEnd);

        // All completed sessions from unifiedActivities
        const weekCompleted = unifiedActivities.filter((a: any) => a.date >= startStr && a.date <= endStr);

        // Running stats (Running + any other cardio that isn't strength)
        const runningActivities = weekCompleted.filter((a: any) => a.type === 'running' || ['cycling', 'walking', 'swimming'].includes(a.type));
        const runningSessions = runningActivities.length;
        const runningKm = runningActivities.reduce((sum: number, a: any) => sum + (a.distance || 0), 0);
        const runningTime = runningActivities.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);

        // Strength stats 
        const strengthActivities = weekCompleted.filter((a: any) => a.type === 'strength');
        const strengthSessionCount = strengthActivities.length;
        const strengthTime = strengthActivities.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);
        const strengthTonnage = strengthActivities.reduce((sum: number, a: any) => sum + (a.tonnage || 0), 0);

        // Forecast from planned activities
        const plannedThisWeek = plannedActivities.filter((p: any) =>
            p.date >= startStr && p.date <= endStr && p.status === 'PLANNED'
        );
        const plannedRunning = plannedThisWeek.filter((p: any) =>
            p.title?.toLowerCase().includes('löpning') ||
            p.category === 'EASY' || p.category === 'INTERVALS' || p.category === 'TEMPO' ||
            p.category === 'LONG_RUN' || p.category === 'RECOVERY'
        );
        const plannedStrength = plannedThisWeek.filter((p: any) =>
            p.title?.toLowerCase().includes('styrka') || p.category === 'STRENGTH'
        );

        const forecastRunningSessions = runningSessions + plannedRunning.length;
        const forecastRunningKm = runningKm + plannedRunning.reduce((sum: number, p: any) => sum + (p.estimatedDistance || 0), 0);
        const forecastStrengthSessions = strengthSessionCount + plannedStrength.length;

        return {
            running: {
                sessions: runningSessions,
                km: runningKm,
                time: runningTime
            },
            strength: {
                sessions: strengthSessionCount,
                time: strengthTime,
                tonnage: strengthTonnage
            },
            forecast: {
                runningSessions: forecastRunningSessions,
                runningKm: forecastRunningKm,
                strengthSessions: forecastStrengthSessions
            }
        };
    };

    const weeklyStats = useMemo(() => calculateWeeklyStats(currentWeekStart), [currentWeekStart, unifiedActivities, plannedActivities]);

    const lastWeeklyStats = useMemo(() => {
        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        return calculateWeeklyStats(getISODate(lastWeekStart));
    }, [currentWeekStart, unifiedActivities, plannedActivities]);

    // Goal progress for sessions/km per week
    const goalProgress = useMemo(() => {
        const activeGoals = performanceGoals.filter(g => g.status === 'active');

        // Find session goals - distinguish between styrka and total/löpning
        const sessionGoals = activeGoals.filter(g =>
            g.targets?.some(t => t.unit === 'sessions' || t.unit?.toLowerCase().includes('pass'))
        );

        const strengthSessionGoal = sessionGoals.find(g =>
            g.name.toLowerCase().includes('styrka') || g.type === 'tonnage'
        );

        const totalSessionGoal = sessionGoals.find(g =>
            !g.name.toLowerCase().includes('styrka') && g.type !== 'tonnage'
        );

        // Find km goal (unit === 'km' or name contains km)
        const kmGoal = activeGoals.find(g =>
            g.targets?.some(t => t.unit === 'km') || g.name.toLowerCase().includes('km')
        );

        const strengthSessionsCount = weeklyStats.strength.sessions;
        const totalSessions = weeklyStats.running.sessions + strengthSessionsCount;
        const currentKm = weeklyStats.running.km;

        // Helper to extract target value
        const getTargetValue = (goal: any, unit: string) => {
             return goal.targets?.find((t: any) => t.unit === unit || t.unit?.toLowerCase().includes(unit === 'sessions' ? 'pass' : unit))?.count ||
                    goal.targets?.find((t: any) => t.unit === unit || t.unit?.toLowerCase().includes(unit === 'sessions' ? 'pass' : unit))?.value || 0;
        };

        const strengthTarget = strengthSessionGoal ? getTargetValue(strengthSessionGoal, 'sessions') : 0;
        const totalTarget = totalSessionGoal ? getTargetValue(totalSessionGoal, 'sessions') : 0;
        const kmTarget = kmGoal ? getTargetValue(kmGoal, 'km') : 0;

        // Calculate "Planned but not done"
        // This is: Forecast - Actual. If negative, 0.
        const strengthPlanned = Math.max(0, weeklyStats.forecast.strengthSessions - weeklyStats.strength.sessions);
        const totalPlanned = Math.max(0, (weeklyStats.forecast.runningSessions + weeklyStats.forecast.strengthSessions) - (weeklyStats.running.sessions + weeklyStats.strength.sessions));
        const kmPlanned = Math.max(0, weeklyStats.forecast.runningKm - weeklyStats.running.km);

        return {
            strengthSessions: strengthSessionGoal ? {
                target: strengthTarget,
                current: strengthSessionsCount,
                planned: strengthPlanned,
                name: 'Styrkepass'
            } : null,
            totalSessions: totalSessionGoal ? {
                target: totalTarget,
                current: totalSessions,
                planned: totalPlanned,
                name: totalSessionGoal.name
            } : null,
            km: kmGoal ? {
                target: kmTarget,
                current: currentKm,
                planned: kmPlanned,
                name: 'Distans'
            } : null
        };
    }, [performanceGoals, weeklyStats]);

    // Handlers
    const handleOpenModal = (date: string, activity?: PlannedActivity) => {
        setSelectedDate(date);
        setEditingActivity(activity || null);
        setIsModalOpen(true);
    };

    const handleSaveActivity = (activity: PlannedActivity) => {
        if (editingActivity) {
            updatePlannedActivity(editingActivity.id, activity);
        } else {
            savePlannedActivities([activity]);
        }
        setIsModalOpen(false);
        setEditingActivity(null);
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-900 dark:text-white">
            <div className="max-w-6xl mx-auto mb-6">
                <TrainingPeriodBanner />
            </div>

            {/* Header */}
            <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter">Planera Träning</h1>
                        <p className="text-sm text-slate-500 font-medium">Vecka {getWeekNumber(currentWeekStart)}</p>
                    </div>
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-slate-200 dark:border-slate-800">
                    <button onClick={() => handleWeekChange(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-4 text-sm font-bold flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        {currentWeekStart}
                    </div>
                    <button onClick={() => handleWeekChange(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Weekly Summary & Goals Widget */}
            <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 0. Föregående Vecka (Historical) */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm opacity-80">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={16} className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Föregående Vecka</span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">🏃 Löpning</div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-400">
                                {lastWeeklyStats.running.sessions} pass | {lastWeeklyStats.running.km.toFixed(1)} km | {formatDuration(lastWeeklyStats.running.time * 60)}
                            </div>
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-800/50 pt-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">💪 Styrka</div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-400">
                                {lastWeeklyStats.strength.sessions} pass | {(lastWeeklyStats.strength.tonnage / 1000).toFixed(1)}t | {formatDuration(lastWeeklyStats.strength.time * 60)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 1. Denna Vecka (Actuals) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Denna Vecka</span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">🏃 Löpning</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {weeklyStats.running.sessions} pass | {weeklyStats.running.km.toFixed(1)} km | {formatDuration(weeklyStats.running.time * 60)}
                            </div>
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">💪 Styrka</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {weeklyStats.strength.sessions} pass | {(weeklyStats.strength.tonnage / 1000).toFixed(1)}t | {formatDuration(weeklyStats.strength.time * 60)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Veckomål (Goals) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Target size={16} className="text-indigo-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Veckomål</span>
                    </div>
                    {(!goalProgress.strengthSessions && !goalProgress.totalSessions && !goalProgress.km) ? (
                        <p className="text-xs text-slate-400 italic">Inga aktiva veckomål.</p>
                    ) : (
                        <div className="space-y-4">
                            {/* Reusable Progress Bar Component */}
                            {[
                                goalProgress.strengthSessions && { ...goalProgress.strengthSessions, colorClass: 'bg-purple-500', plannedClass: 'bg-purple-500/30' },
                                goalProgress.totalSessions && { ...goalProgress.totalSessions, colorClass: 'bg-indigo-500', plannedClass: 'bg-indigo-500/30' },
                                goalProgress.km && { ...goalProgress.km, colorClass: 'bg-emerald-500', plannedClass: 'bg-emerald-500/30' }
                            ].filter(Boolean).map((goal: any, i) => {
                                const currentPct = Math.min(100, (goal.current / goal.target) * 100);
                                const plannedPct = Math.min(100 - currentPct, (goal.planned / goal.target) * 100);
                                const isMet = goal.current >= goal.target;

                                return (
                                    <div key={i}>
                                        <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                            <span className="text-slate-400">{goal.name}</span>
                                            <span className={isMet ? 'text-emerald-500' : 'text-slate-500'}>
                                                {typeof goal.current === 'number' && !Number.isInteger(goal.current) ? goal.current.toFixed(1) : goal.current}
                                                <span className="text-slate-300 mx-1">/</span>
                                                {goal.target}
                                                {goal.planned > 0 && !isMet && (
                                                    <span className="text-slate-400 ml-1 italic">(+{typeof goal.planned === 'number' && !Number.isInteger(goal.planned) ? goal.planned.toFixed(1) : goal.planned})</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                            {/* Completed Segment (Solid) */}
                                            <div
                                                className={`h-full transition-all ${isMet ? 'bg-emerald-500' : goal.colorClass}`}
                                                style={{ width: `${currentPct}%` }}
                                            />
                                            {/* Planned Segment (Striped/Dashed) */}
                                            {plannedPct > 0 && (
                                                <div
                                                    className={`h-full transition-all ${goal.plannedClass}`}
                                                    style={{
                                                        width: `${plannedPct}%`,
                                                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)'
                                                     }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 3. Prognos (Forecast) */}
                <div className="bg-emerald-50/50 dark:bg-emerald-900/5 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={16} className="text-amber-500 fill-amber-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Prognos</span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Löpning Totalt</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {weeklyStats.forecast.runningSessions} pass | {weeklyStats.forecast.runningKm.toFixed(1)} km
                            </div>
                        </div>
                        <div className="border-t border-emerald-100/50 dark:border-emerald-800/30 pt-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Styrka Totalt</div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">
                                {weeklyStats.forecast.strengthSessions} pass
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-7 gap-4">
                {weekDates.map((day) => {
                    const dayActivities = plannedActivities.filter(a => a.date === day.date && a.status !== 'COMPLETED');

                    // Filter completed activities from ALL sources
                    const dayRunningActivities = universalActivities.filter(a =>
                        a.date === day.date &&
                        a.performance?.activityType === 'running'
                    );

                    const dayStrengthSessions = strengthSessions.filter(s => s.date === day.date);

                    // Day summary calculation
                    const daySessions = dayRunningActivities.length + dayStrengthSessions.length;
                    const dayKm = dayRunningActivities.reduce((sum, a) => sum + (a.performance?.distanceKm || 0), 0);
                    const dayTime = (dayRunningActivities.reduce((sum, a) => sum + (a.performance?.durationMinutes || 0), 0) +
                        dayStrengthSessions.reduce((sum, s) => sum + (s.duration || 0), 0));

                    const isToday = day.date === getISODate();
                    const isPast = day.date < getISODate();

                    return (
                        <div key={day.date} className={`flex flex-col h-[400px] bg-white dark:bg-slate-900 rounded-2xl border ${isToday ? 'border-emerald-500 ring-1 ring-emerald-500/50' : (isPast ? 'border-slate-100 dark:border-slate-800/50 opacity-90' : 'border-slate-200 dark:border-slate-800')} relative group shadow-sm`}>
                            {/* Background Date */}
                            <div className="absolute bottom-4 right-4 text-7xl font-black text-slate-100 dark:text-slate-800/20 select-none z-0 pointer-events-none">
                                {day.date.split('-')[2]}
                            </div>

                            {/* Header */}
                            <div className={`p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1 ${isToday ? 'bg-emerald-500/10 dark:bg-emerald-500/5' : (isPast ? 'bg-slate-50/20 dark:bg-slate-900/50' : 'bg-slate-50/50 dark:bg-slate-800/50')} rounded-t-2xl z-10 relative pointer-events-none`}>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">{day.label}</span>
                                    <span className={`text-xs font-bold ${isToday ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {day.date.split('-')[2]}
                                    </span>
                                </div>
                                {(daySessions > 0 || dayKm > 0 || dayTime > 0) && (
                                    <div className="text-[9px] font-black text-slate-400 flex items-center gap-1.5">
                                        {dayKm > 0 && <span>🏃 {dayKm.toFixed(1)} km</span>}
                                        {dayTime > 0 && <span>⏱️ {formatDuration(dayTime * 60)}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Activities */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                                {/* Running / Cardio Activities (from universalActivities) */}
                                {dayRunningActivities.map((act) => (
                                    <div
                                        key={`run-${act.id}`}
                                        onClick={() => navigate(`/logg?activityId=${act.id}`)}
                                        className="p-3 bg-emerald-500/10 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl relative cursor-pointer hover:bg-emerald-500/20 transition-colors z-10"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1">
                                                <Check size={10} />
                                                Löpning
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight">
                                            {act.performance?.distanceKm ? `${act.performance.distanceKm.toFixed(1)} km` : ''}
                                            {act.performance?.durationMinutes ? ` ${Math.round(act.performance.durationMinutes)} min` : ''}
                                        </p>
                                    </div>
                                ))}

                                {/* Strength Sessions (separate from exerciseEntries) */}
                                {dayStrengthSessions.map(session => (
                                    <div
                                        key={`str-${session.id}`}
                                        onClick={() => navigate(`/logg?activityId=${session.id}`)}
                                        className="p-3 bg-purple-500/10 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl relative cursor-pointer hover:bg-purple-500/20 transition-colors z-10"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1">
                                                <Dumbbell size={10} />
                                                Styrka
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight">
                                            {session.name || `${session.uniqueExercises} övningar`}
                                        </p>
                                        <p className="text-[10px] text-slate-500 mt-1">
                                            {(session.totalVolume / 1000).toFixed(1)}t • {Math.round(session.duration || 0)} min
                                        </p>
                                    </div>
                                ))}

                                {/* Planned Activities - Clickable for edit */}
                                {dayActivities.map(act => (
                                    <div
                                        key={act.id}
                                        onClick={() => handleOpenModal(day.date, act)}
                                        className={`p-3 border rounded-xl group/card relative hover:shadow-md transition-all cursor-pointer z-10 ${act.type === 'REST' || act.category === 'REST'
                                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                                            : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-wider ${act.type === 'REST' || act.category === 'REST' ? 'text-slate-500' : 'text-blue-600 dark:text-blue-400'
                                                }`}>
                                                {act.type === 'REST' || act.category === 'REST' ? '💤 Vila' : (act.type === 'STRENGTH' || act.category === 'STRENGTH' ? '💪' : '📅') + ' ' + act.title}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deletePlannedActivity(act.id); }}
                                                className="text-slate-400 hover:text-rose-500 opacity-0 group-hover/card:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight">
                                            {act.description}
                                        </p>
                                        {(act.estimatedDistance || 0) > 0 && (
                                            <div className="mt-2 text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                <Activity size={10} />
                                                {act.estimatedDistance} km
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    onClick={() => {
                                        if (isPast) {
                                            navigate(`?registerDate=${day.date}&registerInput=löpning`);
                                        } else {
                                            handleOpenModal(day.date);
                                        }
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex flex-col items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <Plus size={20} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">
                                        {isPast ? 'Registrera' : 'Planera'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <ActivityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                selectedDate={selectedDate}
                editingActivity={editingActivity}
                onSave={handleSaveActivity}
                weeklyStats={weeklyStats}
                goalProgress={goalProgress}
            />

            {/* Deep Stats Analysis */}
            <WeeklyStatsAnalysis
                weekStart={currentWeekStart}
                weeklyStats={weeklyStats}
            />

        </div>
    );
}

function getWeekNumber(dateStr: string): number {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
