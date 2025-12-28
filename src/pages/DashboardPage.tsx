import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate, DailyVitals } from '../models/types.ts';
import { useNavigate } from 'react-router-dom';
import { analyzeSleep } from '../utils/vitalsUtils.ts';
import { EXERCISE_TYPES } from '../components/training/ExerciseModal.tsx';
import {
    Dumbbell,
    Moon,
    Droplets,
    Coffee,
    Flame,
    Check,
    ChevronRight,
    X,
    AlertCircle,
    UtensilsCrossed,
    Zap,
    Wine,
    Calendar,
    Target
} from 'lucide-react';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';

// --- Sub-Components (Defined outside to prevent re-mounting) ---

// Enhanced Double Circular Progress
const DoubleCircularProgress = ({
    value,
    max,
    innerValue,
    innerMax,
    label,
    subLabel
}: {
    value: number,
    max: number,
    innerValue: number,
    innerMax: number,
    label: string,
    subLabel: React.ReactNode
}) => {
    const isProteinMet = innerValue >= innerMax;
    const isOver = value > max;

    const { settings } = useSettings();
    const density = settings.densityMode || 'cozy';

    // Density mapping
    const sizes = {
        compact: {
            radius: 50,
            stroke: 6,
            innerRadius: 36,
            innerStroke: 4,
            text: 'text-2xl',
            icon: 16
        },
        slim: {
            radius: 85,
            stroke: 9,
            innerRadius: 65,
            innerStroke: 6,
            text: 'text-4xl',
            icon: 24
        },
        cozy: {
            radius: 110,
            stroke: 12,
            innerRadius: 85,
            innerStroke: 10,
            text: 'text-5xl',
            icon: 28
        }
    }[density];

    const r = sizes.radius;
    const s = sizes.stroke;
    const ir = sizes.innerRadius;
    const is = sizes.innerStroke;

    const normalizedRadius = r - s * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.min(value, max * 1.5) / max) * circumference;

    const normalizedInnerRadius = ir - is * 2;
    const innerCircumference = normalizedInnerRadius * 2 * Math.PI;
    const innerStrokeDashoffset = innerCircumference - (Math.min(innerValue, innerMax) / innerMax) * innerCircumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                height={r * 2}
                width={r * 2}
                className="transform -rotate-90"
            >
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth={s}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={r}
                    cy={r}
                />
                <circle
                    stroke="currentColor"
                    className={`${isOver ? 'text-rose-500' : 'text-slate-900 dark:text-white'} transition-colors duration-500`}
                    strokeWidth={s}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={r}
                    cy={r}
                />
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800/50"
                    strokeWidth={is}
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={r}
                    cy={r}
                />
                <circle
                    stroke="currentColor"
                    className={`${isProteinMet ? 'text-emerald-500' : 'text-orange-400'} transition-colors duration-500`}
                    strokeWidth={is}
                    strokeDasharray={innerCircumference + ' ' + innerCircumference}
                    style={{ strokeDashoffset: innerStrokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={r}
                    cy={r}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
                <div className={`${sizes.text} font-bold leading-none ${isOver ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                    {Math.round(value)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    <div className={`w-2 h-2 rounded-full ${isProteinMet ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                    <span className="text-slate-700 dark:text-slate-300">
                        {Math.round(innerValue)}/{innerMax}g
                    </span>
                </div>

                {/* Micro-nutrient indicator (mock) */}
                <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/50" />
                    ))}
                </div>
            </div>
        </div>
    );
};

// No longer using generic InfoCard, but keeping the concept in the main render if needed? 
// Actually I replaced usages of InfoCard with inline code in the previous version (Step 1722), 
// but defined it anyway. I will remove it if unused, or keep it if I use it.
// Looking at previous code, I didn't actually use InfoCard in the return statement! 
// I mainly used the inline divs. So I will omit InfoCard to clean up.

