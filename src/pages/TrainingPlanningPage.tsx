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
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
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
        universalActivities = []
    } = useData();

    const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<PlannedActivity | null>(null);
    const [selectedFactualActivity, setSelectedFactualActivity] = useState<{ entry: any, universal?: any } | null>(null);

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
    const [formType, setFormType] = useState<'RUN' | 'STRENGTH' | 'HYROX' | 'BIKE'>('RUN');
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

    // Calculate weekly stats split by type (Löpning | Styrka) with forecast
    const weeklyStats = useMemo(() => {
        const thisWeekStart = new Date(currentWeekStart);
        const thisWeekEnd = new Date(thisWeekStart);
        thisWeekEnd.setDate(thisWeekEnd.getDate() + 6);

        const startStr = getISODate(thisWeekStart);
        const endStr = getISODate(thisWeekEnd);

        // Running stats from universalActivities (using performance section)
        const runningActivities = universalActivities.filter(a =>
            a.date >= startStr && a.date <= endStr &&
            a.performance?.activityType === 'running'
        );

        const runningSessions = runningActivities.length;
        const runningKm = runningActivities.reduce((sum, a) => sum + (a.performance?.distanceKm || 0), 0);
        const runningTime = runningActivities.reduce((sum, a) => sum + (a.performance?.durationMinutes || 0), 0);

        // Strength stats from strengthSessions
        const periodStrength = strengthSessions.filter(s => s.date >= startStr && s.date <= endStr);
        const strengthSessionCount = periodStrength.length;
        const strengthTime = periodStrength.reduce((sum, s) => sum + (s.duration || 0), 0);
        const strengthTonnage = periodStrength.reduce((sum, s) => {
            return sum + (s.exercises || []).reduce((exSum, ex) => {
                return exSum + (ex.sets || []).reduce((setSum, set) => {
                    return setSum + ((set.weight || 0) * (set.reps || 0));
                }, 0);
            }, 0);
        }, 0);

        // Forecast from planned activities
        const plannedThisWeek = plannedActivities.filter(p =>
            p.date >= startStr && p.date <= endStr && p.status === 'PLANNED'
        );
        const plannedRunning = plannedThisWeek.filter(p =>
            p.title?.toLowerCase().includes('löpning') ||
            p.category === 'EASY' || p.category === 'INTERVALS' || p.category === 'TEMPO' ||
            p.category === 'LONG_RUN' || p.category === 'RECOVERY'
        );
        const plannedStrength = plannedThisWeek.filter(p =>
            p.title?.toLowerCase().includes('styrka') || p.category === 'STRENGTH'
        );

        const forecastRunningSessions = runningSessions + plannedRunning.length;
        const forecastRunningKm = runningKm + plannedRunning.reduce((sum, p) => sum + (p.estimatedDistance || 0), 0);
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
    }, [currentWeekStart, universalActivities, strengthSessions, plannedActivities]);

    // Goal progress for sessions/km per week
    const goalProgress = useMemo(() => {
        const activeGoals = performanceGoals.filter(g => g.status === 'active');

        // Find session goals - distinguish between styrka and total/löpning
        const sessionGoals = activeGoals.filter(g =>
            g.targets?.some(t => t.unit === 'sessions')
        );

        const strengthSessionGoal = sessionGoals.find(g =>
            g.name.toLowerCase().includes('styrka')
        );

        const totalSessionGoal = sessionGoals.find(g =>
            !g.name.toLowerCase().includes('styrka')
        );

        // Find km goal (unit === 'km')
        const kmGoal = activeGoals.find(g =>
            g.targets?.some(t => t.unit === 'km')
        );

        const strengthSessionsCount = weeklyStats.strength.sessions;
        const totalSessions = weeklyStats.running.sessions + strengthSessionsCount;
        const currentKm = weeklyStats.running.km;

        return {
            strengthSessions: strengthSessionGoal ? {
                target: strengthSessionGoal.targets?.find(t => t.unit === 'sessions')?.value || 0,
                current: strengthSessionsCount,
                name: 'Styrkepass'
            } : null,
            totalSessions: totalSessionGoal ? {
                target: totalSessionGoal.targets?.find(t => t.unit === 'sessions')?.value || 0,
                current: totalSessions,
                name: totalSessionGoal.name
            } : null,
            km: kmGoal ? {
                target: kmGoal.targets?.find(t => t.unit === 'km')?.value || 0,
                current: currentKm,
                name: kmGoal.name
            } : null
        };
    }, [performanceGoals, weeklyStats]);

    // Smart Suggestions - now with goal awareness and planned-session awareness
    const suggestions = useMemo(() => {
        if (!selectedDate) return [];

        const baseSuggestions = getTrainingSuggestions(exerciseEntries, selectedDate);

        // Add goal-based suggestions using FORECAST (actual + planned)
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

        return [...goalSuggestions, ...baseSuggestions].slice(0, 4);
    }, [selectedDate, exerciseEntries, goalProgress, weeklyStats, plannedActivities]);

    // Handlers
    const handleOpenModal = (date: string, activity?: PlannedActivity) => {
        setSelectedDate(date);
        setIsModalOpen(true);

        if (activity) {
            // Edit mode - pre-fill form
            setEditingActivity(activity);
            // Infer type from title/category
            if (activity.title.toLowerCase().includes('styrka') || activity.category === 'STRENGTH') {
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
            type: 'RUN' as const, // Tech debt: Type is currently hardcoded to 'RUN' in PlannedActivity interface, using Category for others
            category: (formType === 'RUN' ? 'EASY' :
                formType === 'STRENGTH' ? 'STRENGTH' :
                    formType === 'HYROX' ? 'INTERVALS' : 'EASY') as PlannedActivity['category'],
            title: formType === 'RUN' ? 'Löpning' :
                formType === 'STRENGTH' ? 'Styrka' :
                    formType === 'HYROX' ? 'Hyrox' : 'Cykling',
            description: formNotes || `${formType} pass`,
            estimatedDistance: formDistance ? parseFloat(formDistance) : 0,
            targetPace: '',
            targetHrZone: formIntensity === 'low' ? 2 : formIntensity === 'moderate' ? 3 : 4,
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
            type: 'RUN',
            category: s.type === 'STRENGTH' ? 'STRENGTH' : s.type === 'HYROX' ? 'INTERVALS' : 'EASY',
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
            <div className="max-w-6xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Denna Vecka (Actuals) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-emerald-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Denna Vecka</span>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Löpning</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {weeklyStats.running.sessions} pass | {weeklyStats.running.km.toFixed(1)} km | {Math.round(weeklyStats.running.time)} min
                            </div>
                        </div>
                        <div className="border-t border-slate-50 dark:border-slate-800 pt-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Styrka</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {weeklyStats.strength.sessions} pass | {(weeklyStats.strength.tonnage / 1000).toFixed(1)} t | {Math.round(weeklyStats.strength.time)} min
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
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                                {weeklyStats.forecast.runningSessions} pass | {weeklyStats.forecast.runningKm.toFixed(1)} km
                            </div>
                        </div>
                        <div className="border-t border-emerald-100/50 dark:border-emerald-800/30 pt-3">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Styrka Totalt</div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
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

                    return (
                        <div key={day.date} className={`flex flex-col h-[400px] bg-white dark:bg-slate-900 rounded-2xl border ${isToday ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-200 dark:border-slate-800'} relative group`}>
                            {/* Header */}
                            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-1 bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">{day.label}</span>
                                    <span className={`text-xs font-bold ${isToday ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                                        {day.date.split('-')[2]}
                                    </span>
                                </div>
                                {(daySessions > 0) && (
                                    <div className="text-[9px] font-black text-slate-400 flex items-center gap-1.5">
                                        <span>{daySessions} p</span>
                                        {dayKm > 0 && <span>| {dayKm.toFixed(1)} km</span>}
                                        {dayTime > 0 && <span>| {formatDuration(dayTime * 60)}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Activities */}
                            <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                                {/* Running / Cardio Activities (from universalActivities) */}
                                {dayRunningActivities.map((act) => (
                                    <div
                                        key={`run-${act.id}`}
                                        onClick={() => setSelectedFactualActivity({ entry: mapUniversalToLegacyEntry(act), universal: act })}
                                        className="p-3 bg-blue-500/10 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl relative cursor-pointer hover:bg-blue-500/20 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1">
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
                                        onClick={() => {
                                            // Mock legacy entry for strength session to use in detail modal
                                            const mapped = {
                                                id: session.id,
                                                date: session.date,
                                                type: 'strength',
                                                durationMinutes: session.duration || 0,
                                                notes: session.name,
                                                tonnage: session.totalVolume,
                                                source: 'strengthlog'
                                            };
                                            setSelectedFactualActivity({ entry: mapped as any });
                                        }}
                                        className="p-3 bg-purple-500/10 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl relative cursor-pointer hover:bg-purple-500/20 transition-colors"
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
                                        className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl group/card relative hover:shadow-md transition-all cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                                                📅 {act.title}
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
                                    onClick={() => handleOpenModal(day.date)}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <Plus size={20} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Planera</span>
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
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                    <button
                                        onClick={() => setFormType('RUN')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'RUN' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Kondition
                                    </button>
                                    <button
                                        onClick={() => setFormType('STRENGTH')}
                                        className={`py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${formType === 'STRENGTH' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Styrka
                                    </button>
                                </div>

                                {formType === 'RUN' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Distans (km)</label>
                                            <input
                                                type="number"
                                                value={formDistance}
                                                onChange={e => setFormDistance(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                                                placeholder="ex. 5"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Tid (min)</label>
                                            <input
                                                type="number"
                                                value={formDuration}
                                                onChange={e => setFormDuration(e.target.value)}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                                                placeholder="45"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 ml-1">Anteckningar</label>
                                    <textarea
                                        value={formNotes}
                                        onChange={e => setFormNotes(e.target.value)}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none outline-none focus:ring-2 ring-emerald-500/20 text-sm font-medium h-24 resize-none"
                                        placeholder="Beskriv passet..."
                                    />
                                </div>

                                <button
                                    onClick={handleSave}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {editingActivity ? 'Uppdatera Pass' : 'Spara Pass'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Factual Activity Detail Modal */}
            {selectedFactualActivity && (
                <ActivityDetailModal
                    activity={selectedFactualActivity.entry}
                    universalActivity={selectedFactualActivity.universal}
                    onClose={() => setSelectedFactualActivity(null)}
                />
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
