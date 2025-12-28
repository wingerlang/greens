import React, { useState, useEffect } from 'react';
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
    UtensilsCrossed
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
    const radius = 80;
    const stroke = 8;
    const innerRadius = 60;
    const innerStroke = 6;

    // Outer (Calories)
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (Math.min(value, max * 1.5) / max) * circumference;
    const isOver = value > max;

    // Inner (Protein)
    const normalizedInnerRadius = innerRadius - innerStroke * 2;
    const innerCircumference = normalizedInnerRadius * 2 * Math.PI;
    const innerStrokeDashoffset = innerCircumference - (Math.min(innerValue, innerMax) / innerMax) * innerCircumference;
    const isProteinMet = innerValue >= innerMax;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                height={radius * 2}
                width={radius * 2}
                className="transform -rotate-90"
            >
                {/* Outer Background */}
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800"
                    strokeWidth={stroke}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
                {/* Outer Progress (Calories) */}
                <circle
                    stroke="currentColor"
                    className={`${isOver ? 'text-rose-500' : 'text-slate-900 dark:text-white'} transition-colors duration-500`}
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />

                {/* Inner Background */}
                <circle
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800/50"
                    strokeWidth={innerStroke}
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={radius}
                    cy={radius}
                />
                {/* Inner Progress (Protein) */}
                <circle
                    stroke="currentColor"
                    className={`${isProteinMet ? 'text-emerald-500' : 'text-orange-400'} transition-colors duration-500`}
                    strokeWidth={innerStroke}
                    strokeDasharray={innerCircumference + ' ' + innerCircumference}
                    style={{ strokeDashoffset: innerStrokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedInnerRadius}
                    cx={radius}
                    cy={radius}
                />
            </svg>
            <div className="absolute text-center flex flex-col items-center">
                <div className={`text-4xl font-bold leading-none ${isOver ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                    {Math.round(value)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">/ {max} kcal</div>

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
    const { settings } = useSettings();
    const {
        exerciseEntries,
        plannedActivities,
        getVitalsForDate,
        updateVitals,
        deleteExercise
    } = useData();

    const today = getISODate();
    const health = useHealth(today);

    // Local state for interactivity
    const [vitals, setVitals] = useState<DailyVitals>({ water: 0, sleep: 0, caffeine: 0, updatedAt: '' });
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [selectedActivity, setSelectedActivity] = useState<any>(null);

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

    const handleSave = (type: keyof DailyVitals) => {
        const val = parseFloat(tempValue);
        if (!isNaN(val)) {
            updateVitals(today, { [type]: val });
            setVitals(prev => ({ ...prev, [type]: val }));
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: keyof DailyVitals) => {
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

    // --- Derived Data ---

    // 1. Calories
    const consumed = health.dailyCaloriesConsumed || 0;
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
        const goalMet = totalDuration >= 60; // Hardcoded goal for now, could be dynamic

        trainingContent = (
            <div className={`flex flex-col gap-3 w-full -m-4 p-4 rounded-3xl transition-colors ${goalMet ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                {/* Summary Header */}
                <div className="flex justify-between items-end mb-1 px-1">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Totalt</div>
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-white">{totalDuration} min</span>
                        <span className="mx-1 opacity-30">|</span>
                        <span>{totalCalories} kcal</span>
                    </div>
                </div>

                {completedTraining.map((act) => {
                    const typeDef = EXERCISE_TYPES.find(t => t.type === act.type);

                    // Formatting helper for advanced metrics
                    let details = `${act.durationMinutes} min`;
                    if (act.type === 'running' && act.distance) {
                        const pace = act.durationMinutes / act.distance;
                        const paceMin = Math.floor(pace);
                        const paceSec = Math.round((pace - paceMin) * 60);
                        const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
                        details = `${act.distance} km • ${paceStr}/km`;
                    } else if (act.type === 'strength' && act.tonnage) {
                        details = `${act.durationMinutes} min • ${(act.tonnage / 1000).toFixed(1)} ton`;
                    }

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
                            className="flex items-center gap-3 group/item cursor-pointer hover:bg-white dark:hover:bg-slate-800 p-3 rounded-2xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-sm relative bg-white/40 dark:bg-slate-900/40"
                        >
                            <div className="text-xl p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                                {typeDef?.icon || '💪'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white leading-tight capitalize flex items-center gap-2 truncate">
                                    {typeDef?.label || act.type}
                                    {hrString && <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded tracking-wide">{hrString}</span>}
                                </div>
                                <div className="text-xs text-slate-500 font-medium truncate">
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
    const streakDays = 12;

    // Sleep Color Logic
    const sleepInfo = analyzeSleep(vitals.sleep || 0);
    const sleepColorMap: Record<string, string> = {
        rose: 'text-rose-500',
        amber: 'text-amber-500',
        emerald: 'text-emerald-500',
        slate: 'text-slate-900 dark:text-white'
    };
    const sleepColorClass = vitals.sleep > 0 ? (sleepColorMap[sleepInfo.color] || 'text-slate-900') : 'text-slate-900 dark:text-white';

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-12 font-sans text-slate-900 dark:text-white animate-in fade-in duration-500 transition-colors">
            <div className="max-w-5xl mx-auto">
                <header className="mb-10 flex justify-between items-center">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">Idag</h1>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800">
                        {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                    {/* LEFT COLUMN (Gauge + Streak) */}
                    <div className="md:col-span-5 flex flex-col gap-6">

                        {/* Main KPI Card */}
                        <div className="flex items-start gap-4 p-4 border rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                            <DoubleCircularProgress
                                value={consumed}
                                max={target}
                                innerValue={proteinCurrent}
                                innerMax={proteinTarget}
                                label="Protein" // Unused directly but good for semantics
                                subLabel={
                                    <span>
                                        {Math.round(consumed - target)} kcal
                                    </span>
                                }
                            />
                            <div className="flex-1 py-1">
                                <div className="text-sm font-bold text-slate-900 dark:text-white mb-2">Dagens Intag</div>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-500">Protein</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{Math.round(proteinCurrent)} / {proteinTarget}g</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((proteinCurrent / proteinTarget) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-500">Kalorier</span>
                                            <span className={`font-bold ${consumed > target ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{Math.round(consumed)} / {target}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${consumed > target ? 'bg-rose-500' : 'bg-slate-900 dark:bg-white'}`} style={{ width: `${Math.min((consumed / target) * 100, 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Streak Card */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center min-h-[160px]">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400">
                                    <Flame className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Streak träningsmål</span>
                            </div>
                            <div className="text-4xl font-bold text-slate-900 dark:text-white mb-5">{streakDays} Dagar</div>

                            {/* Visual Streak Chain */}
                            <div className="flex gap-1.5 justify-between">
                                {Array.from({ length: 10 }).map((_, i) => {
                                    const active = i < 8; // Mock active state
                                    return (
                                        <div
                                            key={i}
                                            className={`h-8 w-full rounded-md flex items-center justify-center transition-all
                                                ${active
                                                    ? 'bg-slate-800 dark:bg-emerald-600 text-white shadow-sm'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700'
                                                }`}
                                        >
                                            {active && <Check className="w-4 h-4" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN (Info Cards Stack) */}
                    <div className="md:col-span-7 flex flex-col gap-4">

                        {/* Sleep */}
                        <div
                            onClick={() => handleCardClick('sleep', vitals.sleep || 0)}
                            className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-6 hover:scale-[1.01] transition-transform cursor-pointer group relative"
                        >
                            <div className="w-14 h-14 bg-[#E0E7FF] dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Moon className="w-7 h-7" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Nattens sömn</div>
                                {editing === 'sleep' ? (
                                    <div className="flex items-baseline gap-2" onClick={e => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            type="number"
                                            step="0.5"
                                            value={tempValue}
                                            onChange={(e) => setTempValue(e.target.value)}
                                            onBlur={() => handleSave('sleep')}
                                            onKeyDown={(e) => handleKeyDown(e, 'sleep')}
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-2xl font-bold text-slate-900 dark:text-white p-1 w-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <span className="text-xs text-slate-400">h</span>
                                    </div>
                                ) : (
                                    <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        {vitals.sleep} <span className="text-base font-medium text-slate-400">h</span>
                                        {(vitals.sleep || 0) >= 7 && (vitals.sleep || 0) <= 10 && <Check size={18} className="text-emerald-500" />}
                                        {(vitals.sleep || 0) > 10 && <span className="text-[10px] text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Kanske för mycket?</span>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Training */}
                        <div
                            onClick={() => navigate('/training')}
                            className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-6 hover:scale-[1.01] transition-transform cursor-pointer group"
                        >
                            <div className="w-14 h-14 bg-[#DCFCE7] dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors">
                                <Dumbbell className="w-7 h-7" />
                            </div>
                            <div className="flex-1">
                                <div className="text-sm text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Dagens träning</div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{trainingContent}</div>
                            </div>
                        </div>

                        {/* Water (Segments) */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-6 hover:scale-[1.01] transition-transform group">
                            <div className="w-14 h-14 bg-[#CFFAFE] dark:bg-cyan-900/30 rounded-full flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                                <Droplets className="w-7 h-7" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-baseline mb-2">
                                    <div className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Vatten</div>
                                    <div className="text-xl font-bold text-slate-900 dark:text-white">{vitals.water} <span className="text-xs text-slate-400 font-normal">glas</span></div>
                                </div>
                                <div className="flex gap-1.5 h-8">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div
                                            key={i}
                                            onClick={() => handleWaterClick(i)}
                                            className={`flex-1 rounded-md cursor-pointer transition-all border border-transparent ${(vitals.water || 0) >= i
                                                ? 'bg-cyan-400 shadow-sm dark:shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Caffeine (Quick Add) */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-6 hover:scale-[1.01] transition-transform group">
                            <div className="w-14 h-14 bg-[#FEF3C7] dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Coffee className="w-7 h-7" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Koffein</div>
                                        <div
                                            onClick={() => handleCardClick('caffeine', vitals.caffeine || 0)}
                                            className="text-3xl font-bold text-slate-900 dark:text-white leading-none cursor-pointer"
                                        >
                                            {vitals.caffeine || 0} <span className="text-base font-medium text-slate-400">mg</span>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCaffeineAdd(100, 'coffee'); }}
                                            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 text-xl transition-colors"
                                            title="+1 Kaffe (100mg)"
                                        >
                                            ☕
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleCaffeineAdd(180, 'nocco'); }}
                                            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-900/30 text-xl transition-colors"
                                            title="+1 Nocco (180mg)"
                                        >
                                            🥤
                                        </button>
                                    </div>
                                </div>
                                {editing === 'caffeine' && (
                                    <div className="mt-2 flex items-baseline gap-2">
                                        <input
                                            autoFocus
                                            type="number"
                                            value={tempValue}
                                            onChange={(e) => setTempValue(e.target.value)}
                                            onBlur={() => handleSave('caffeine')}
                                            onKeyDown={(e) => handleKeyDown(e, 'caffeine')}
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-lg font-bold text-slate-900 dark:text-white p-1 w-20 focus:ring-2 focus:ring-amber-500 outline-none"
                                        />
                                        <span className="text-xs text-slate-500">Manuell inmatning</span>
                                    </div>
                                )}
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
