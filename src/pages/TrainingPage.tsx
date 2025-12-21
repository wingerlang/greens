import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type ExerciseType,
    type ExerciseIntensity,
    WEEKDAY_LABELS
} from '../models/types.ts';
import { useSmartPlanner } from '../hooks/useSmartPlanner.ts';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate } from '../models/types.ts';
import {
    parseOmniboxInput,
    parseCycleString // Import
} from '../utils/nlpParser.ts';
import './TrainingPage.css';

const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

const INTENSITIES: { value: ExerciseIntensity; label: string; color: string }[] = [
    { value: 'low', label: 'Låg', color: 'text-slate-400' },
    { value: 'moderate', label: 'Medel', color: 'text-emerald-400' },
    { value: 'high', label: 'Hög', color: 'text-rose-400' },
    { value: 'ultra', label: 'Max', color: 'text-purple-400' },
];

export function TrainingPage() {
    const {
        exerciseEntries,
        weightEntries,
        addExercise,
        deleteExercise,
        addWeightEntry,
        getLatestWeight,
        calculateExerciseCalories,
        calculateBMR,
        addTrainingCycle,
        deleteTrainingCycle,
        trainingCycles,
        mealEntries,
        foodItems,
        recipes,
    } = useData();

    // Calculate daily nutrition (calories only) for the chart
    const dailyNutrition = useMemo(() => {
        const result: { date: string, calories: number }[] = [];
        const entriesByDate: Record<string, typeof mealEntries> = {};

        // Group entries by date
        mealEntries.forEach(entry => {
            if (!entriesByDate[entry.date]) entriesByDate[entry.date] = [];
            entriesByDate[entry.date].push(entry);
        });

        Object.keys(entriesByDate).forEach(date => {
            let calories = 0;
            entriesByDate[date].forEach(entry => {
                entry.items.forEach(item => {
                    let itemKcal = 0;
                    if (item.type === 'foodItem') {
                        const food = foodItems.find(f => f.id === item.referenceId);
                        if (food) {
                            // FoodItem: calories is usually per 100g/ml or per piece
                            const base = (food.unit === 'g' || food.unit === 'ml' || food.unit === 'l' || food.unit === 'kg') ? 100 : 1;
                            // Convert servings to amount? MealItem uses 'servings' but for raw food items it might be the quantity itself? 
                            // Check MealItem definition updates. It says 'servings'. 
                            // In the app usage, usually 'servings' is used as 'amount' for food items.
                            const quantity = item.servings;
                            itemKcal = (food.calories / base) * quantity;
                        }
                    } else if (item.type === 'recipe') {
                        const recipe = recipes.find(r => r.id === item.referenceId);
                        if (recipe) {
                            // Calculate recipe total calories
                            const recipeTotalKcal = recipe.ingredients.reduce((sum, ing) => {
                                const f = foodItems.find(fi => fi.id === ing.foodItemId);
                                if (!f) return sum;
                                const base = (f.unit === 'g' || f.unit === 'ml') ? 100 : 1; // Simplified unit handling
                                return sum + ((f.calories / base) * ing.quantity);
                            }, 0);

                            const kcalPerServing = recipe.servings > 0 ? recipeTotalKcal / recipe.servings : recipeTotalKcal;
                            itemKcal = kcalPerServing * item.servings;
                        }
                    }
                    calories += itemKcal;
                });
            });
            result.push({ date, calories });
        });
        return result;
    }, [mealEntries, foodItems, recipes]);

    const { settings, updateSettings } = useSettings();

    const [selectedDate, setSelectedDate] = useState(getISODate());
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

    // Chart State
    const [zoomLevel, setZoomLevel] = useState(6);
    const [chartMetric, setChartMetric] = useState<'calories' | 'volume' | 'workouts'>('calories');

    const [smartInput, setSmartInput] = useState('');
    const [weightInput, setWeightInput] = useState(getLatestWeight().toString());
    const [exerciseForm, setExerciseForm] = useState<{
        type: ExerciseType;
        duration: string;
        intensity: ExerciseIntensity;
        notes: string;
    }>({
        type: 'running',
        duration: '30',
        intensity: 'moderate',
        notes: ''
    });

    const [isCycleCreatorOpen, setIsCycleCreatorOpen] = useState(false);
    const [cycleForm, setCycleForm] = useState({
        goal: 'neutral' as 'neutral' | 'deff' | 'bulk',
        startDate: getISODate(),
        endDate: '',
        name: ''
    });

    // ESC key support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsExerciseModalOpen(false);
                setIsWeightModalOpen(false);
            }
        };
        if (isExerciseModalOpen || isWeightModalOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExerciseModalOpen, isWeightModalOpen]);

    // Use centralized NLP parser
    const intent = useMemo(() => parseOmniboxInput(smartInput), [smartInput]);

    // Derived states for form (fallback to manual form if no smart intent)
    const exerciseData = intent.type === 'exercise' ? intent.data : null;
    const weightData = intent.type === 'weight' ? intent.data : null;

    const effectiveExerciseType = exerciseData?.exerciseType || exerciseForm.type;
    const effectiveDuration = exerciseData?.duration?.toString() || exerciseForm.duration;
    const effectiveIntensity = exerciseData?.intensity || exerciseForm.intensity;

    const {
        bmr,
        tdee: dailyTdee, // Renaming to avoid confusion if needed, or just usage
        dailyCaloriesBurned: dailyBurned,
        activeCycle,
        goalAdjustment,
        dailyExercises
    } = useHealth(selectedDate);

    // TDEE in TrainingPage was `bmr + dailyBurned + goalAdjustment`.
    // useHealth returns `tdee` as `bmr + dailyBurned`.
    // So the displayed "Dagens Kaloribehov" in UI was `tdee` variable which included adjustment.
    // Let's match variable text:
    const tdee = dailyTdee + goalAdjustment;

    const handleSmartAction = (e: React.FormEvent) => {
        e.preventDefault();

        if (intent.type === 'weight' && weightData) {
            addWeightEntry(weightData.weight, selectedDate);
            setSmartInput('');
            setWeightInput('');
            return;
        }

        // Priority 2: Exercise Logic (Smart or Manual)
        const duration = parseInt(effectiveDuration) || 0;
        const caloriesBurned = calculateExerciseCalories(effectiveExerciseType, duration, effectiveIntensity);

        addExercise({
            date: selectedDate,
            type: effectiveExerciseType,
            durationMinutes: duration,
            intensity: effectiveIntensity,
            caloriesBurned,
            notes: exerciseForm.notes || (exerciseData?.notes)
        });

        setSmartInput('');
        setExerciseForm({ ...exerciseForm, notes: '' });
        setIsExerciseModalOpen(false);
    };

    const handleAddWeight = (e: React.FormEvent) => {
        e.preventDefault();
        const weight = parseFloat(weightInput);
        if (!isNaN(weight)) {
            addWeightEntry(weight, selectedDate);
            setIsWeightModalOpen(false);
        }
    };

    return (
        <div className="training-page">
            <header className="page-header flex-col md:flex-row gap-6">
                <div className="flex-1">
                    <h1>Träning & Fysik</h1>
                    <p className="page-subtitle">Optimera din förbränning och följ din trend</p>
                </div>

                {/* Permanent Smart Input Header */}
                <div className="flex-1 max-w-xl w-full">
                    <div className="relative group">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Snabb-logga pass</span>
                            <span className="text-[9px] text-slate-500 italic lowercase">t.ex. "45min löpning hög" eller "82kg"</span>
                        </div>
                        <input
                            type="text"
                            value={smartInput}
                            onChange={(e) => setSmartInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && smartInput && handleSmartAction(e)}
                            placeholder="Träning eller vikt..."
                            className="w-full bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 text-white focus:border-emerald-500/30 transition-all outline-none shadow-2xl"
                        />
                        {smartInput && (
                            <button
                                onClick={handleSmartAction}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-500 text-slate-950 text-[10px] font-black px-4 py-2 rounded-xl hover:bg-emerald-400 transition-colors"
                            >
                                LOGGA
                            </button>
                        )}

                        {/* Inline Preview */}
                        {smartInput && (
                            <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 flex items-center justify-between">
                                {intent.type === 'weight' && weightData ? (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">⚖️</span>
                                            <div>
                                                <div className="text-[10px] font-black text-white">Ny vikt</div>
                                                <div className="text-[9px] text-slate-500 font-bold">{weightData.weight} KG</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <button onClick={handleSmartAction} className="text-[10px] font-black text-emerald-400 uppercase">Spara</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.icon}</span>
                                            <div>
                                                <div className="text-[10px] font-black text-white">{EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.label}</div>
                                                <div className="text-[9px] text-slate-500">{effectiveDuration} min • {INTENSITIES.find(i => i.value === effectiveIntensity)?.label}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-emerald-400">-{calculateExerciseCalories(effectiveExerciseType, parseInt(effectiveDuration) || 0, effectiveIntensity)} kcal</div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="btn btn-secondary !rounded-2xl" onClick={() => setIsWeightModalOpen(true)}>
                        ⚖️ Logga Vikt
                    </button>
                </div>
            </header>

            {/* Cycle Manager (Replaces Goal Selector) */}
            <section className="mb-8">
                {activeCycle ? (
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 p-6 shadow-2xl group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-[100px] leading-none select-none grayscale group-hover:grayscale-0 transition-all duration-500">
                            {activeCycle.goal === 'deff' ? '🔥' : activeCycle.goal === 'bulk' ? '💪' : '⚖️'}
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                                        Active Cycle
                                    </span>
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                        {activeCycle.startDate} — {activeCycle.endDate}
                                    </span>
                                </div>
                                <h2 className="text-3xl font-black text-white italic tracking-tighter mb-1">{activeCycle.name}</h2>
                                <p className="text-sm text-slate-400 font-medium">
                                    Mål: <span className="text-white">{activeCycle.goal === 'deff' ? 'Deff (-500 kcal)' : activeCycle.goal === 'bulk' ? 'Bulk (+500 kcal)' : 'Balans (0 kcal)'}</span>
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        if (confirm('Är du säker på att du vill avsluta denna period?')) {
                                            deleteTrainingCycle(activeCycle.id);
                                        }
                                    }}
                                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/5 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 font-bold text-xs uppercase tracking-wider transition-all"
                                >
                                    Avsluta Period
                                </button>
                                <button className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg hover:shadow-emerald-500/20">
                                    Redigera
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-4 hover:bg-slate-900/80 transition-all custom-dashed-border">
                        {!isCycleCreatorOpen ? (
                            <>
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-2xl text-emerald-500 mb-2">
                                    📅
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1">Starta ny Träningsperiod</h3>
                                    <p className="text-sm text-slate-400">Definiera ditt mål och följ din utveckling över tid.</p>
                                </div>
                                <button
                                    onClick={() => setIsCycleCreatorOpen(true)}
                                    className="mt-2 px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                                >
                                    Skapa Period
                                </button>
                            </>
                        ) : (
                            <div className="w-full max-w-2xl text-left bg-slate-950 p-6 rounded-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="text-lg font-bold text-white mb-6">Ny Period</h3>

                                {/* Smart Input for Cycle */}
                                <div className="mb-6 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                                    <label className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider mb-2 block">✨ AI Snabb-skapare</label>
                                    <input
                                        type="text"
                                        placeholder="t.ex. 'Sommardeff 2024-03-01 - 2024-06-01'"
                                        className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl p-3 text-white text-sm focus:border-emerald-500 transition-all outline-none"
                                        onChange={(e) => {
                                            if (!isCycleCreatorOpen) setIsCycleCreatorOpen(true);
                                            const val = e.target.value;

                                            // Always update name field as user types
                                            setCycleForm(prev => ({ ...prev, name: val }));

                                            // Smart Parse
                                            const smart = parseCycleString(val);
                                            if (smart) {
                                                setCycleForm(prev => ({
                                                    ...prev,
                                                    name: smart.name,
                                                    startDate: smart.startDate,
                                                    endDate: smart.endDate,
                                                    goal: smart.goal
                                                }));
                                            }
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Namn</label>
                                        <input
                                            type="text"
                                            placeholder="t.ex. Vinterbulk 2024"
                                            value={cycleForm.name}
                                            onChange={e => setCycleForm({ ...cycleForm, name: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mål</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'deff', label: 'Deff', icon: '🔥' },
                                                { id: 'neutral', label: 'Normal', icon: '⚖️' },
                                                { id: 'bulk', label: 'Bulk', icon: '💪' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setCycleForm({ ...cycleForm, goal: opt.id as any })}
                                                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${cycleForm.goal === opt.id
                                                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                                        : 'bg-slate-900/50 text-slate-400 border-white/5 hover:bg-slate-800'
                                                        }`}
                                                >
                                                    <span className="text-lg">{opt.icon}</span>
                                                    <span className="text-[10px] font-black uppercase">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Start</label>
                                        <input
                                            type="date"
                                            value={cycleForm.startDate}
                                            onChange={e => setCycleForm({ ...cycleForm, startDate: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-all outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Slut (Preliminärt)</label>
                                        <input
                                            type="date"
                                            value={cycleForm.endDate}
                                            onChange={e => setCycleForm({ ...cycleForm, endDate: e.target.value })}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500/50 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setIsCycleCreatorOpen(false)}
                                        className="px-6 py-3 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white font-bold text-xs uppercase transition-all"
                                    >
                                        Avbryt
                                    </button>
                                    <button
                                        disabled={!cycleForm.name || !cycleForm.endDate}
                                        onClick={() => {
                                            addTrainingCycle({
                                                name: cycleForm.name,
                                                goal: cycleForm.goal,
                                                startDate: cycleForm.startDate,
                                                endDate: cycleForm.endDate
                                            });
                                            setIsCycleCreatorOpen(false);
                                        }}
                                        className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-emerald-500/20 uppercase text-xs tracking-wider"
                                    >
                                        Skapa Period
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <div className="training-grid">
                {/* Stats Dashboard */}
                <div className="stats-panel space-y-4">
                    <div className="stat-card premium-card">
                        <span className="stat-label">Dagens Kaloribehov</span>
                        <div className="stat-value-group">
                            <span className="stat-value text-emerald-400">{tdee}</span>
                            <span className="stat-unit">kcal</span>
                        </div>
                        <div className="stat-breakdown">
                            <span>BMR: {bmr}</span>
                            {dailyBurned > 0 && <span>+ Träning: {dailyBurned}</span>}
                            {goalAdjustment !== 0 && <span>+ Mål: {goalAdjustment}</span>}
                        </div>
                    </div>

                    {/* New Training Stats */}
                    <div className="stat-card bg-slate-900/50 border-white/5">
                        <span className="stat-label">Veckans Träning</span>
                        <div className="flex justify-between items-end mt-2">
                            <div>
                                <div className="text-lg font-black text-white">{exerciseEntries.filter(e => {
                                    const d = new Date(e.date);
                                    const now = new Date();
                                    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
                                    return d >= startOfWeek;
                                }).length} pass</div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Denna vecka</div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-black text-emerald-400">
                                    {Math.round(exerciseEntries.reduce((sum, e) => sum + e.caloriesBurned, 0) / (exerciseEntries.length || 1))}
                                </div>
                                <div className="text-[9px] text-slate-500 font-bold uppercase">Snitt kcal/pass</div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="text-[9px] text-slate-500 font-bold uppercase mb-2">Topp-aktivitet</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">
                                    {EXERCISE_TYPES.find(t => t.type === (
                                        Object.entries(exerciseEntries.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>))
                                            .sort((a, b) => b[1] - a[1])[0]?.[0] as ExerciseType || 'other'
                                    ))?.icon}
                                </span>
                                <span className="text-xs font-bold text-white uppercase tracking-widest">
                                    {EXERCISE_TYPES.find(t => t.type === (
                                        Object.entries(exerciseEntries.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>))
                                            .sort((a, b) => b[1] - a[1])[0]?.[0] as ExerciseType || 'other'
                                    ))?.label || 'Ingen data'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <span className="stat-label">Nuvarande Vikt</span>
                        <div className="stat-value-group">
                            <span className="stat-value">{getLatestWeight()}</span>
                            <span className="stat-unit">kg</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">Senast uppdaterad: {weightEntries[0]?.date || 'Aldrig'}</p>
                    </div>
                </div>

                {/* Log & Trends */}
                <div className="main-panel space-y-6">
                    {/* Year Visualization */}
                    <div className="content-card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="section-title">Årsöversikt & Utveckling</h3>
                            <div className="flex gap-2">
                                <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                                    {[
                                        { id: 'calories', label: 'Kcal', icon: '🔥' },
                                        { id: 'volume', label: 'Volym', icon: '⚖️' },
                                        { id: 'workouts', label: 'Pass', icon: '💪' }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => setChartMetric(m.id as any)}
                                            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${chartMetric === m.id
                                                ? 'bg-emerald-500 text-slate-950'
                                                : 'text-slate-400 hover:text-white'
                                                }`}
                                        >
                                            <span>{m.icon}</span>
                                            <span className="hidden sm:inline">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex bg-slate-900 rounded-lg p-1 border border-white/5">
                                    <button onClick={() => setZoomLevel(z => Math.min(12, z + 2))} className="px-3 hover:bg-white/10 rounded text-slate-400 font-bold">-</button>
                                    <span className="px-2 flex items-center text-[10px] font-mono text-slate-500">{zoomLevel}m</span>
                                    <button onClick={() => setZoomLevel(z => Math.max(2, z - 2))} className="px-3 hover:bg-white/10 rounded text-slate-400 font-bold">+</button>
                                </div>
                            </div>
                        </div>
                        <div className="h-64 bg-slate-900/30 rounded-xl border border-white/5 relative overflow-hidden mt-4">
                            <CycleYearChart
                                cycles={trainingCycles}
                                weightEntries={weightEntries}
                                nutrition={dailyNutrition}
                                exercises={exerciseEntries}
                                zoomMonths={zoomLevel}
                                metric={chartMetric}
                            />
                        </div>
                    </div>

                    {/* Exercise Log */}
                    <div className="content-card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="section-title">Träningsdagbok</h3>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-slate-800 border-none rounded-lg text-xs p-2 text-white"
                            />
                        </div>

                        <div className="exercise-list space-y-2">
                            {dailyExercises.length > 0 ? (
                                dailyExercises.map(ex => (
                                    <div key={ex.id} className="exercise-row p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{EXERCISE_TYPES.find(t => t.type === ex.type)?.icon}</span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">{EXERCISE_TYPES.find(t => t.type === ex.type)?.label}</span>
                                                    <span className={`text-[10px] font-bold uppercase ${INTENSITIES.find(i => i.value === ex.intensity)?.color}`}>
                                                        {INTENSITIES.find(i => i.value === ex.intensity)?.label}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">{ex.durationMinutes} min • {ex.notes || 'Inga anteckningar'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-rose-400 font-bold text-sm">-{ex.caloriesBurned} kcal</span>
                                            <button
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all"
                                                onClick={() => deleteExercise(ex.id)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-600 italic text-sm">Ingen träning loggad för {selectedDate}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exercise Modal */}
            {isExerciseModalOpen && (
                <div className="modal-overlay" onClick={() => setIsExerciseModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2>Logga Träning</h2>
                            <button className="text-slate-500 hover:text-white" onClick={() => setIsExerciseModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSmartAction} className="space-y-6">
                            {/* Smart Input field */}
                            <div className="input-group">
                                <label className="text-emerald-400 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                                    <span>🪄 Snabb-input</span>
                                    <span className="text-[10px] text-slate-500 lowercase font-normal italic">t.ex. "30min löpning hög"</span>
                                </label>
                                <input
                                    type="text"
                                    value={smartInput}
                                    onChange={(e) => setSmartInput(e.target.value)}
                                    placeholder="Beskriv passet här..."
                                    className="w-full bg-slate-950/50 border border-emerald-500/20 rounded-2xl p-4 text-white focus:border-emerald-500/50 transition-all outline-none"
                                    autoFocus
                                />
                            </div>

                            {/* Derived Preview Tooltip-like area */}
                            {smartInput && (
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.icon}</span>
                                        <div>
                                            <div className="text-xs font-bold text-slate-200">
                                                {EXERCISE_TYPES.find(t => t.type === effectiveExerciseType)?.label}
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {effectiveDuration} min • {INTENSITIES.find(i => i.value === effectiveIntensity)?.label} intensitet
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-emerald-400">-{calculateExerciseCalories(effectiveExerciseType, parseInt(effectiveDuration) || 0, effectiveIntensity)} kcal</div>
                                        <div className="text-[10px] text-slate-500 italic">beräknat</div>
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-white/5 pt-4 my-2" />

                            <div className="grid grid-cols-4 gap-2">
                                {EXERCISE_TYPES.map(t => (
                                    <button
                                        key={t.type}
                                        type="button"
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${effectiveExerciseType === t.type ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-white/5 text-slate-400 opacity-60 hover:opacity-100'}`}
                                        onClick={() => {
                                            setExerciseForm({ ...exerciseForm, type: t.type });
                                            setSmartInput(''); // Clear smart input if manually choosing
                                        }}
                                    >
                                        <span className="text-xl">{t.icon}</span>
                                        <span className="text-[10px] font-bold">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="input-group">
                                    <label>Längd (min)</label>
                                    <input
                                        type="number"
                                        value={effectiveDuration}
                                        onChange={e => {
                                            setExerciseForm({ ...exerciseForm, duration: e.target.value });
                                            setSmartInput('');
                                        }}
                                        className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white"
                                    />
                                </div>
                                <div className="input-group">
                                    <label>Intensitet</label>
                                    <select
                                        value={effectiveIntensity}
                                        onChange={e => {
                                            setExerciseForm({ ...exerciseForm, intensity: e.target.value as ExerciseIntensity });
                                            setSmartInput('');
                                        }}
                                        className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white appearance-none"
                                    >
                                        {INTENSITIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Anteckningar (valfritt)</label>
                                <textarea
                                    rows={2}
                                    value={exerciseForm.notes}
                                    onChange={e => setExerciseForm({ ...exerciseForm, notes: e.target.value })}
                                    className="w-full bg-slate-800 border-white/5 rounded-xl p-3 text-white resize-none"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" className="btn btn-secondary flex-1" onClick={() => setIsExerciseModalOpen(false)}>Avbryt</button>
                                <button type="submit" className="btn btn-primary flex-1">Spara Träning</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Weight Modal */}
            {/* Weight Modal */}
            {isWeightModalOpen && (
                <div className="modal-overlay backdrop-blur-md bg-slate-950/80" onClick={() => setIsWeightModalOpen(false)}>
                    <div
                        className="modal-content max-w-lg w-full bg-slate-900 border border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-br from-emerald-500/20 to-slate-900 p-6 text-center border-b border-white/5">
                            <h2 className="text-xl font-black text-white italic tracking-tighter">NY VIKTNOTERING</h2>
                            <p className="text-xs text-slate-400 font-medium">Uppdatera din kroppsdata</p>
                        </div>

                        <form onSubmit={handleAddWeight} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="relative group">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={weightInput}
                                        autoFocus
                                        onChange={e => setWeightInput(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-2xl p-8 text-5xl font-black text-center text-emerald-400 focus:border-emerald-500/50 transition-all outline-none placeholder-slate-800"
                                        placeholder="0.0"
                                    />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-700 font-black text-xl pointer-events-none">KG</span>
                                </div>

                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-center text-slate-400 text-sm focus:text-white transition-all outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs uppercase tracking-wider transition-all" onClick={() => setIsWeightModalOpen(false)}>
                                    Avbryt
                                </button>
                                <button type="submit" className="py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all">
                                    Spara Vikt
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function addToWeek(map: any, d: Date, val: number, startDate: Date) {
    const diffTime = d.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7);

    if (!map[weekNum]) {
        const stableDate = new Date(startDate.getTime() + (weekNum * 7 * 24 * 60 * 60 * 1000));
        map[weekNum] = { sum: 0, count: 0, date: stableDate.toISOString() };
    }
    map[weekNum].sum += val;
    map[weekNum].count++;
}

function CycleYearChart({
    cycles,
    weightEntries,
    nutrition,
    exercises,
    zoomMonths,
    metric
}: {
    cycles: any[],
    weightEntries: any[],
    nutrition: any[],
    exercises: any[],
    zoomMonths: number,
    metric: 'calories' | 'volume' | 'workouts'
}) {
    // 1. Calculate Time Range (+- zoomMonths)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(today.getMonth() - zoomMonths);
    const endDate = new Date(today);
    endDate.setMonth(today.getMonth() + zoomMonths);

    const getX = (dateStr: string | Date) => {
        const d = new Date(dateStr);
        const totalMs = endDate.getTime() - startDate.getTime();
        const currentMs = d.getTime() - startDate.getTime();
        return (currentMs / totalMs) * 100;
    };

    // 2. Weight Min/Max for scaling
    // Filter weights within the visual range for scaling calculation, but maybe allow a buffer?
    const visibleWeights = weightEntries.filter(w => {
        const d = new Date(w.date);
        return d >= startDate && d <= endDate;
    });

    // Fallback if no specific weights in range, use generic 70-90 or nearby
    const weights = visibleWeights.map(w => w.weight);
    const minWeight = weights.length ? Math.min(...weights) - 2 : 70;
    const maxWeight = weights.length ? Math.max(...weights) + 2 : 90;

    const getY = (weight: number) => {
        return 100 - ((weight - minWeight) / (maxWeight - minWeight)) * 100;
    };

    const sortedWeights = [...weightEntries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter(w => {
            const d = new Date(w.date);
            // Include one point before/after to ensure lines connect to the edge properly?
            // For now, strict range is safer for SVG bounds if we use 0-100 clamping, 
            // but since we allow <0 and >100 in getX (to let lines flow offscreen), 
            // we should maybe filter loosely. 
            // Let's filter strictly for now to avoid complexity.
            return d >= startDate && d <= endDate;
        });

    const weightPath = sortedWeights.map((w, i) => {
        const x = getX(w.date);
        const y = getY(w.weight);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Background Zones for Cycles (rendered first) */}
            {cycles.map(cycle => {
                const startX = Math.max(0, getX(cycle.startDate));
                const endX = cycle.endDate ? Math.min(100, getX(cycle.endDate)) : 100; // If no end date, assume infinity -> 100

                // If cycle is completely out of view?
                if (endX < 0 || startX > 100) return null;

                const width = Math.max(0.5, endX - startX);

                let color = 'rgba(59, 130, 246, 0.1)'; // Neutral (Blue)
                if (cycle.goal === 'deff') color = 'rgba(244, 63, 94, 0.1)'; // Cut (Rose)
                if (cycle.goal === 'bulk') color = 'rgba(16, 185, 129, 0.1)'; // Bulk (Emerald)

                return (
                    <rect
                        key={cycle.id}
                        x={startX}
                        y="0"
                        width={width}
                        height="100"
                        fill={color}
                    />
                );
            })}

            {/* Today Line */}
            <line x1={getX(today)} y1="0" x2={getX(today)} y2="100" stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="4 4" strokeWidth="0.5" />

            {/* Data Bars (Weekly Averages/Sums) */}
            {(() => {
                // Group by week
                const weeklyData: { [key: string]: { sum: number, count: number, date: string } } = {};

                if (metric === 'calories') {
                    nutrition.forEach(n => {
                        const d = new Date(n.date);
                        if (d < startDate || d > endDate) return;
                        addToWeek(weeklyData, d, n.calories, startDate);
                    });
                } else if (metric === 'workouts') {
                    exercises.forEach(e => {
                        const d = new Date(e.date);
                        if (d < startDate || d > endDate) return;
                        addToWeek(weeklyData, d, 1, startDate);
                    });
                } else if (metric === 'volume') {
                    exercises.forEach(e => {
                        const d = new Date(e.date);
                        if (d < startDate || d > endDate) return;
                        // Estimate volume if not present (simple placeholder logic)
                        // Assuming tonnage is explicitly logged OR derive from duration*intensity factor? 
                        // User asked for "ton lyfta", implying strength.
                        // If no tonnage, maybe 0.
                        const vol = e.tonnage || 0;
                        addToWeek(weeklyData, d, vol, startDate);
                    });
                }

                return Object.values(weeklyData).map((data: any, i) => {
                    let val = data.sum;
                    if (metric === 'calories') val = data.sum / data.count; // Average for calories
                    // For workouts/volume, we want Sum per week, not average per entry. 
                    // Wait, `addToWeek` increments count. 
                    // So `data.sum` is total for the week.

                    const x = getX(data.date);

                    // Scaling
                    let height = 0;
                    let color = 'rgba(16, 185, 129, 0.2)';

                    if (metric === 'calories') {
                        height = Math.min(40, (val / 4000) * 40);
                    } else if (metric === 'workouts') {
                        height = Math.min(40, (val / 10) * 40); // Max 10 workouts per week
                        color = 'rgba(59, 130, 246, 0.4)';
                    } else if (metric === 'volume') {
                        height = Math.min(40, (val / 20000) * 40); // Max 20 tons per week? 
                        color = 'rgba(244, 63, 94, 0.4)';
                    }

                    return (
                        <rect
                            key={i}
                            x={x}
                            y={100 - height}
                            width={1.5}
                            height={height}
                            fill={color}
                            rx="0.5"
                        />
                    );
                });
            })()}

            {/* Grid Lines (Months) */}
            {Array.from({ length: 13 }).map((_, i) => {
                const d = new Date(startDate);
                d.setMonth(d.getMonth() + i);
                const x = getX(d.toISOString().split('T')[0]);
                // Only show if x is within bounds (0-100)
                if (x < 0 || x > 100) return null;

                return (
                    <g key={i}>
                        <line x1={x} y1="0" x2={x} y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.2" />
                        <text x={x + 1} y="95" fontSize="2" fill="rgba(255,255,255,0.3)">{d.toLocaleDateString('sv-SE', { month: 'short' })}</text>
                    </g>
                );
            })}

            {/* Weight Line */}
            {sortedWeights.length > 1 && (
                <path
                    d={weightPath}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                    className="drop-shadow-glow"
                />
            )}

            {/* Current Weight Indicator */}
            {sortedWeights.length > 0 && (
                <circle
                    cx={getX(sortedWeights[sortedWeights.length - 1].date)}
                    cy={getY(sortedWeights[sortedWeights.length - 1].weight)}
                    r="1"
                    fill="#10b981"
                />
            )}
        </svg>
    );
}
