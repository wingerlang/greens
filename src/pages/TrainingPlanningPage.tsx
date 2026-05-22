import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { analyzeInterference } from '../utils/interferenceEngine.ts';
import { getTrainingSuggestions, TrainingSuggestion } from '../utils/trainingSuggestions.ts';
import {
    PlannedActivity,
    generateId,
    getISODate,
    getWeekStartDate,
    WEEKDAYS,
    Weekday
} from '../models/types.ts';
import { ChevronLeft, ChevronRight, ChevronDown as LucideChevronDown, ChevronUp as LucideChevronUp, Flame, Scale, HeartPulse, Calendar, Plus, Dumbbell, Activity, Zap, X, Check, Target, TrendingUp, Clock, Trophy, AlertTriangle, RefreshCcw, MinusCircle, Heart, Copy, Trash2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { formatDuration, formatPace } from '../utils/dateUtils.ts';
import { calculatePerformanceScore } from '../utils/performanceEngine.ts';
import { getPlannedRaceTime, calcPace } from '../components/training/races/utils.ts';
import { TrainingPeriodBanner } from '../components/planning/TrainingPeriodBanner.tsx';
import { notificationService } from '../services/notificationService.ts';
import { ActivityModal } from '../components/planning/ActivityModal.tsx';
import { WeeklyStatsAnalysis } from '../components/planning/WeeklyStatsAnalysis.tsx';
import { TrainingTabs } from '../components/training/TrainingTabs.tsx';
import { isWarmupOrCooldown, isCompetition as isComp, isRecovery } from '../utils/activityUtils.ts';

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
        deleteExercise,
        deleteStrengthSession,
        updateExercise,
        universalActivities = [],
        unifiedActivities: rawUnifiedActivities = [],
        currentUser,
        reorderActivity,
        reconciliation,
        isLoading
    } = useData();

    const unifiedActivities = React.useMemo(() => {
        return rawUnifiedActivities.filter((a: any) => !a.extractedFromId);
    }, [rawUnifiedActivities]);

    const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<PlannedActivity | null>(null);
    const [draggedOverDate, setDraggedOverDate] = useState<string | null>(null);
    const [swappingActivityId, setSwappingActivityId] = useState<string | null>(null);
    const [movingActivityId, setMovingActivityId] = useState<string | null>(null);
    const [ctrlHeld, setCtrlHeld] = useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) setCtrlHeld(true); };
        const handleKeyUp = (e: KeyboardEvent) => { if (!e.ctrlKey && !e.metaKey) setCtrlHeld(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    const handleDuplicate = (act: PlannedActivity) => {
        const newAct: PlannedActivity = {
            ...act,
            id: generateId(),
            status: 'PLANNED',
            autoMatchDisabled: true,
            reconciliation: undefined,
            externalId: undefined,
            completedDate: undefined,
            order: (act.order ?? 0) + 1
        };
        savePlannedActivities([newAct]);
        notificationService.notify('success', 'Aktivitet kopierad!');
    };

    const handleMoveToDate = (id: string, newDate: string) => {
        const act = plannedActivities.find(a => a.id === id);
        if (act) {
            updatePlannedActivity(id, { date: newDate, autoMatchDisabled: true });
            notificationService.notify('success', `Passet flyttat till ${newDate}`);
        } else {
            // Check if it's a logged activity
            updateExercise(id, { date: newDate });
            notificationService.notify('success', `Loggat pass flyttat till ${newDate}`);
        }
        setMovingActivityId(null);
    };

    const handleDelete = (event: { type: 'planned' | 'actual', id: string, data: any }) => {
        if (!confirm('Är du säker på att du vill ta bort passet?')) return;
        
        if (event.type === 'planned') {
            deletePlannedActivity(event.id);
        } else if (event.data.type === 'strength') {
            deleteStrengthSession(event.id);
        } else {
            deleteExercise(event.id);
        }
        notificationService.notify('info', 'Passet har tagits bort.');
    };

    const handleMoveAllToNextWeek = () => {
        const start = new Date(currentWeekStart);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const endStr = end.toISOString().split('T')[0];

        const activitiesToMove = plannedActivities.filter(a => 
            a.date >= currentWeekStart && 
            a.date <= endStr && 
            a.status === 'PLANNED'
        );

        if (activitiesToMove.length === 0) {
            notificationService.notify('info', 'Inga planerade pass att flytta denna vecka.');
            return;
        }

        const updated = activitiesToMove.map(a => {
            const date = new Date(a.date);
            date.setDate(date.getDate() + 7);
            return {
                ...a,
                date: date.toISOString().split('T')[0],
                autoMatchDisabled: true
            };
        });

        savePlannedActivities(updated);
        notificationService.notify('success', `${activitiesToMove.length} pass flyttade till nästa vecka!`);
    };

    const handleSwapActivities = (targetId: string) => {
        if (!swappingActivityId || swappingActivityId === targetId) {
            setSwappingActivityId(null);
            return;
        }

        const source = plannedActivities.find(a => a.id === swappingActivityId);
        const target = plannedActivities.find(a => a.id === targetId);

        if (source && target) {
            const sourceDate = source.date;
            const targetDate = target.date;

            // Helper to reset reconciliation if date or status needs fixing
            const processUpdate = (act: PlannedActivity, newDate: string): PlannedActivity => {
                const isDateChanged = act.date !== newDate;
                const updated = { ...act, date: newDate };
                if (isDateChanged) {
                    updated.autoMatchDisabled = true; // Disable auto-reconciliation when manually moved
                }
                if (act.status === 'COMPLETED' || act.reconciliation || act.externalId) {
                    updated.status = 'PLANNED';
                    updated.reconciliation = undefined; // Use undefined instead of null for consistency with types
                    updated.externalId = undefined;
                    updated.completedDate = undefined;
                    updated.actualDistance = undefined;
                    updated.actualTimeSeconds = undefined;
                }
                return updated;
            };

            const updatedSource = processUpdate(source, targetDate);
            const updatedTarget = processUpdate(target, sourceDate);

            // Use bulk update to ensure atomicity and avoid multiple re-renders/saves
            savePlannedActivities([updatedSource, updatedTarget]);

            notificationService.notify('success', 'Passen har bytt plats och nollställts!');
        }
        setSwappingActivityId(null);
    };

    // Keyboard Navigation & ESC handler
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Modal closing
            if (e.key === 'Escape' && isModalOpen) {
                delete (window as any)._pendingRacesActivities;
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

            if (e.key === 'Escape' && swappingActivityId) {
                setSwappingActivityId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, currentWeekStart, swappingActivityId]);

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
        const weekCompleted = unifiedActivities.filter((a: any) => {
            const d = a.date.split('T')[0];
            return d >= startStr && d <= endStr;
        });

        // Running stats
        const runningActivities = weekCompleted.filter((a: any) => a.type === 'running');
        const mainRuns = runningActivities.filter((a: any) => !isWarmupOrCooldown(a));
        const warmupCooldowns = runningActivities.filter((a: any) => isWarmupOrCooldown(a));
        const runningSessions = mainRuns.length;
        const warmupSessions = warmupCooldowns.length;
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
            p.type === 'RUN' ||
            p.category === 'EASY' || p.category === 'INTERVALS' || p.category === 'TEMPO' ||
            p.category === 'LONG_RUN' || p.category === 'RECOVERY' || p.category === 'RACE' || p.isRace
        );
        const plannedStrength = plannedThisWeek.filter((p: any) =>
            p.title?.toLowerCase().includes('styrka') || p.category === 'STRENGTH'
        );

        // Other Cardio stats (not running or strength)
        const otherActivities = weekCompleted.filter((a: any) => a.type !== 'running' && a.type !== 'strength' && a.type !== 'REST' && a.type !== 'rest');
        const otherSessions = otherActivities.length;
        const otherTime = otherActivities.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);


        const plannedOther = plannedThisWeek.filter((p: any) =>
            !plannedRunning.includes(p) && !plannedStrength.includes(p) && p.type !== 'REST' && p.category !== 'REST'
        );

        const forecastRunningSessions = runningSessions + plannedRunning.length;
        const forecastRunningKm = runningKm + plannedRunning.reduce((sum: number, p: any) => sum + (p.estimatedDistance || 0), 0);
        const forecastStrengthSessions = strengthSessionCount + plannedStrength.length;
        const forecastOtherSessions = otherSessions + plannedOther.length;

        // Get planned duration: use durationMinutes field first, fall back to race estimation or description parsing
        const getPlannedMinutes = (p: any): number => {
            // 1. New Central Logic (handles races etc)
            const resolved = getPlannedRaceTime(p);
            if (resolved) return resolved;

            // 2. Parse "(HH:MM)" from description
            const hhmmMatch = p.description?.match(/\((\d{1,2}):(\d{2})\)/);
            if (hhmmMatch) return parseInt(hhmmMatch[1]) * 60 + parseInt(hhmmMatch[2]);

            // 3. Parse "XXmin" or "XX min" from description
            const minMatch = p.description?.match(/(\d+)\s*min/i);
            if (minMatch) return parseInt(minMatch[1]);
            // 4. Final Fallback: Use 5:30 min/km for runs/races with distance but no duration
            if (p.estimatedDistance > 0 && (p.type === 'RUN' || p.isRace || p.category === 'RACE')) {
                return p.estimatedDistance * 5.5;
            }

            return 0;
        };

        // Total completed training time (all types)
        const completedTotalTime = runningTime + strengthTime + otherTime;

        // Planned time per category
        const plannedRunningTime = plannedRunning.reduce((sum: number, p: any) => sum + getPlannedMinutes(p), 0);
        const plannedStrengthTime = plannedStrength.reduce((sum: number, p: any) => sum + getPlannedMinutes(p), 0);
        const plannedOtherTime = plannedOther.reduce((sum: number, p: any) => sum + getPlannedMinutes(p), 0);

        // Total planned training time for remaining planned activities
        const plannedTotalTime = plannedThisWeek
            .filter((p: any) => p.type !== 'REST' && p.category !== 'REST')
            .reduce((sum: number, p: any) => sum + getPlannedMinutes(p), 0);

        // Forecast = completed + planned
        const forecastTotalTime = completedTotalTime + plannedTotalTime;
        const forecastRunningTime = runningTime + plannedRunningTime;
        const forecastStrengthTime = strengthTime + plannedStrengthTime;
        const forecastOtherTime = otherTime + plannedOtherTime;

        // Average HR and Pace
        const runningWithHr = runningActivities.filter((a: any) => a.heartRateAvg && a.heartRateAvg > 0);
        const avgHr = runningWithHr.length > 0
            ? runningWithHr.reduce((sum: number, a: any) => sum + a.heartRateAvg, 0) / runningWithHr.length
            : 0;
        
        const avgPace = runningKm > 0 ? runningTime / runningKm : 0;

        return {
            running: {
                sessions: runningSessions,
                warmupSessions: warmupSessions,
                km: runningKm,
                time: runningTime,
                avgHr,
                avgPace
            },
            strength: {
                sessions: strengthSessionCount,
                time: strengthTime,
                tonnage: strengthTonnage
            },
            other: {
                sessions: otherSessions,
                time: otherTime
            },
            total: {
                completedTime: completedTotalTime,
                plannedTime: plannedTotalTime,
                forecastTime: forecastTotalTime
            },
            forecast: {
                runningSessions: forecastRunningSessions,
                runningKm: forecastRunningKm,
                runningTime: forecastRunningTime,
                strengthSessions: forecastStrengthSessions,
                strengthTime: forecastStrengthTime,
                otherSessions: forecastOtherSessions,
                otherTime: forecastOtherTime
            }
        };
    };

    const weeklyStats = useMemo(() => calculateWeeklyStats(currentWeekStart), [currentWeekStart, unifiedActivities, plannedActivities]);

    const sortedRaces = useMemo(() => {
        return plannedActivities
            .filter((p: any) => p.isRace || p.title?.toLowerCase().includes('tävling'))
            .sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [plannedActivities]);

    const getDaysBetween = (d1: string, d2: string) => {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
    };

    const lastWeeklyStats = useMemo(() => {
        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        return calculateWeeklyStats(getISODate(lastWeekStart));
    }, [currentWeekStart, unifiedActivities, plannedActivities]);

    const monthWeeklyAvg = useMemo(() => {
        const now = new Date(currentWeekStart);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const monthActivities = unifiedActivities.filter(a => {
            const d = a.date.split('T')[0];
            return d >= getISODate(startOfMonth) && d <= getISODate(endOfMonth) && a.type === 'running';
        });

        const totalKm = monthActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
        
        const daysInMonth = endOfMonth.getDate();
        const elapsedDays = now.getMonth() === new Date().getMonth() ? new Date().getDate() : daysInMonth;
        const weeks = elapsedDays / 7;
        
        return weeks > 0 ? totalKm / weeks : 0;
    }, [currentWeekStart, unifiedActivities]);

    // Interference Analysis
    const weeklyWarnings = useMemo(() => {
        const startStr = getISODate(new Date(currentWeekStart));
        const end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 6);
        const endStr = getISODate(end);

        const relevantHistory = unifiedActivities
            .filter((a: any) => {
                const d = a.date.split('T')[0];
                return d >= startStr && d <= endStr;
            })
            .map((a: any) => ({ ...a, _source: 'HISTORY', _id: a.id }));

        const relevantPlan = plannedActivities
            .filter(a => a.date >= startStr && a.date <= endStr && a.status === 'PLANNED')
            .map(a => ({ ...a, _source: 'PLAN', _id: a.id }));

        const all = [...relevantHistory, ...relevantPlan];

        // DEBUG: Log warning computation
        console.log('[Interference] Analyzing', all.length, 'activities:', all.map(a => ({
            date: a.date,
            type: a.type,
            title: a.title,
            category: a.category,
            hyroxFocus: a.hyroxFocus,
            source: a._source
        })));

        const warnings = analyzeInterference(all);
        console.log('[Interference] Generated warnings:', warnings);

        return warnings;
    }, [currentWeekStart, unifiedActivities, plannedActivities]);

    // Unified Goal Progress Logic
    const goalProgress = useMemo(() => {
        return performanceGoals
            .filter(g => g.status === 'active')
            .map(goal => {
                let current = 0;
                let planned = 0;
                let target = 0;
                let unitLabel = '';

                // Extract Target
                const kmTarget = goal.targets?.find(t => t.unit === 'km')?.value;
                const sessionTarget = goal.targets?.find(t => ['sessions', 'pass', 'x/v'].some(u => t.unit?.toLowerCase().includes(u)))?.value
                    || goal.targets?.find(t => ['sessions', 'pass', 'x/v'].some(u => t.unit?.toLowerCase().includes(u)))?.count;
                const tonTarget = goal.targets?.find(t => t.unit === 'ton')?.value;

                if (kmTarget) {
                    target = kmTarget;
                    current = weeklyStats.running.km;
                    planned = Math.max(0, weeklyStats.forecast.runningKm - current);
                    unitLabel = 'km';
                } else if (tonTarget) {
                    target = tonTarget;
                    current = weeklyStats.strength.tonnage / 1000;
                    planned = 0;
                    unitLabel = 'ton';
                } else if (sessionTarget) {
                    target = sessionTarget;
                    const isStrength = goal.name.toLowerCase().includes('styrka') || goal.name.toLowerCase().includes('strength');
                    const isRunning = goal.name.toLowerCase().includes('löpning') || goal.name.toLowerCase().includes('run');

                    if (isStrength) {
                        current = weeklyStats.strength.sessions;
                        planned = Math.max(0, weeklyStats.forecast.strengthSessions - current);
                    } else if (isRunning) {
                        current = weeklyStats.running.sessions;
                        planned = Math.max(0, weeklyStats.forecast.runningSessions - current);
                    } else {
                        current = weeklyStats.running.sessions + weeklyStats.strength.sessions;
                        const forecastTotal = weeklyStats.forecast.runningSessions + weeklyStats.forecast.strengthSessions;
                        planned = Math.max(0, forecastTotal - current);
                    }
                    unitLabel = 'pass';
                }

                const isStrength = goal.name.toLowerCase().includes('styrka');
                const isRunning = goal.name.toLowerCase().includes('löpning') || kmTarget;
                const colorClass = isStrength ? 'bg-purple-500' : (isRunning ? 'bg-emerald-500' : 'bg-indigo-500');
                const plannedClass = isStrength ? 'bg-purple-500/30' : (isRunning ? 'bg-emerald-500/30' : 'bg-indigo-500/30');

                return {
                    id: goal.id,
                    name: goal.name,
                    target,
                    current,
                    planned,
                    unit: unitLabel,
                    isMet: current >= target,
                    isProjectedMet: (current + planned) >= target,
                    colorClass,
                    plannedClass
                };
            })
            .filter(g => g.target > 0);
    }, [performanceGoals, weeklyStats]);

    // Handlers
    const handleOpenModal = (date: string, activity?: PlannedActivity) => {
        setSelectedDate(date);
        setEditingActivity(activity || null);
        setIsModalOpen(true);
    };

    const handleSaveActivity = (activity: PlannedActivity) => {
        const pending = (window as any)._pendingRacesActivities || [];
        if (editingActivity) {
            updatePlannedActivity(editingActivity.id, activity);
            if (pending.length > 0) {
                savePlannedActivities(pending);
            }
            notificationService.notify('success', 'Aktiviteten uppdaterad!');
        } else {
            savePlannedActivities([activity, ...pending]);
            notificationService.notify('success', 'Ny aktivitet sparad!');
        }
        delete (window as any)._pendingRacesActivities;
        setIsModalOpen(false);
        setEditingActivity(null);
    };

    const formatDurationHHMM = (minutes: number) => {
        if (!minutes) return '00:00';
        const totalMinutes = Math.round(minutes);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const updateUrlParams = (params: Record<string, string>) => {
        const searchParams = new URLSearchParams(window.location.search);
        Object.entries(params).forEach(([key, value]) => {
            searchParams.set(key, value);
        });
        navigate('?' + searchParams.toString(), { replace: true });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500 animate-pulse">Laddar Träningsplanering...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 font-sans text-slate-900 dark:text-white pb-8">
            <TrainingTabs currentTab="planera" />
            <div className="p-1 md:p-1.5 lg:p-2 pt-2 lg:pt-4">


                <div className="max-w-full mx-auto flex items-center justify-between mb-8">
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

            <div className="max-w-full mx-auto mb-6 grid grid-cols-1 md:grid-cols-3 lg:gap-3 gap-2">
                {/* 0. Föregående Vecka (Historical) */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm opacity-80">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={16} className="text-slate-400" />
                        <span className="text-sm font-black uppercase tracking-wider text-slate-500">Föregående Vecka</span>
                    </div>
                    <div className="flex items-start gap-4 overflow-x-auto pb-1 scrollbar-none">
                        <div className="flex flex-col flex-1 min-w-[70px]">
                            <div className="text-xs font-black uppercase text-slate-400 mb-1 whitespace-nowrap">🏃 Löpning</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                                    {lastWeeklyStats.running.km.toFixed(1)}
                                    <span className="text-base font-bold text-slate-400 ml-1">km</span>
                                </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase flex flex-col gap-0.5 mt-1">
                                <div className="flex items-center gap-1">
                                    <Clock size={10} /> 
                                    {lastWeeklyStats.running.sessions}
                                    {lastWeeklyStats.running.warmupSessions > 0 && `+${lastWeeklyStats.running.warmupSessions}`}
                                    {' pass'}
                                </div>
                                {lastWeeklyStats.running.avgPace > 0 && <div className="flex items-center gap-1"><Zap size={10} className="text-amber-500" /> {formatPace(lastWeeklyStats.running.avgPace * 60)}</div>}
                                {lastWeeklyStats.running.avgHr > 0 && <div className="flex items-center gap-1"><Heart size={10} className="text-rose-500" /> {Math.round(lastWeeklyStats.running.avgHr)} bpm</div>}
                            </div>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-700 self-stretch shrink-0"></div>
                        <div className="flex flex-col flex-1 min-w-[70px]">
                            <div className="text-xs font-black uppercase text-slate-400 mb-1 whitespace-nowrap">💪 Styrka</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                                    {lastWeeklyStats.strength.sessions}
                                    <span className="text-base font-bold text-slate-400 ml-1">pass</span>
                                </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                                <div className="flex items-center gap-1"><Dumbbell size={10} /> {(lastWeeklyStats.strength.tonnage / 1000).toFixed(1)} ton</div>
                            </div>
                        </div>
                        <div className="w-px bg-slate-200 dark:bg-slate-700 self-stretch shrink-0"></div>
                        <div className="flex flex-col flex-1 min-w-[70px]">
                            <div className="text-xs font-black uppercase text-slate-400 mb-1 whitespace-nowrap">🚴 Cardio</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-700 dark:text-slate-300">
                                    {lastWeeklyStats.other.sessions}
                                    <span className="text-base font-bold text-slate-400 ml-1">pass</span>
                                </span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                                <div className="flex items-center gap-1"><Clock size={10} /> {formatDurationHHMM(lastWeeklyStats.other.time)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400">Total tid</span>
                        <span className="text-sm font-black text-slate-600 dark:text-slate-400">{formatDurationHHMM(lastWeeklyStats.total.completedTime)}</span>
                    </div>

                </div>

                {/* 1. Denna Vecka (Actuals vs Planned) */}
                <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 lg:p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <span className="text-sm font-black uppercase tracking-wider text-slate-500">Denna Vecka</span>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="flex flex-col flex-1">
                            <div className="text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Zap size={12} className="text-amber-500" /> Löpning</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">
                                    {weeklyStats.running.km.toFixed(1)}
                                    <span className="text-sm font-bold text-slate-400 ml-1">/ {weeklyStats.forecast.runningKm.toFixed(1)} km</span>
                                </span>
                            </div>
                            <div className="text-sm font-medium text-slate-500 flex items-center gap-2 flex-wrap">
                                <span>
                                    {weeklyStats.running.sessions}
                                    {weeklyStats.running.warmupSessions > 0 && `+${weeklyStats.running.warmupSessions}`}
                                    {` (${weeklyStats.forecast.runningSessions}) pass`}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Snitt: {monthWeeklyAvg.toFixed(1)} km/v</span>
                            </div>
                        </div>
                        <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch"></div>
                        <div className="flex flex-col flex-1">
                            <div className="text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Dumbbell size={12} className="text-purple-500" /> Styrka</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">
                                    {weeklyStats.strength.sessions}
                                    <span className="text-sm font-bold text-slate-400 ml-1">/ {weeklyStats.forecast.strengthSessions} pass</span>
                                </span>
                            </div>
                            <div className="text-sm font-medium text-slate-500">
                                {(weeklyStats.strength.tonnage / 1000).toFixed(1)} ton
                            </div>
                        </div>
                        <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch"></div>
                        <div className="flex flex-col flex-1">
                            <div className="text-xs font-black uppercase text-slate-400 mb-1 flex items-center gap-1.5"><Activity size={12} className="text-cyan-500" /> Cardio</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">
                                    {weeklyStats.other.sessions}
                                    <span className="text-sm font-bold text-slate-400 ml-1">/ {weeklyStats.forecast.otherSessions} pass</span>
                                </span>
                            </div>
                            <div className="text-sm font-medium text-slate-500">
                                {formatDurationHHMM(weeklyStats.other.time)}
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-indigo-500" />
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Total Träningstid</span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-black text-slate-900 dark:text-white">
                                {formatDurationHHMM(weeklyStats.total.completedTime)}
                            </span>
                            {weeklyStats.total.plannedTime > 0 && (
                                <span className="text-sm font-bold text-slate-400">
                                    / {formatDurationHHMM(weeklyStats.total.forecastTime)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="max-w-full mx-auto grid grid-cols-1 md:grid-cols-7 gap-1 lg:gap-1.5">
                {weekDates.map((day) => {
                    const dayPlanned = plannedActivities.filter(a => a.date.split('T')[0] === day.date);
                    const dayActualRaw = unifiedActivities.filter(a => a.date.split('T')[0] === day.date);
                    const matchedActualIds = new Set(dayPlanned.filter(p => p.status === 'COMPLETED' && p.externalId).map(p => p.externalId!));

                    const allEvents = [
                        ...dayPlanned.map(p => ({ type: 'planned' as const, id: p.id, time: p.startTime || (p.status === 'COMPLETED' && p.completedDate?.includes('T') ? p.completedDate.split('T')[1].substring(0, 5) : undefined), data: p })),
                        ...dayActualRaw.filter(a => !matchedActualIds.has(a.id)).map(a => ({ type: 'actual' as const, id: a.id, time: a.date.includes('T') ? a.date.split('T')[1].substring(0, 5) : undefined, data: a }))
                    ].sort((a, b) => {
                        const aData = a.data as any;
                        const bData = b.data as any;
                        const aOrder = aData.order !== undefined ? aData.order : 999;
                        const bOrder = bData.order !== undefined ? bData.order : 999;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        const aIsLogged = a.type === 'actual' || (a.type === 'planned' && aData.status === 'COMPLETED');
                        const bIsLogged = b.type === 'actual' || (b.type === 'planned' && bData.status === 'COMPLETED');
                        if (aIsLogged && !bIsLogged) return -1;
                        if (!aIsLogged && bIsLogged) return 1;
                        const timeA = a.time || '23:59';
                        const timeB = b.time || '23:59';
                        return timeA.localeCompare(timeB);
                    }) as { type: 'planned' | 'actual', id: string, time?: string, data: any }[];

                    const dayKm = dayActualRaw.reduce((sum, a) => sum + (a.distance || 0), 0);
                    const dayTime = dayActualRaw.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
                    const hasRace = dayPlanned.some(p => isComp(p)) || dayActualRaw.some(a => isComp(a));
                    
                    const today = getISODate(new Date());
                    const isToday = day.date === today;
                    const isPast = day.date < today;
                    const dayConflict = weeklyWarnings?.find(w => w.date === day.date);

                    return (
                        <div key={day.date} className={`flex flex-col h-[400px] bg-white dark:bg-slate-900 rounded-2xl border ${dayConflict ? 'border-amber-400 ring-1 ring-amber-400/50' : (isToday ? 'border-emerald-500 ring-1 ring-emerald-500/50' : (isPast ? 'border-slate-100 dark:border-slate-800/50 opacity-90' : 'border-slate-200 dark:border-slate-800'))} relative group shadow-sm transition-all`}>
                            <div className="absolute bottom-4 right-4 text-7xl font-black text-slate-100 dark:text-slate-800/20 select-none z-0 pointer-events-none">{day.date.split('-')[2]}</div>
                            <div className={`p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1 ${dayConflict ? 'bg-amber-500/10 dark:bg-amber-900/20' : (isToday ? 'bg-emerald-500/10 dark:bg-emerald-500/5' : (isPast ? 'bg-slate-50/20 dark:bg-slate-900/50' : 'bg-slate-50/50 dark:bg-slate-800/50'))} rounded-t-2xl z-10 relative`}>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">{day.label}</span>
                                    <div className="flex items-center gap-2">
                                        {dayConflict && (
                                            <div className="relative group/tooltip">
                                                <Link to="/tools/interference" className="pointer-events-auto">
                                                    <AlertTriangle size={14} className="text-amber-500 animate-pulse hover:scale-110 transition-transform" />
                                                </Link>
                                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-[100] border border-white/10">
                                                    <div className="font-black text-amber-400 uppercase mb-1">{dayConflict.message}</div>
                                                    <div className="opacity-80 leading-tight">{dayConflict.suggestion}</div>
                                                </div>
                                            </div>
                                        )}
                                        <span className={`text-xs font-bold ${isToday ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>{day.date.split('-')[2]}</span>
                                    </div>
                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="text-[9px] font-black text-slate-400 flex items-center gap-1.5">
                                                        {(dayKm || 0) > 0 && <span>🏃 {(dayKm || 0).toFixed(1)} km</span>}
                                                        {(dayTime || 0) > 0 && <span>⏱️ {formatDurationHHMM(dayTime || 0)}</span>}
                                                    </div>
                                                    <div className="text-[9px] font-black text-slate-400/70">
                                                        {allEvents.length > 0 && <span>{formatDurationHHMM(allEvents.reduce((sum, e) => sum + (e.data.durationMinutes || 0), 0))} | {allEvents.filter(e => (e.data as any).type !== 'REST' && (e.data as any).category !== 'REST').length} pass</span>}
                                                    </div>
                                                </div>
                            </div>

                            <div 
                                className={`flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar transition-colors ${draggedOverDate === day.date ? 'bg-blue-500/5 ring-2 ring-blue-500/20 rounded-b-2xl' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDraggedOverDate(day.date); }}
                                onDragLeave={() => setDraggedOverDate(null)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setDraggedOverDate(null);
                                    const activityId = e.dataTransfer.getData('activityId');
                                    if (activityId) {
                                        handleMoveToDate(activityId, day.date);
                                    }
                                }}
                            >
                                {allEvents.map((event, index) => {
                                    const isLogged = event.type === 'actual' || (event.type === 'planned' && event.data.status === 'COMPLETED');
                                    const prevEvent = index > 0 ? allEvents[index - 1] : null;
                                    const prevIsLogged = prevEvent ? (prevEvent.type === 'actual' || (prevEvent.type === 'planned' && prevEvent.data.status === 'COMPLETED')) : false;
                                    const showSeparator = index > 0 && !isLogged && prevIsLogged;

                                    if (event.type === 'planned') {
                                        const act = event.data;
                                        const isRace = isComp(act);
                                        const isWarmup = isWarmupOrCooldown(act);
                                        const title = (act.title || '').toLowerCase();
                                        const isTrail = ['trail', 'terräng', 'obanat', 'stig'].some(kw => title.includes(kw));
                                        
                                        // Visual grouping: Find position relative to race on same day
                                        const raceIndex = allEvents.findIndex(e => isComp(e.data));
                                        const isPreRace = isWarmup && raceIndex !== -1 && index === raceIndex - 1;
                                        const isPostRace = isWarmup && raceIndex !== -1 && index === raceIndex + 1;
                                        const isConnected = isPreRace || isPostRace;
                                        
                                        const isCompleted = act.status === 'COMPLETED';
                                        const isSkipped = act.status === 'SKIPPED';
                                        const isChanged = act.status === 'CHANGED';

                                        return (
                                            <>
                                                {showSeparator && <div className="w-full flex items-center justify-center py-1 opacity-60"><div className="w-full border-t-2 border-dashed border-slate-300 dark:border-slate-700"></div></div>}
                                                <div 
                                                    key={act.id}
                                                    draggable={true}
                                                    onDragStart={(e) => { e.dataTransfer.setData('activityId', act.id); e.dataTransfer.effectAllowed = 'move'; }}
                                                    onClick={() => swappingActivityId ? handleSwapActivities(act.id) : handleOpenModal(day.date, act)}
                                                    className={`relative p-2 border rounded-xl hover:shadow-md transition-all cursor-pointer group flex flex-col ${isCompleted ? 'gap-0.5' : 'gap-1.5'} 
                                                        ${isRace ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-900/40 ring-1 ring-amber-400/20 z-10 scale-[1.02] shadow-sm' : 
                                                          (act.type === 'REST' || act.category === 'REST' ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800' :
                                                          (act.type === 'STRENGTH' || act.category === 'STRENGTH' ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30' :
                                                          (act.type === 'HYROX' || act.title?.toLowerCase().includes('hyrox') ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30' :
                                                          'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800')))}
                                                        ${isCompleted ? 'opacity-60 grayscale-[0.3]' : ''} 
                                                        ${isSkipped ? 'opacity-40' : ''}
                                                        ${swappingActivityId === act.id ? 'ring-2 ring-blue-500' : ''}
                                                        ${isPreRace ? 'mb-[-8px] rounded-b-none border-b-0 border-l-2 border-l-amber-400/50 z-0' : ''}
                                                        ${isPostRace ? 'mt-[-8px] rounded-t-none border-t-0 border-l-2 border-l-amber-400/50 z-0' : ''}
                                                    `}
                                                >
                                                    <div className="relative">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-full ${isRace ? 'text-amber-600 dark:text-amber-400' : (act.type === 'REST' || act.category === 'REST' ? 'text-slate-500' : (act.type === 'STRENGTH' || act.category === 'STRENGTH' ? 'text-purple-600 dark:text-purple-400' : (act.type === 'HYROX' || act.title?.toLowerCase().includes('hyrox') ? 'text-indigo-600 dark:text-indigo-400' : (act.type === 'CARDIO' || act.type === 'BIKE' || act.category === 'CARDIO' || act.subType ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'))))}`}>
                                                            <span className="shrink-0">{isCompleted ? <Check size={10} className="text-emerald-500" /> : isRace ? <Trophy size={10} /> : isSkipped ? <MinusCircle size={10} /> : isChanged ? <RefreshCcw size={10} /> : null}</span>
                                                            <span className="leading-tight flex items-center gap-1">
                                                                {(() => {
                                                                    if (isCompleted) return 'GENOMFÖRT';
                                                                    if (isRace) return 'TÄVLING';
                                                                    if (isSkipped) return 'ÖVERHOPPAT';
                                                                    if (isChanged) return 'BYTT PASS';
                                                                    
                                                                    if (act.type === 'REST' || act.category === 'REST') {
                                                                        return <><Moon size={10} className="text-slate-500" /> Vila</>;
                                                                    }
                                                                    
                                                                    const isCardio = act.type === 'CARDIO' || act.type === 'BIKE' || act.category === 'CARDIO' || act.subType;
                                                                    if (isCardio) {
                                                                        const isBike = act.subType === 'cycling' || act.type === 'BIKE';
                                                                        const isFloorball = act.title?.toLowerCase().includes('innebandy');
                                                                        const isCross = act.title?.toLowerCase().includes('cross');
                                                                        return (
                                                                            <span className="flex items-center gap-1">
                                                                                {isBike ? <Bike size={10} /> : (isFloorball ? <Activity size={10} /> : (isCross ? <Activity size={10} /> : <Zap size={10} />))}
                                                                                {act.title}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    
                                                                    if (act.type === 'RUN') {
                                                                        return (
                                                                            <span className="flex items-center gap-1">
                                                                                {isTrail ? <Mountain size={10} /> : <Zap size={10} />}
                                                                                {act.title}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    
                                                                    const isStrength = act.type === 'STRENGTH' || act.category === 'STRENGTH';
                                                                    return (
                                                                        <span className="flex items-center gap-1">
                                                                            {isStrength ? <Dumbbell size={10} /> : <Calendar size={10} />}
                                                                            {act.title}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </span>
                                                        </span>
                                                        <div className="absolute -top-1 -right-1 flex items-center gap-1 p-1 bg-white/90 dark:bg-slate-800/90 rounded-md shadow-sm opacity-0 group-hover/card:opacity-100 transition-opacity z-20 border border-slate-100 dark:border-slate-700">
                                                            <button onClick={(e) => { e.stopPropagation(); setMovingActivityId(movingActivityId === act.id ? null : act.id); }} className={`p-1 transition-colors ${movingActivityId === act.id ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-blue-500'}`} title="Flytta"><Calendar size={12} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); setSwappingActivityId(swappingActivityId === act.id ? null : act.id); }} className={`p-1 transition-colors ${swappingActivityId === act.id ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-blue-500'}`} title="Byt plats"><RefreshCcw size={12} /></button>
                                                            {allEvents.length > 1 && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); reorderActivity(act.id, 'up'); }} className="p-1 text-slate-400 hover:text-blue-500" title="Upp"><LucideChevronUp size={12} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); reorderActivity(act.id, 'down'); }} className="p-1 text-slate-400 hover:text-blue-500" title="Ner"><LucideChevronDown size={12} /></button>
                                                                </>
                                                            )}
                                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(event); }} className="p-1 text-slate-400 hover:text-rose-500" title="Ta bort"><X size={12} /></button>
                                                        </div>
                                                    </div>

                                                    {swappingActivityId && swappingActivityId !== act.id && (
                                                        <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-[1px] flex items-center justify-center z-30 transition-all rounded-lg">
                                                            <RefreshCcw className="text-blue-600 animate-spin-slow" size={24} />
                                                        </div>
                                                    )}

                                                    {ctrlHeld && (
                                                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] hidden group-hover:flex items-center justify-center gap-3 z-40 transition-all rounded-lg animate-in fade-in zoom-in duration-200">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDuplicate(act); }}
                                                                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center group/btn"
                                                                title="Kopiera"
                                                            >
                                                                <Copy size={16} />
                                                                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Kopiera</span>
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDelete({ type: 'planned', id: act.id, data: act }); }}
                                                                className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center group/btn"
                                                                title="Ta bort"
                                                            >
                                                                <Trash2 size={16} />
                                                                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap">Ta bort</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {movingActivityId === act.id && (
                                                        <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-900/50 animate-in fade-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                                            <div className="text-[9px] font-black uppercase text-slate-500 mb-2">Flytta till datum:</div>
                                                            <input 
                                                                type="date" 
                                                                defaultValue={act.date}
                                                                onChange={(e) => handleMoveToDate(act.id, e.target.value)}
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs text-slate-700 dark:text-slate-200"
                                                            />
                                                        </div>
                                                    )}
                                                    <p className={`text-xs font-medium leading-tight ${isSkipped ? 'line-through' : ''} ${isCompleted ? 'text-slate-700 dark:text-slate-200' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {isRace ? (() => {
                                                            const idx = sortedRaces.findIndex((r: any) => r.id === act.id);
                                                            const prev = idx > 0 ? sortedRaces[idx - 1] : null;
                                                            const next = idx < sortedRaces.length - 1 ? sortedRaces[idx + 1] : null;
                                                            const daysPrev = prev ? getDaysBetween(prev.date, act.date) : null;
                                                            const daysNext = next ? getDaysBetween(act.date, next.date) : null;
                                                            const distStr = isCompleted && act.actualDistance ? `${act.actualDistance.toFixed(1)} km (mål ${act.estimatedDistance.toFixed(1)})` : `${act.estimatedDistance.toFixed(1)} km`;
                                                            return <span className="font-bold block mb-0.5">{act.title}{act.estimatedDistance > 0 && <span className="text-amber-600 dark:text-amber-400 ml-1">({distStr})</span>}{(daysPrev !== null || daysNext !== null) && <span className="hidden group-hover/card:flex gap-2 text-[9px] font-black uppercase tracking-tight text-amber-600 dark:text-amber-500/80 mt-0.5">{daysPrev !== null && <span>⏮️ {daysPrev} dgr sen</span>}{daysNext !== null && <span>⏭️ {daysNext} dgr kvar</span>}</span>}</span>;
                                                        })() : (
                                                            <>
                                                                {act.type === 'BIKE' && act.title === 'Cykling' && act.durationMinutes 
                                                                    ? `Cykel ${act.durationMinutes} min` 
                                                                    : act.title}
                                                                {isCompleted && (act.actualDistance || act.actualTimeSeconds) ? (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        {act.actualDistance && <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1"><span>✅ {act.actualDistance.toFixed(1)} km</span><span className="text-slate-400 text-[10px] font-medium">(mål {act.estimatedDistance.toFixed(1)})</span></div>}
                                                                        {act.actualTimeSeconds && <div className="text-slate-500 text-[10px] flex items-center gap-1"><span>⏱️ {formatDurationHHMM(act.actualTimeSeconds / 60)}</span><span className="opacity-50">(mål {formatDurationHHMM(act.durationMinutes || 0)})</span></div>}
                                                                    </div>
                                                                ) : (
                                                                    act.estimatedDistance > 0 && !isRace && <span className="text-slate-500 ml-1">({act.estimatedDistance.toFixed(1)} km)</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </p>
                                                    {!isCompleted && (act.durationMinutes || 0) > 0 && <span className="text-[10px] text-slate-400 font-bold block">⏱️ {formatDurationHHMM(act.durationMinutes || 0)}</span>}
                                                    
                                                    {/* Bike specific targets */}
                                                    {act.type === 'BIKE' && (act.targetSpeedKmh || act.targetWattsRange) && (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {act.targetSpeedKmh && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-100 dark:border-emerald-800/30">🎯 {act.targetSpeedKmh} km/h</span>}
                                                            {act.targetWattsRange && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 rounded-md border border-cyan-100 dark:border-cyan-800/30">⚡ {act.targetWattsRange} W</span>}
                                                        </div>
                                                    )}

                                                    {act.description && <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-tight">{act.description}</p>}
                                                    
                                                    {/* Manual Match UI */}
                                                    {!isCompleted && !isSkipped && (() => {
                                                        const planType = (act.type || act.category || '').toUpperCase();
                                                        const isRunPlan = ['RUN', 'RACE', 'COMPETITION', 'INTERVALS', 'TEMPO', 'LONG_RUN', 'EASY', 'HILL_REPEATS'].includes(planType) || act.isRace;
                                                        
                                                        const unmatchedOnDay = allEvents.filter(e => {
                                                            if (e.type !== 'actual') return false;
                                                            const actual = e.data;
                                                            const actualType = (actual.type || actual.performance?.activityType || '').toLowerCase();
                                                            
                                                            // Filter out obvious mismatches
                                                            if (isRunPlan) {
                                                                // If it's a run plan, only suggest running or walking
                                                                if (actualType !== 'running' && actualType !== 'walking') return false;
                                                            }
                                                            
                                                            if (planType === 'STRENGTH' && actualType !== 'strength') return false;
                                                            if (planType === 'YOGA' && actualType !== 'yoga') return false;
                                                            if ((planType === 'BIKE' || planType === 'CYCLING') && actualType !== 'cycling') return false;

                                                            return true;
                                                        });
                                                        
                                                        const bestCandidateId = act.reconciliation?.bestCandidateId;
                                                        
                                                        if (unmatchedOnDay.length > 0) {
                                                            return (
                                                                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/50">
                                                                    <div className="text-[8px] font-black uppercase text-indigo-400/60 tracking-wider mb-1.5 flex items-center gap-1.5">
                                                                        <Target size={8} /> Pass genomfört? Matcha för att dölja:
                                                                    </div>
                                                                    <div className="flex flex-col gap-1">
                                                                        {unmatchedOnDay.map(ev => {
                                                                            const isBest = ev.id === bestCandidateId;
                                                                            return (
                                                                                <button 
                                                                                    key={ev.id}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        reconciliation.reconcileActivity(act.id, ev.id);
                                                                                    }}
                                                                                    className={`text-left px-2 py-1 rounded text-[9px] font-bold transition-all border ${isBest ? 'bg-indigo-500 text-white border-indigo-400 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-500'}`}
                                                                                >
                                                                                    {isBest ? '✨ Förslag: ' : ''}{ev.data.title || ev.data.type} ({Math.round(ev.data.durationMinutes)} min)
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    {/* Developer Insights (Ignorera match) at Bottom */}
                                                    {(act.reconciliation || act.externalId) && (
                                                        <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/50 hidden group-hover/card:block animate-in fade-in slide-in-from-top-1">
                                                            <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400 mb-1">
                                                                <span>Data-matchning</span>
                                                                {act.reconciliation?.score != null && <span className="text-emerald-500">{Math.round(act.reconciliation.score)}% Match</span>}
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                <div className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-500">Källa: {act.reconciliation?.source || 'Okänd'}</div>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); updatePlannedActivity(act.id, { status: 'PLANNED', reconciliation: undefined, externalId: undefined, autoMatchDisabled: true }); notificationService.notify('info', 'Matchning ignorerad.'); }}
                                                                    className="ml-auto text-rose-500 hover:text-rose-600 text-[8px] font-black uppercase underline"
                                                                >
                                                                    Ignorera match
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        );
                                    } else {
                                        const actual = event.data;
                                        const isBike = actual.type?.toLowerCase() === 'cycling' || actual.type?.toLowerCase() === 'ride' || actual.type?.toLowerCase() === 'virtualride' || actual.type?.toLowerCase() === 'bike';
                                        const isStrength = actual.type?.toLowerCase() === 'strength';
                                        const isSwimming = actual.type?.toLowerCase() === 'swimming' || actual.type?.toLowerCase() === 'swim';
                                        const isCardio = actual.type?.toLowerCase() === 'cardio' || actual.type?.toLowerCase() === 'walking';
                                        const title = (actual.title || '').toLowerCase();
                                        const isTrail = ['trail', 'terräng', 'obanat', 'stig'].some(kw => title.includes(kw));
                                        
                                        let bgClass = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30';
                                        let textClass = 'text-emerald-600 dark:text-emerald-400';
                                        let icon = '🏃';
                                        
                                        if (isStrength) {
                                            bgClass = 'bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30';
                                            textClass = 'text-purple-600 dark:text-purple-400';
                                            icon = '💪';
                                        } else if (isBike) {
                                            bgClass = 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-900/30';
                                            textClass = 'text-cyan-600 dark:text-cyan-400';
                                            icon = '🚴';
                                        } else if (isSwimming) {
                                            bgClass = 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30';
                                            textClass = 'text-blue-600 dark:text-blue-400';
                                            icon = '🏊';
                                        } else if (isCardio) {
                                            bgClass = 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30';
                                            textClass = 'text-indigo-600 dark:text-indigo-400';
                                            icon = '⚡';
                                        }

                                        if (isTrail && actual.type === 'running') {
                                            icon = '🏔️';
                                            bgClass = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-400 dark:border-emerald-800/50 ring-1 ring-emerald-500/10';
                                        }

                                        return (
                                            <div 
                                                key={actual.id}
                                                draggable={true}
                                                onDragStart={(e) => { e.dataTransfer.setData('activityId', actual.id); e.dataTransfer.effectAllowed = 'move'; }}
                                                onClick={() => updateUrlParams({ activityId: actual.id })}
                                                className={`p-3 border rounded-xl hover:shadow-md transition-all cursor-pointer group ${bgClass}`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${textClass}`}>
                                                        {actual.source === 'strava' ? 'STRAVA' : 'LOGGAT'}{actual.source === 'strava' && <span className="text-[#FC4C02]">🔥</span>}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={(e) => { e.stopPropagation(); setMovingActivityId(movingActivityId === actual.id ? null : actual.id); }} className={`p-0.5 transition-colors ${movingActivityId === actual.id ? 'text-blue-500 font-bold' : 'text-slate-400 hover:text-blue-500'}`} title="Flytta"><Calendar size={10} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); reorderActivity(actual.id, 'up'); }} className="p-0.5 text-slate-400 hover:text-blue-500" title="Flytta upp"><LucideChevronUp size={10} /></button>
                                                            <button onClick={(e) => { e.stopPropagation(); reorderActivity(actual.id, 'down'); }} className="p-0.5 text-slate-400 hover:text-blue-500" title="Flytta ner"><LucideChevronDown size={10} /></button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(event); }} 
                                                                className="p-0.5 text-slate-400 hover:text-rose-500 ml-1" 
                                                                title="Ta bort"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                        {event.time && <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 opacity-60"><Clock size={9} />{event.time}</span>}
                                                    </div>
                                                    {movingActivityId === actual.id && (
                                                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-900/50 absolute left-0 right-0 z-50 shadow-xl" onClick={e => e.stopPropagation()}>
                                                            <div className="text-[9px] font-black uppercase text-slate-500 mb-2">Flytta till datum:</div>
                                                            <input 
                                                                type="date" 
                                                                defaultValue={actual.date.split('T')[0]}
                                                                onChange={(e) => handleMoveToDate(actual.id, e.target.value)}
                                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs text-slate-700 dark:text-slate-200"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                                        {(actual.title?.toLowerCase().includes('allmän cardio') || actual.title?.toLowerCase().includes('generell cardio')) && actual.type === 'cardio'
                                                            ? 'Crosstrainer / Cardio' 
                                                            : (actual.title || (actual.type === 'strength' ? 'Styrkepass' : 'Träningspass'))}
                                                    </h4>
                                                    {(() => {
                                                        const score = calculatePerformanceScore(actual, unifiedActivities);
                                                        if (score <= 0) return null;
                                                        return (
                                                            <span
                                                                className={`min-w-[18px] px-1 h-4 rounded-full flex items-center justify-center text-[8px] font-black shadow-sm ${score >= 600 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                                    score >= 400 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                                                                        'bg-slate-500/20 text-slate-400 border border-white/5'
                                                                    }`}
                                                                title={`Greens Index: ${score}`}
                                                            >
                                                                {score}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                                    {(actual.distance || 0) > 0 && <span className="text-xs text-slate-500 font-medium">{icon} {(actual.distance || 0).toFixed(1)} km</span>}
                                                    {(actual.durationMinutes || 0) > 0 && <span className="text-xs text-slate-500 font-medium">⏱️ {formatDurationHHMM(actual.durationMinutes || 0)}</span>}
                                                    {(actual.tonnage || 0) > 0 && <span className="text-xs text-slate-500 font-medium">💪 {((actual.tonnage || 0) / 1000).toFixed(1)}t</span>}
                                                </div>
                                            </div>
                                        );
                                    }
                                })}

                                {allEvents.length === 0 && (
                                    <div className="py-8 flex flex-col items-center justify-center opacity-20 pointer-events-none border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-2"><Activity size={20} className="text-slate-400" /></div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Vila</span>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleOpenModal(day.date)}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex flex-col items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <Plus size={20} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Planera</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <ActivityModal
                isOpen={isModalOpen}
                onClose={() => {
                    delete (window as any)._pendingRacesActivities;
                    setIsModalOpen(false);
                }}
                selectedDate={selectedDate}
                editingActivity={editingActivity}
                onSave={handleSaveActivity}
                onDelete={(id) => { deletePlannedActivity(id); setIsModalOpen(false); }}
                weeklyStats={weeklyStats}
                goalProgress={goalProgress}
            />

            <WeeklyStatsAnalysis weekStart={currentWeekStart} weeklyStats={weeklyStats} />

            {goalProgress.length > 0 && (
                <div className="max-w-full mx-auto mt-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Target size={18} className="text-indigo-500" />
                            <h3 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-white">Veckomål & Prognos</h3>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={handleMoveAllToNextWeek}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 transition-colors flex items-center gap-2"
                                title="Flytta alla planerade pass till nästa vecka"
                            >
                                <ChevronRight size={14} /> Flytta pass till nästa vecka
                            </button>
                            <div className="flex gap-2 text-sm uppercase font-black text-slate-500">
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                                    <Zap size={14} className="text-amber-500 fill-amber-500" /> 
                                    {weeklyStats.forecast.runningKm.toFixed(1)} km planerat
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {goalProgress.map((goal) => {
                            const currentPct = Math.min(100, (goal.current / goal.target) * 100);
                            const plannedPct = Math.min(100 - currentPct, (goal.planned / goal.target) * 100);
                            const isActuallyMet = goal.current >= goal.target;
                            const isProjectedMet = (goal.current + goal.planned) >= goal.target;
                            const overPerformance = Math.max(0, goal.current - goal.target);

                            return (
                                <div key={goal.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex justify-between text-xs font-black uppercase mb-2">
                                        <span className="text-slate-600 dark:text-slate-400 truncate pr-2 flex items-center gap-2">
                                            {goal.name}
                                            {isActuallyMet ? <Check size={14} className="text-emerald-500 stroke-[3]" /> : (isProjectedMet ? <Check size={14} className="text-emerald-500/50 stroke-[3]" /> : null)}
                                        </span>
                                        <span className={isActuallyMet ? 'text-emerald-500' : 'text-slate-500'}>
                                            {overPerformance > 0 ? (
                                                <span className="flex items-center gap-1.5">
                                                    <span>{goal.target} {goal.unit}</span>
                                                    <span className="text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 px-1.5 rounded text-[10px]">+{overPerformance.toFixed(1)}</span>
                                                </span>
                                            ) : (
                                                <>
                                                    {goal.current.toFixed(goal.unit === 'km' ? 1 : 0)}
                                                    <span className="text-slate-300 mx-1.5">/</span>
                                                    {goal.target} {goal.unit}
                                                </>
                                            )}
                                        </span>
                                    </div>
                                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex relative">
                                        <div className={`h-full transition-all ${isActuallyMet ? 'bg-emerald-500' : goal.colorClass}`} style={{ width: `${currentPct}%` }} />
                                        {plannedPct > 0 && (
                                            <div className={`h-full transition-all ${goal.plannedClass}`} style={{ width: `${plannedPct}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)' }} />
                                        )}
                                    </div>
                                    <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                                        <span>{Math.round(currentPct)}% klart</span>
                                        {plannedPct > 0 && <span>+{Math.round(plannedPct)}% planerat</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="max-w-full mx-auto mb-12">
                <TrainingPeriodBanner />
            </div>
            </div>
        </div>
    );
}

function getWeekNumber(dateStr: string): number {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