export function DashboardPage() {
    const navigate = useNavigate();
    const { settings, setDensityMode } = useSettings();
    const density = settings.densityMode || 'cozy';
    const {
        getVitalsForDate,
        updateVitals,
        deleteExercise,
        calculateStreak,
        calculateTrainingStreak,
        calculateWeeklyTrainingStreak,
        calculateCalorieGoalStreak,
        calculateDailyNutrition,
        getLatestWeight,
        addWeightEntry,
        plannedActivities,
        exerciseEntries
    } = useData();

    const today = getISODate();
    const health = useHealth(today);

    // Local state for interactivity
    const [vitals, setVitals] = useState<DailyVitals>({ water: 0, sleep: 0, caffeine: 0, alcohol: 0, updatedAt: '' });
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [selectedActivity, setSelectedActivity] = useState<any>(null);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedSave = useCallback((type: string, value: number) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            updateVitals(today, { [type]: value });
        }, 1000);
    }, [today, updateVitals]);

    // Load data whenever context changes or date changes
    useEffect(() => {
        const currentVitals = getVitalsForDate(today);
        setVitals(currentVitals);
    }, [today, getVitalsForDate]);

    // Handlers
    const handleCardClick = (type: string, currentValue: number) => {
        setEditing(type);
        setTempValue(currentValue.toString());
    };

    const handleSave = (type: string) => {
        const val = parseFloat(tempValue);
        if (!isNaN(val)) {
            updateVitals(today, { [type]: val });
            setVitals(prev => ({ ...prev, [type]: val }));
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: string) => {
        if (e.key === 'Enter') handleSave(type);
        if (e.key === 'Escape') setEditing(null);
    };

    // --- Specific Quick Handlers ---
    const handleWaterClick = (count: number) => {
        const newVal = vitals.water === count ? count - 1 : count;
        updateVitals(today, { water: newVal });
        setVitals(prev => ({ ...prev, water: newVal }));
    };

    const handleCaffeineAdd = (amount: number, type: 'coffee' | 'nocco') => {
        const current = vitals.caffeine || 0;
        updateVitals(today, { caffeine: current + amount });
        setVitals(prev => ({ ...prev, caffeine: current + amount }));
    };

    const handleAlcoholAdd = (amount: number) => {
        const current = vitals.alcohol || 0;
        updateVitals(today, { alcohol: current + amount });
        setVitals(prev => ({ ...prev, alcohol: current + amount }));
    };

    const handleAlcoholClick = (count: number) => {
        const newVal = vitals.alcohol === count ? count - 1 : count;
        updateVitals(today, { alcohol: newVal });
        setVitals(prev => ({ ...prev, alcohol: newVal }));
    };

    // --- Derived Data ---

    // 1. Calories
    const consumed = health.dailyCaloriesConsumed || 0;
    const burned = health.dailyCaloriesBurned || 0;
    const target = health.targetCalories || 2500;

    // 2. Protein Calculation
    const proteinTarget = settings.dailyProteinGoal || 160;
    const proteinCurrent = Math.round(consumed * 0.05); // Raw value
    const proteinDisplay = Math.min(proteinTarget, proteinCurrent); // Clamped for progress bar

    // 4. Training Analysis
    const todaysPlan = plannedActivities.find(p => p.date === today);
    const completedTraining = exerciseEntries.filter(e => e.date === today);

    // Determine Training Card Content
    let trainingContent;
    if (completedTraining.length > 0) {
        // Show list of completed activities
        // Show list of completed activities
        const totalDuration = completedTraining.reduce((sum, act) => sum + act.durationMinutes, 0);
        const totalCalories = completedTraining.reduce((sum, act) => sum + act.caloriesBurned, 0);
        const totalDistance = completedTraining.reduce((sum, act) => sum + (act.distance || 0), 0);
        const totalTonnage = completedTraining.reduce((sum, act) => sum + (act.tonnage || 0), 0);
        const goalMet = totalDuration >= (settings.dailyTrainingGoal || 60);

        trainingContent = (
            <div className={`flex flex-col ${density === 'compact' ? 'gap-1 w-full p-1 rounded-xl shadow-none' : density === 'slim' ? 'gap-2 w-full p-2 rounded-2xl' : 'gap-3 w-full p-4 rounded-3xl'} transition-colors ${goalMet ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                {/* Summary Header */}
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1 px-1">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Dagens Totalt</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-white">{totalDuration} min</span>
                        <span className="opacity-20">|</span>
                        <span>{totalCalories} kcal</span>
                        {totalDistance > 0 && (
                            <>
                                <span className="opacity-20">|</span>
                                <span className="text-blue-600 dark:text-blue-400 font-bold">{totalDistance.toFixed(1)} km</span>
                            </>
                        )}
                        {totalTonnage > 0 && (
                            <>
                                <span className="opacity-20">|</span>
                                <span className="text-purple-600 dark:text-purple-400 font-bold">{(totalTonnage / 1000).toFixed(1)} ton</span>
                            </>
                        )}
                    </div>
                </div>

                {completedTraining.map((act) => {
                    const typeDef = EXERCISE_TYPES.find(t => t.type === act.type);

                    // Formatting helper for advanced metrics
                    const metricParts = [];
                    metricParts.push(`${act.durationMinutes} min`);

                    if (act.distance) {
                        if (act.type === 'running') {
                            const pace = act.durationMinutes / act.distance;
                            const paceMin = Math.floor(pace);
                            const paceSec = Math.round((pace - paceMin) * 60);
                            const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
                            metricParts.push(`${act.distance} km`);
                            metricParts.push(`${paceStr}/km`);
                        } else {
                            metricParts.push(`${act.distance} km`);
                        }
                    }

                    if (act.tonnage) {
                        metricParts.push(`${(act.tonnage / 1000).toFixed(1)} ton`);
                    }

                    const details = metricParts.join(' • ');

                    // Heart Rate if available
                    let hrString = '';
                    if (act.heartRateAvg) {
                        hrString = `HR ${act.heartRateAvg}`;
                        if (act.heartRateMax) hrString += `/${act.heartRateMax}`;
                    }

                    return (
                        <div
                            key={act.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedActivity(act);
                            }}
                            className={`flex items-center ${density === 'compact' ? 'gap-1.5 p-1 rounded-lg' : 'gap-3 p-3 rounded-2xl'} group/item cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-sm relative bg-white/40 dark:bg-slate-900/40`}
                        >
                            <div className={`${density === 'compact' ? 'text-sm p-1' : 'text-xl p-2'} bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50`}>
                                {typeDef?.icon || '💪'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white leading-tight capitalize flex items-center gap-2 truncate">
                                    {typeDef?.label || act.type}
                                    {hrString && <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded tracking-wide">{hrString}</span>}
                                </div>
                                <div className="text-xs text-slate-500 font-medium">
                                    {details}
                                </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-all">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('Ta bort aktivitet?')) {
                                            deleteExercise(act.id);
                                        }
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-colors"
                                >
                                    <X size={14} />
                                </button>
                                <ChevronRight size={14} className="text-slate-300" />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    } else if (todaysPlan) {
        // Show Planned
        let icon = '📅';
        let label = todaysPlan.type as string; // defaults to existing type string if match fails

        if (todaysPlan.type === 'RUN') {
            const runDef = EXERCISE_TYPES.find(t => t.type === 'running');
            icon = runDef?.icon || '🏃';
            label = 'Löpning';
        }

        trainingContent = (
            <div className="flex items-center gap-4 opacity-75">
                <div className="text-2xl grayscale">{icon}</div>
                <div>
                    <div className="font-bold text-slate-900 dark:text-white leading-tight">Planerat: {label}</div>
                    <div className="text-xs text-slate-500 font-medium italic">
                        {todaysPlan.estimatedDistance ? `${todaysPlan.estimatedDistance} km` : 'Dagens pass'}
                        {todaysPlan.category ? ` • ${todaysPlan.category}` : ''}
                    </div>
                </div>
            </div>
        );
    } else {
        // Rest
        trainingContent = (
            <div>
                <div className="font-bold text-slate-900 dark:text-white">Vila</div>
                <div className="text-xs text-slate-500">Ingen planerad träning</div>
            </div>
        );
    }

    // 7. Streak
    const streakDays = calculateStreak();
    const trainingStreak = calculateTrainingStreak();
    const weeklyStreak = calculateWeeklyTrainingStreak();
    const calorieStreak = calculateCalorieGoalStreak();

    // Sleep Color Logic
    const sleepInfo = analyzeSleep(vitals.sleep || 0);
    const sleepColorMap: Record<string, { text: string, accent: string }> = {
        rose: { text: 'text-rose-500', accent: 'accent-rose-500' },
        amber: { text: 'text-amber-500', accent: 'accent-amber-500' },
        emerald: { text: 'text-emerald-500', accent: 'accent-emerald-500' },
        slate: { text: 'text-slate-900 dark:text-white', accent: 'accent-slate-500' }
    };
    const sleepClasses = vitals.sleep > 0 ? (sleepColorMap[sleepInfo.color] || sleepColorMap.slate) : sleepColorMap.slate;
    const sleepColorClass = sleepClasses.text;

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-12 font-sans text-slate-900 dark:text-white animate-in fade-in duration-500 transition-colors">
            <div className="max-w-5xl mx-auto">
                <header className={`${density === 'compact' ? 'mb-4' : 'mb-10'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                    <div>
                        <h1 className={`${density === 'compact' ? 'text-2xl' : 'text-4xl md:text-5xl'} font-bold tracking-tight text-slate-900 dark:text-white`}>Idag</h1>
                        <div className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wider opacity-60">
                            {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                        {(['compact', 'slim', 'cozy'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setDensityMode(m)}
                                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${density === m
                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                            >
                                {m === 'compact' ? 'Tiny' : m === 'slim' ? 'Slim' : 'Cozy'}
                            </button>
                        ))}
                    </div>
                </header>

                <div className={`grid grid-cols-1 md:grid-cols-12 ${density === 'compact' ? 'gap-3' : density === 'slim' ? 'gap-4' : 'gap-6'} items-start`}>
                    {/* 7-Day Performance Summary */}
                    <div className="md:col-span-12 mb-2">
                        <div className={`${density === 'compact' ? 'p-2' : 'p-6'} bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm`}>
                            <div className={`flex flex-col md:flex-row md:justify-between md:items-center ${density === 'compact' ? 'mb-2 px-2' : 'mb-6 px-1'}`}>
                                <div className="flex items-center gap-3">
                                    <h3 className={`${density === 'compact' ? 'text-[10px]' : 'text-sm'} font-black uppercase tracking-tighter text-slate-400 flex items-center gap-2`}>
                                        <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                        Senaste 7 Dagarna
                                    </h3>
                                    {density === 'compact' && (() => {
                                        const last7 = Array.from({ length: 7 }).map((_, i) => {
                                            const d = new Date();
                                            d.setDate(d.getDate() - i);
                                            return d.toISOString().split('T')[0];
                                        });
                                        const weeklyEx = exerciseEntries.filter(e => last7.includes(e.date));

                                        // Manual calorie sum to avoid hook violation
                                        let totalCals = 0;
                                        last7.forEach(iso => {
                                            const nutrition = calculateDailyNutrition(iso);
                                            totalCals += nutrition.calories;
                                        });

                                        const totalDur = weeklyEx.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
                                        const totalDist = weeklyEx.reduce((sum, e) => sum + (e.distance || 0), 0);
                                        const totalTon = weeklyEx.reduce((sum, e) => sum + (e.tonnage || 0), 0);
                                        return (
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full overflow-hidden whitespace-nowrap opacity-60">
                                                {Math.floor(totalDur / 60)}h {totalDur % 60}m | {Math.round(totalCals)} kcal | {totalDist.toFixed(1)} km | {(totalTon / 1000).toFixed(1)} t
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Träning</span>
                                    </div>
                                    {density !== 'compact' && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30"></div>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Idag</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={`grid grid-cols-7 ${density === 'compact' ? 'gap-1' : 'gap-3'}`}>
                                {Array.from({ length: 7 }).map((_, i) => {
                                    const date = new Date();
                                    date.setDate(date.getDate() - (6 - i));
                                    const iso = date.toISOString().split('T')[0];
                                    const isDayToday = iso === today;

                                    // Data aggregation for day i
                                    const dayExercises = exerciseEntries.filter(e => e.date === iso);
                                    const dayNutrition = calculateDailyNutrition(iso);

                                    const dist = dayExercises.reduce((sum, e) => sum + (e.distance || 0), 0);
                                    const ton = dayExercises.reduce((sum, e) => sum + (e.tonnage || 0), 0);
                                    const duration = dayExercises.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
                                    const speed = duration > 0 ? (dist / (duration / 60)) : 0;
                                    const calPercentage = Math.min((dayNutrition.calories || 0) / (settings.dailyCalorieGoal || 2000), 1.2);

                                    return (
                                        <div key={iso} className={`flex flex-col items-center ${isDayToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10 outline outline-1 outline-indigo-500/20' : ''} rounded-xl ${density === 'compact' ? 'p-1' : 'p-2'} transition-colors border border-transparent group/day relative`}>
                                            <span className={`${density === 'compact' ? 'text-[8px]' : 'text-[10px]'} font-bold text-slate-400 uppercase mb-1`}>
                                                {date.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '')}
                                            </span>

                                            <div className="flex flex-col items-center gap-1.5 w-full">
                                                {/* Calorie Performance Bar */}
                                                <div className={`w-full ${density === 'compact' ? 'h-1' : 'h-1.5'} bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden`}>
                                                    <div
                                                        className={`h-full rounded-full transition-all ${calPercentage > 1.05 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                                        style={{ width: `${Math.max(calPercentage * 100, 5)}%` }}
                                                    />
                                                </div>

                                                {/* Activity Indicators */}
                                                <div className="flex gap-0.5 mt-0.5">
                                                    {dayExercises.length > 0 && <div className={`${density === 'compact' ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full bg-blue-500`}></div>}
                                                    {dist > 0 && <div className={`${density === 'compact' ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full bg-cyan-400`}></div>}
                                                    {ton > 0 && <div className={`${density === 'compact' ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full bg-purple-500`}></div>}
                                                </div>

                                                {/* Detailed Hover Info */}
                                                <div className="hidden group-hover/day:flex flex-col items-center leading-tight absolute -bottom-14 bg-slate-800 text-white p-2 rounded-lg text-[8px] z-50 shadow-2xl whitespace-nowrap border border-white/10">
                                                    {dayExercises.length > 0 && <div className="font-bold">{dayExercises.length} pass</div>}
                                                    {dist > 0 && <div className="text-cyan-400">{dist.toFixed(1)} km @ {speed.toFixed(1)} km/h</div>}
                                                    {duration > 0 && <div className="text-slate-300">{duration} min</div>}
                                                    {ton > 0 && <div className="text-purple-400">{(ton / 1000).toFixed(1)} ton</div>}
                                                </div>

                                                {(density === 'cozy' || (density === 'slim' && (dist > 0 || ton > 0))) && (
                                                    <div className="flex flex-col items-center leading-none">
                                                        {dist > 0 && <span className="text-[8px] font-black text-blue-600 dark:text-blue-400">{dist.toFixed(0)}k</span>}
                                                        {ton > 0 && <span className="text-[8px] font-black text-purple-600 dark:text-purple-400">{(ton / 1000).toFixed(0)}t</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Written Weekly Summary */}
                            {(() => {
                                const last7 = Array.from({ length: 7 }).map((_, i) => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - i);
                                    return d.toISOString().split('T')[0];
                                });
                                const weeklyEx = exerciseEntries.filter(e => last7.includes(e.date));
                                const totalDist = weeklyEx.reduce((sum, e) => sum + (e.distance || 0), 0);
                                const totalTon = weeklyEx.reduce((sum, e) => sum + (e.tonnage || 0), 0);
                                const totalDur = weeklyEx.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
                                const totalPass = weeklyEx.length;

                                return (
                                    <div className={`mt-6 pt-4 border-t border-slate-50 dark:border-slate-800/50 grid grid-cols-2 md:grid-cols-4 gap-4 ${density === 'compact' ? 'hidden' : ''}`}>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Tid</span>
                                            <span className="text-lg font-black text-slate-900 dark:text-white leading-none whitespace-nowrap">{Math.floor(totalDur / 60)}h {totalDur % 60}m</span>
                                            <span className="text-[10px] text-slate-400 font-bold mt-1">{totalPass} Slutförda pass</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Volym</span>
                                            <span className="text-lg font-black text-purple-600 dark:text-purple-400 leading-none whitespace-nowrap">{(totalTon / 1000).toFixed(1)} Ton</span>
                                            <span className="text-[10px] text-slate-400 font-bold mt-1">Styrketräning</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Distans</span>
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400 leading-none whitespace-nowrap">{totalDist.toFixed(1)} Km</span>
                                            <span className="text-[10px] text-slate-400 font-bold mt-1">Löpning / Gång</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-100 dark:border-slate-800 pl-4">
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Fördelning</span>
                                            {(() => {
                                                const runEx = weeklyEx.filter(e => e.type === 'running' || e.type === 'walking');
                                                const strengthEx = weeklyEx.filter(e => e.type === 'strength' || e.type === 'yoga');
                                                const runMin = runEx.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
                                                const strengthMin = strengthEx.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
                                                return (
                                                    <>
                                                        <span className="text-lg font-black text-slate-900 dark:text-white leading-none whitespace-nowrap">
                                                            {runEx.length}<span className="text-[10px] text-slate-400 mx-1">/</span>{strengthEx.length} <span className="text-[10px] uppercase text-slate-400">pass</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold mt-1">
                                                            {Math.round(runMin / 60)}h <span className="opacity-40">vs</span> {Math.round(strengthMin / 60)}h
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* KPI Card */}
                    <div className={`md:col-span-8 flex items-start ${density === 'compact' ? 'gap-2 p-2' : 'gap-4 p-4'} border rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800 h-full`}>
                        <DoubleCircularProgress
                            value={consumed}
                            max={target}
                            innerValue={proteinCurrent}
                            innerMax={proteinTarget}
                            label="Protein"
                            subLabel={<span>{Math.round(consumed - target)} kcal</span>}
                        />
                        <div className="flex-1 py-0.5 ml-4 max-w-[180px]">
                            <div className={`font-black text-slate-900 dark:text-white uppercase tracking-tighter ${density === 'compact' ? 'text-[10px] mb-2' : 'text-sm mb-4'}`}>Dagens Intag</div>
                            <div className={`${density === 'compact' ? 'space-y-4' : 'space-y-6'}`}>
                                <div>
                                    <div className={`flex justify-between items-baseline mb-1`}>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protein</span>
                                        <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-xl'} text-slate-900 dark:text-white`}>
                                            {Math.round(proteinCurrent)}<span className="text-[10px] text-slate-400 ml-0.5">/ {proteinTarget}g</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${Math.min((proteinCurrent / proteinTarget) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className={`flex justify-between items-baseline mb-1`}>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kalorier</span>
                                        <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-xl'} ${consumed > target ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                                            {Math.round(consumed)}<span className="text-[10px] text-slate-400 ml-0.5">/ {target}</span>
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-700 ${consumed > target ? 'bg-rose-500' : 'bg-slate-900 dark:bg-white'}`} style={{ width: `${Math.min((consumed / target) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sleep & Alcohol Grouped Container */}
                    <div className="md:col-span-4 flex flex-col gap-4">
                        <div className={`grid ${density === 'compact' ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-4'}`}>
                            {/* Sleep Card */}
                            <div
                                onClick={() => handleCardClick('sleep', vitals.sleep || 0)}
                                className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:scale-[1.01] transition-transform cursor-pointer group relative overflow-hidden h-full ${(vitals.sleep || 0) > 0 && (vitals.sleep || 0) < 5
                                    ? 'bg-rose-50 dark:bg-rose-900/10'
                                    : (vitals.sleep || 0) >= 5 && (vitals.sleep || 0) < 7
                                        ? 'bg-amber-50 dark:bg-amber-900/10'
                                        : (vitals.sleep || 0) >= 7 && (vitals.sleep || 0) <= 10
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                            : 'bg-white dark:bg-slate-900'
                                    }`}
                            >
                                <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'}`}>
                                    <div className={`p-1.5 rounded-full ${(vitals.sleep || 0) > 0 && (vitals.sleep || 0) < 5
                                        ? 'bg-rose-100 text-rose-600'
                                        : (vitals.sleep || 0) >= 5 && (vitals.sleep || 0) < 7
                                            ? 'bg-amber-100 text-amber-600'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                        }`}>
                                        <Moon className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Sömn</span>
                                </div>
                                <div className="flex-1">
                                    {editing === 'sleep' ? (
                                        <div className="flex flex-col gap-2 pt-1" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50 px-2 py-1 rounded-lg">
                                                <span className={`text-xs font-black ${sleepColorClass}`}>{parseFloat(tempValue).toFixed(1)}h</span>
                                            </div>
                                            <input
                                                autoFocus
                                                type="range"
                                                min="0"
                                                max="12"
                                                step="0.5"
                                                value={tempValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTempValue(val);
                                                    const num = parseFloat(val);
                                                    if (!isNaN(num)) {
                                                        setVitals(prev => ({ ...prev, sleep: num }));
                                                        debouncedSave('sleep', num);
                                                    }
                                                }}
                                                onBlur={() => setEditing(null)}
                                                className={`w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer ${sleepClasses.accent} transition-all`}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${sleepColorClass}`}>{vitals.sleep || 0}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">H</span>
                                            </div>
                                            {density !== 'compact' && (vitals.sleep || 0) > 0 && (
                                                <div className="mt-1 text-[8px] font-black uppercase tracking-tight opacity-60">
                                                    {sleepInfo.status}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Alcohol Card (Inline in the 4-col group) */}
                            {(() => {
                                const dayOfWeek = (new Date()).getDay();
                                const isWeekendLimit = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Sun, Fri or Sat
                                const alcLimit = isWeekendLimit ? settings.dailyAlcoholLimitWeekend : settings.dailyAlcoholLimitWeekday;
                                const alc = vitals.alcohol || 0;
                                const isAlcHigh = alcLimit !== undefined && alc > alcLimit;
                                const isAlcWarning = alcLimit !== undefined && !isAlcHigh && alc > 0 && alc === alcLimit;

                                return (
                                    <div
                                        onClick={() => handleCardClick('alcohol', alc)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden ${isAlcHigh
                                            ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'
                                            : isAlcWarning
                                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-between ${density === 'compact' ? 'mb-1' : 'mb-2'}`}>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`p-1.5 rounded-full ${isAlcHigh ? 'bg-rose-100 text-rose-600' : isAlcWarning ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                    <Wine className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                                                </div>
                                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Alk</span>
                                            </div>
                                            {density !== 'compact' && alcLimit !== undefined && alcLimit > 0 && (
                                                <div className="text-[8px] font-bold text-slate-400 tracking-tighter">Max: {alcLimit}</div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            {editing === 'alcohol' ? (
                                                <div className="flex gap-1 items-baseline" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={tempValue}
                                                        onChange={(e) => setTempValue(e.target.value)}
                                                        onBlur={() => handleSave('alcohol')}
                                                        onKeyDown={(e) => handleKeyDown(e, 'alcohol')}
                                                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">E</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${isAlcHigh ? 'text-rose-600' : isAlcWarning ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{alc}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">E</span>
                                                    </div>
                                                    <div className={`flex gap-0.5 mt-2 ${density === 'compact' ? 'h-1' : 'h-2'}`}>
                                                        {Array.from({ length: Math.max(alc, 4) }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newVal = (alc === i + 1) ? i : i + 1;
                                                                    updateVitals(today, { alcohol: newVal });
                                                                    setVitals(p => ({ ...p, alcohol: newVal }));
                                                                }}
                                                                className={`flex-1 rounded-full cursor-pointer transition-colors ${i < alc ? (isAlcHigh ? 'bg-rose-500' : 'bg-amber-400 shadow-sm') : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200'} `}
                                                            />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Water Card */}
                            {(() => {
                                const waterGoal = settings.dailyWaterGoal || 8;
                                const isWaterMet = (vitals.water || 0) >= waterGoal;
                                return (
                                    <div
                                        onClick={() => handleCardClick('water', vitals.water || 0)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden ${isWaterMet ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'}`}>
                                            <div className={`p-1.5 rounded-full ${isWaterMet ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-500'}`}>
                                                {isWaterMet ? <Check className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} /> : <Droplets className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />}
                                            </div>
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Vatten</span>
                                        </div>
                                        <div className="flex-1">
                                            {editing === 'water' ? (
                                                <div className="flex items-baseline gap-1" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={tempValue}
                                                        onChange={(e) => setTempValue(e.target.value)}
                                                        onBlur={() => handleSave('water')}
                                                        onKeyDown={(e) => handleKeyDown(e, 'water')}
                                                        className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    />
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Glas</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${isWaterMet ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>{vitals.water || 0}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Glas</span>
                                                    </div>
                                                    <div className={`flex gap-0.5 mt-2 ${density === 'compact' ? 'h-4' : 'h-8'}`}>
                                                        {Array.from({ length: 8 }).map((_, i) => (
                                                            <div key={i} onClick={(e) => { e.stopPropagation(); handleWaterClick(i + 1); }} className={`flex-1 rounded-sm cursor-pointer transition-all border border-transparent ${i < (vitals.water || 0) ? (isWaterMet ? 'bg-emerald-500' : 'bg-blue-400 shadow-sm') : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Caffeine Card */}
                            {(() => {
                                const caffeineLimit = settings.dailyCaffeineLimit || 400;
                                const caff = vitals.caffeine || 0;
                                const isCaffHigh = caff >= caffeineLimit;
                                const isCaffWarning = !isCaffHigh && caff >= caffeineLimit * 0.7;
                                return (
                                    <div
                                        onClick={() => handleCardClick('caffeine', vitals.caffeine || 0)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm hover:scale-[1.02] transition-all cursor-pointer overflow-hidden relative ${isCaffHigh ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' : isCaffWarning ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'}`}>
                                            <div className={`p-1.5 rounded-full ${isCaffHigh ? 'bg-rose-100 text-rose-600' : isCaffWarning ? 'bg-amber-100 text-amber-600' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}`}>
                                                <Coffee className={density === 'compact' ? 'w-3 h-3' : 'w-4 h-4'} />
                                            </div>
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Koffein</span>
                                        </div>
                                        <div className="flex-1">
                                            {editing === 'caffeine' ? (
                                                <div className="flex flex-col gap-2 pt-1" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-baseline gap-1">
                                                        <input
                                                            autoFocus
                                                            type="number"
                                                            value={tempValue}
                                                            onChange={(e) => setTempValue(e.target.value)}
                                                            onBlur={() => handleSave('caffeine')}
                                                            onKeyDown={(e) => handleKeyDown(e, 'caffeine')}
                                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-16 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        />
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Mg</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                                                            <button
                                                                onMouseDown={e => e.preventDefault()}
                                                                onClick={() => {
                                                                    const newVal = Math.max(0, (vitals.caffeine || 0) - 80);
                                                                    setVitals(p => ({ ...p, caffeine: newVal }));
                                                                    setTempValue(newVal.toString());
                                                                    updateVitals(today, { caffeine: newVal });
                                                                }} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-white dark:hover:bg-slate-700 rounded">-</button>
                                                            <span className="text-[10px] mx-0.5">☕</span>
                                                            <button
                                                                onMouseDown={e => e.preventDefault()}
                                                                onClick={() => {
                                                                    const newVal = (vitals.caffeine || 0) + 80;
                                                                    setVitals(p => ({ ...p, caffeine: newVal }));
                                                                    setTempValue(newVal.toString());
                                                                    updateVitals(today, { caffeine: newVal });
                                                                }} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-white dark:hover:bg-slate-700 rounded">+</button>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-md p-0.5">
                                                            <button
                                                                onMouseDown={e => e.preventDefault()}
                                                                onClick={() => {
                                                                    const newVal = Math.max(0, (vitals.caffeine || 0) - 180);
                                                                    setVitals(p => ({ ...p, caffeine: newVal }));
                                                                    setTempValue(newVal.toString());
                                                                    updateVitals(today, { caffeine: newVal });
                                                                }} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-white dark:hover:bg-slate-700 rounded">-</button>
                                                            <span className="text-[10px] mx-0.5">🥤</span>
                                                            <button
                                                                onMouseDown={e => e.preventDefault()}
                                                                onClick={() => {
                                                                    const newVal = (vitals.caffeine || 0) + 180;
                                                                    setVitals(p => ({ ...p, caffeine: newVal }));
                                                                    setTempValue(newVal.toString());
                                                                    updateVitals(today, { caffeine: newVal });
                                                                }} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-white dark:hover:bg-slate-700 rounded">+</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`${density === 'compact' ? 'text-xl' : 'text-3xl'} font-bold ${isCaffHigh ? 'text-rose-600' : isCaffWarning ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{vitals.caffeine || 0}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Mg</span>
                                                    </div>
                                                    <div className={`mt-2 flex gap-1 ${density === 'compact' || density === 'slim' ? 'opacity-0 h-0 hidden' : 'opacity-100'}`}>
                                                        <button onClick={(e) => { e.stopPropagation(); handleCaffeineAdd(80, 'coffee'); }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">+☕</button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleCaffeineAdd(180, 'nocco'); }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors">+🥤</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div
                        onClick={() => navigate('/training')}
                        className={`md:col-span-8 ${density === 'compact' ? 'p-1.5 gap-2 rounded-xl' : density === 'slim' ? 'p-3 gap-3 rounded-2xl' : 'p-6 gap-6 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex items-start hover:scale-[1.01] transition-transform cursor-pointer group bg-white dark:bg-slate-900 h-full`}
                    >
                        <div className={`${density === 'compact' ? 'w-8 h-8' : 'w-14 h-14'} bg-[#DCFCE7] dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors shrink-0`}>
                            <Dumbbell className={density === 'compact' ? 'w-4 h-4' : 'w-7 h-7'} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <div className={`${density === 'compact' ? 'text-[10px]' : 'text-sm'} text-slate-500 dark:text-slate-400 font-semibold mb-1`}>Dagens träning</div>
                            <div className="w-full">{trainingContent}</div>
                        </div>
                    </div>

                    {/* Health Metrics Card */}
                    <div className={`md:col-span-4 ${density === 'compact' ? 'p-3 rounded-2xl' : 'p-6 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between h-full`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-500/10 rounded-full text-blue-500">
                                    <Zap size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase text-slate-400">Hälsa</span>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] font-bold text-slate-400 uppercase">Aktuell vikt</div>
                                <div className="text-lg font-black text-slate-900 dark:text-white">{getLatestWeight() || '--'} <span className="text-[9px] font-bold text-slate-400">kg</span></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Balans</span>
                                <span className={`text-xs font-black ${consumed - burned > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {consumed - burned > 0 ? '+' : ''}{Math.round(consumed - burned)} kcal
                                </span>
                            </div>
                            <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${consumed - burned > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${Math.min(Math.abs((consumed - burned) / 2000) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={`md:col-span-12 ${density === 'compact' ? 'p-3 rounded-2xl' : 'p-6 rounded-[2rem]'} bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center`}>
                        <div className="flex flex-col md:flex-row gap-6">
                            {/* Main Activity Streak */}
                            <div className="flex-1 border-r border-slate-100 dark:border-slate-800 pr-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-500/10 rounded-full text-rose-500 ring-2 ring-rose-500/5">
                                            <Flame className={density === 'compact' ? 'w-4 h-4' : 'w-5 h-5'} />
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loggningsstreak</span>
                                            <div className={`${density === 'compact' ? 'text-xl' : 'text-2xl'} font-black text-slate-900 dark:text-white tracking-tighter`}>{streakDays} Dagar</div>
                                        </div>
                                    </div>
                                    {density !== 'compact' && (
                                        <div className="text-right">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Mål: 30</span>
                                            <div className="h-1 w-20 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((streakDays / 30) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1 justify-between">
                                    {Array.from({ length: 14 }).map((_, i) => (
                                        <div key={i} className={`${density === 'compact' ? 'h-4' : 'h-6'} flex-1 rounded-sm flex items-center justify-center transition-all border ${i < streakDays % 14 ? 'bg-slate-900 dark:bg-emerald-600 border-slate-800 dark:border-emerald-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-200 dark:text-slate-800'}`}>
                                            {i < streakDays % 14 ? <Check className="w-3 h-3 stroke-[3]" /> : <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="flex-[1.5] grid grid-cols-3 gap-4">
                                {/* Training Daily */}
                                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Dumbbell size={12} className="text-indigo-500" />
                                        <span className="text-[8px] font-bold uppercase text-slate-400">Träningsstreak</span>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">{trainingStreak} <span className="text-[10px] text-slate-400">dag</span></div>
                                </div>
                                {/* Training Weekly */}
                                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar size={12} className="text-emerald-500" />
                                        <span className="text-[8px] font-bold uppercase text-slate-400">Veckor i rad</span>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">{weeklyStreak} <span className="text-[10px] text-slate-400">v.</span></div>
                                </div>
                                {/* Calorie Streak */}
                                <div className="p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100/50 dark:border-rose-900/20">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Target size={12} className="text-rose-500" />
                                        <span className="text-[8px] font-bold uppercase text-slate-400">Kalorimål</span>
                                    </div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">{calorieStreak} <span className="text-[10px] text-slate-400">dag</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Activity Modal */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}
