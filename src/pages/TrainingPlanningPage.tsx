import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { getTrainingSuggestions, TrainingSuggestion } from '../utils/trainingSuggestions.ts';
import {
    PlannedActivity,
    generateId,
    getISODate,
    getWeekStartDate,
    WEEKDAYS,
    Weekday,
    WEEKDAY_LABELS
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
    Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDuration } from '../utils/dateUtils.ts';

const SHORT_WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export function TrainingPlanningPage() {
    const navigate = useNavigate();
    const {
        exerciseEntries,
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

    // ESC key handler
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isModalOpen) {
                setIsModalOpen(false);
                setEditingActivity(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

    // Form State
    const [formType, setFormType] = useState<'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE' | 'REST'>('RUN');
    const [formDuration, setFormDuration] = useState('45');
    const [formDistance, setFormDistance] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formIntensity, setFormIntensity] = useState<'low' | 'moderate' | 'high'>('moderate');

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

        return {
            strengthSessions: strengthSessionGoal ? {
                target: strengthSessionGoal.targets?.find(t => t.unit === 'sessions' || t.unit?.toLowerCase().includes('pass'))?.count ||
                    strengthSessionGoal.targets?.find(t => t.unit === 'sessions' || t.unit?.toLowerCase().includes('pass'))?.value || 0,
                current: strengthSessionsCount,
                name: 'Styrkepass'
            } : null,
            totalSessions: totalSessionGoal ? {
                target: totalSessionGoal.targets?.find(t => t.unit === 'sessions' || t.unit?.toLowerCase().includes('pass'))?.count ||
                    totalSessionGoal.targets?.find(t => t.unit === 'sessions' || t.unit?.toLowerCase().includes('pass'))?.value || 0,
                current: totalSessions,
                name: totalSessionGoal.name
            } : null,
            km: kmGoal ? {
                target: kmGoal.targets?.find(t => t.unit === 'km')?.value || 0,
                current: currentKm,
                name: 'Distans'
            } : null
        };
    }, [performanceGoals, weeklyStats]);

    // Smart Suggestions - now with goal awareness and planned-session awareness
    const suggestions = useMemo(() => {
        if (!selectedDate) return [];

        // Combine history with planned activities to make suggestions smarter
        const combinedHistory = [
            ...exerciseEntries,
            ...plannedActivities.map(p => ({
                id: p.id,
                date: p.date,
                type: (p.type === 'STRENGTH' || p.category === 'STRENGTH') ? 'strength' : 'running',
                durationMinutes: p.targetHrZone >= 4 ? 60 : 45, // Rough estimate
                intensity: p.category === 'LONG_RUN' || p.targetHrZone >= 4 ? 'high' : (p.targetHrZone <= 2 ? 'low' : 'moderate'),
                distance: p.estimatedDistance,
                caloriesBurned: 0,
                createdAt: new Date().toISOString()
            })) as any
        ];

        // 1. Get base suggestions
        const baseSuggestions = getTrainingSuggestions(combinedHistory, selectedDate);

        // 2. Add goal-based suggestions using FORECAST (actual + planned)
        const goalSuggestions: TrainingSuggestion[] = [];

        // If forecast strength goal met but running behind → suggest running
        const strengthForecastMet = goalProgress.strengthSessions &&
            weeklyStats.forecast.strengthSessions >= (goalProgress.strengthSessions.target || 0);

        const runningForecastBehind = goalProgress.km &&
            weeklyStats.forecast.runningKm < (goalProgress.km.target || 0);

        if (strengthForecastMet && runningForecastBehind) {
            goalSuggestions.push({
                id: generateId(),
                type: 'RUN',
                label: '🎯 Prioritera Löpning',
                description: `Prognos: ${weeklyStats.forecast.runningKm.toFixed(1)}km av ${goalProgress.km?.target}km mål`,
                reason: 'Styrka planerad/klar, men löpning saknas!',
                duration: 45,
                intensity: 'moderate'
            });
        }

        // If forecast running goal met but strength behind → suggest strength
        const runningForecastMet = goalProgress.km &&
            weeklyStats.forecast.runningKm >= (goalProgress.km.target || 0);

        const strengthForecastBehind = goalProgress.strengthSessions &&
            weeklyStats.forecast.strengthSessions < (goalProgress.strengthSessions.target || 0);

        if (runningForecastMet && strengthForecastBehind) {
            goalSuggestions.push({
                id: generateId(),
                type: 'STRENGTH',
                label: '🎯 Prioritera Styrka',
                description: `Prognos: ${weeklyStats.forecast.strengthSessions} styrkepass (mål: ${goalProgress.strengthSessions?.target})`,
                reason: 'Löpvärden planerad/klar, prioritera styrka.',
                duration: 50,
                intensity: 'high'
            });
        }

        const combined = [...goalSuggestions, ...baseSuggestions];

        // 3. Filter by currently selected formType in modal if open
        if (isModalOpen && formType) {
            const filtered = combined.filter(s => {
                if (formType === 'RUN') return s.type === 'RUN' || s.type === 'HYROX' || s.type === 'BIKE';
                if (formType === 'STRENGTH') return s.type === 'STRENGTH';
                if (formType === 'REST') return s.type === 'REST';
                return s.type === formType;
            });
            return filtered.slice(0, 4);
        }

        return combined.slice(0, 4);
    }, [selectedDate, exerciseEntries, goalProgress, weeklyStats, plannedActivities, isModalOpen, formType]);

    // Handlers
    const handleOpenModal = (date: string, activity?: PlannedActivity) => {
        setSelectedDate(date);
        setIsModalOpen(true);

        if (activity) {
            // Edit mode - pre-fill form
            setEditingActivity(activity);
            // Infer type from title/category
            if (activity.type === 'REST' || activity.category === 'REST') {
                setFormType('REST');
            } else if (activity.title.toLowerCase().includes('styrka') || activity.category === 'STRENGTH') {
                setFormType('STRENGTH');
            } else if (activity.title.toLowerCase().includes('hyrox') || activity.category === 'INTERVALS') {
                setFormType('HYROX');
            } else {
                setFormType('RUN');
            }
            setFormDistance(activity.estimatedDistance?.toString() || '');
            setFormNotes(activity.description || '');
            setFormIntensity(activity.targetHrZone <= 2 ? 'low' : activity.targetHrZone >= 4 ? 'high' : 'moderate');
            setFormDuration('45'); // Fallback
        } else {
            // Create mode - reset form
            setEditingActivity(null);
            setFormType('RUN');
            setFormDuration('45');
            setFormDistance('');
            setFormNotes('');
            setFormIntensity('moderate');
        }
    };

    const handleSave = () => {
        if (!selectedDate) return;

        const activityData = {
            date: selectedDate,
            type: (formType === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: (formType === 'RUN' ? 'EASY' :
                formType === 'STRENGTH' ? 'STRENGTH' :
                    formType === 'HYROX' ? 'INTERVALS' :
                        formType === 'REST' ? 'REST' : 'EASY') as PlannedActivity['category'],
            title: formType === 'RUN' ? 'Löpning' :
                formType === 'STRENGTH' ? 'Styrka' :
                    formType === 'HYROX' ? 'Hyrox' :
                        formType === 'REST' ? 'Vilodag' : 'Cykling',
            description: formNotes || `${formType === 'REST' ? 'Vila och återhämtning' : formType + ' pass'}`,
            estimatedDistance: formType === 'RUN' && formDistance ? parseFloat(formDistance) : 0,
            targetPace: '',
            targetHrZone: formType === 'REST' ? 1 : (formIntensity === 'low' ? 2 : formIntensity === 'moderate' ? 3 : 4),
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 } as PlannedActivity['structure'],
            status: 'PLANNED' as const
        };

        if (editingActivity) {
            // Update existing activity
            updatePlannedActivity(editingActivity.id, activityData);
        } else {
            // Create new activity
            const newActivity: PlannedActivity = {
                id: generateId(),
                ...activityData
            };
            savePlannedActivities([newActivity]);
        }

        setEditingActivity(null);
        setIsModalOpen(false);
    };

    const handleApplySuggestion = (s: TrainingSuggestion) => {
        if (!selectedDate) return;

        // Map suggestion type to form/model
        const type = s.type === 'REST' ? 'RUN' : s.type; // REST not fully supported yet, defaulting

        const newActivity: PlannedActivity = {
            id: generateId(),
            date: selectedDate,
            type: (s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'REST' ? 'REST' : 'RUN') as PlannedActivity['type'],
            category: s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'REST' ? 'REST' : s.type === 'HYROX' ? 'INTERVALS' : 'EASY',
            title: s.label,
            description: s.description,
            estimatedDistance: s.distance || 0,
            targetPace: '',
            targetHrZone: s.intensity === 'low' ? 2 : s.intensity === 'moderate' ? 3 : 4,
            structure: { warmupKm: 0, mainSet: [], cooldownKm: 0 },
            status: 'PLANNED'
        };

        savePlannedActivities([newActivity]);
        setIsModalOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-900 dark:text-white">
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
                            {goalProgress.strengthSessions && (
                                <div>
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                        <span className="text-slate-400">Styrkepass</span>
                                        <span className={goalProgress.strengthSessions.current >= goalProgress.strengthSessions.target ? 'text-emerald-500' : 'text-slate-500'}>
                                            {goalProgress.strengthSessions.current} / {goalProgress.strengthSessions.target}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${goalProgress.strengthSessions.current >= goalProgress.strengthSessions.target ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(100, (goalProgress.strengthSessions.current / goalProgress.strengthSessions.target) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            {goalProgress.totalSessions && (
                                <div>
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                        <span className="text-slate-400">{goalProgress.totalSessions.name}</span>
                                        <span className={goalProgress.totalSessions.current >= goalProgress.totalSessions.target ? 'text-emerald-500' : 'text-slate-500'}>
                                            {goalProgress.totalSessions.current} / {goalProgress.totalSessions.target}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${goalProgress.totalSessions.current >= goalProgress.totalSessions.target ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(100, (goalProgress.totalSessions.current / goalProgress.totalSessions.target) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            {goalProgress.km && (
                                <div>
                                    <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                        <span className="text-slate-400">Kilometer</span>
                                        <span className={goalProgress.km.current >= goalProgress.km.target ? 'text-emerald-500' : 'text-slate-500'}>
                                            {goalProgress.km.current.toFixed(1)} / {goalProgress.km.target}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${goalProgress.km.current >= goalProgress.km.target ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                            style={{ width: `${Math.min(100, (goalProgress.km.current / goalProgress.km.target) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
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

            {/* Planning Modal */}
            {isModalOpen && selectedDate && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-tight">
                                    {editingActivity ? '✏️ Redigera pass' : `📅 Planera ${selectedDate}`}
                                </h2>
                                <p className="text-xs text-slate-500 font-medium">
                                    {editingActivity ? 'Uppdatera planerat pass' : 'Välj aktivitet eller använd förslag'}
                                </p>
                            </div>
                            <button onClick={() => { setIsModalOpen(false); setEditingActivity(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[80vh] overflow-y-auto">
                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap size={14} className="text-amber-500 fill-amber-500" />
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Smarta Förslag</span>
                                    </div>
                                    <div className="space-y-2">
                                        {suggestions.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => handleApplySuggestion(s)}
                                                className="w-full p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center justify-between group hover:scale-[1.02] transition-transform text-left"
                                            >
                                                <div>
                                                    <div className="text-xs font-black text-slate-900 dark:text-white mb-0.5">{s.label}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">{s.reason}</div>
                                                </div>
                                                <div className="p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-sm text-amber-500">
                                                    <Plus size={14} />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Manual Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                    <button
                                        onClick={() => setFormType('RUN')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'RUN' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Löpning
                                    </button>
                                    <button
                                        onClick={() => setFormType('STRENGTH')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Styrka
                                    </button>
                                    <button
                                        onClick={() => setFormType('REST')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'REST' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Vila
                                    </button>
                                </div>

                                {formType !== 'REST' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Distans (km)</label>
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    value={formDistance}
                                                    onChange={(e) => setFormDistance(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                    placeholder="0.0"
                                                />
                                                {formType === 'RUN' && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {[5, 10, 21, 42].map(d => (
                                                            <button
                                                                key={d}
                                                                onClick={() => setFormDistance(d.toString())}
                                                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-[10px] font-black uppercase text-slate-500 transition-colors"
                                                            >
                                                                {d}km
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => {
                                                                const recentDistances = exerciseEntries.filter(e => e.type === 'running' && e.distance).map(e => e.distance!);
                                                                if (recentDistances.length > 0) {
                                                                    const avg = recentDistances.reduce((a, b) => a + b, 0) / recentDistances.length;
                                                                    setFormDistance(Math.round(avg).toString());
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-[10px] font-black uppercase text-blue-600 transition-colors"
                                                        >
                                                            Snitt
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1">Intensitet</label>
                                            <select
                                                value={formIntensity}
                                                onChange={(e) => setFormIntensity(e.target.value as any)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                                            >
                                                <option value="low">Låg</option>
                                                <option value="moderate">Medel</option>
                                                <option value="high">Hög</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {formType !== 'REST' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tid (min)</label>
                                        <input
                                            type="number"
                                            value={formDuration}
                                            onChange={e => setFormDuration(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="45"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Anteckningar</label>
                                    <textarea
                                        value={formNotes}
                                        onChange={e => setFormNotes(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium h-24 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        placeholder="Beskriv passet..."
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {editingActivity ? 'Uppdatera Pass' : 'Spara Pass'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}

function getWeekNumber(dateStr: string): number {
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
