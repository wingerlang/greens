import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    type ExerciseType,
    type ExerciseIntensity,
    type ExerciseSubType,
    WEEKDAY_LABELS
} from '../models/types.ts';
import { useSmartPlanner } from '../hooks/useSmartPlanner.ts';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate } from '../models/types.ts';
import {
    parseOmniboxInput,
    parseCycleString
} from '../utils/nlpParser.ts';
import { CycleYearChart } from '../components/training/CycleYearChart.tsx';
import { ExerciseModal, EXERCISE_TYPES, INTENSITIES } from '../components/training/ExerciseModal.tsx';
import { WeightModal } from '../components/training/WeightModal.tsx';
import { CycleDetailModal } from '../components/training/CycleDetailModal.tsx';
import './TrainingPage.css';

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
        updateTrainingCycle // Add this if available
    } = useData();

    // Handlers for Chart Interaction
    const [selectedCycle, setSelectedCycle] = useState<any>(null);
    const [isCycleDetailOpen, setIsCycleDetailOpen] = useState(false);

    const handleEditCycle = (cycle: any) => {
        setSelectedCycle(cycle);
        setIsCycleDetailOpen(true);
    };

    const handleCreateCycleAfter = (cycle: any) => {
        const endDate = new Date(cycle.endDate || cycle.startDate); // Fallback
        const nextStart = new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Guess next goal?
        const nextGoal = cycle.goal === 'deff' ? 'Bulk' : cycle.goal === 'bulk' ? 'Deff' : 'Mål';
        setCycleInput(`${nextGoal} ${nextStart} - 3mån`);
        setTimeout(() => document.getElementById('cycle-input')?.focus(), 100);
    };

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
    const [visibleMetrics, setVisibleMetrics] = useState({
        calories: true,
        volume: true,
        workouts: true
    });

    const [smartInput, setSmartInput] = useState('');
    const [weightInput, setWeightInput] = useState(getLatestWeight().toString());
    const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
    const [exerciseForm, setExerciseForm] = useState<{
        type: ExerciseType;
        duration: string;
        intensity: ExerciseIntensity;
        notes: string;
        subType?: ExerciseSubType;
        tonnage?: string;
        distance?: string;
    }>({
        type: 'running',
        duration: '30',
        intensity: 'moderate',
        notes: '',
        subType: 'default'
    });

    const [cycleInput, setCycleInput] = useState('');
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

    const handleEditExercise = (ex: any) => {
        setExerciseForm({
            type: ex.type,
            duration: ex.durationMinutes.toString(),
            intensity: ex.intensity,
            notes: ex.notes || '',
            subType: ex.subType || 'default',
            tonnage: ex.tonnage ? ex.tonnage.toString() : '',
            distance: ex.distance ? ex.distance.toString() : ''
        });
        setEditingExerciseId(ex.id);
        setIsExerciseModalOpen(true);
    };

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

        const exerciseDataToSave = {
            date: selectedDate,
            type: effectiveExerciseType,
            durationMinutes: duration,
            intensity: effectiveIntensity,
            caloriesBurned,
            notes: exerciseForm.notes || (exerciseData?.notes),
            subType: exerciseForm.subType,
            tonnage: exerciseForm.tonnage ? parseFloat(exerciseForm.tonnage) : undefined,
            distance: exerciseForm.distance ? parseFloat(exerciseForm.distance) : undefined
        };

        if (editingExerciseId) {
            // Updated via delete + add for now (preserves date)
            deleteExercise(editingExerciseId);
            addExercise(exerciseDataToSave);
        } else {
            addExercise(exerciseDataToSave);
        }

        setSmartInput('');
        setExerciseForm({ ...exerciseForm, notes: '', tonnage: '', distance: '', subType: 'default' });
        setEditingExerciseId(null);
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
                {activeCycle && !isCycleCreatorOpen ? (
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
                                    Avsluta
                                </button>
                                <button
                                    onClick={() => handleEditCycle(activeCycle)}
                                    className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 hover:text-slate-950 transition-all border border-white/5 hover:border-emerald-500"
                                >
                                    Redigera
                                </button>
                                <button
                                    onClick={() => setIsCycleCreatorOpen(true)}
                                    className="px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 hover:text-slate-950 transition-all border border-emerald-500/20 hover:border-emerald-500 text-center"
                                >
                                    + Ny Period
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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && cycleForm.name && cycleForm.endDate) {
                                                addTrainingCycle({
                                                    name: cycleForm.name,
                                                    goal: cycleForm.goal,
                                                    startDate: cycleForm.startDate,
                                                    endDate: cycleForm.endDate
                                                });
                                                setIsCycleCreatorOpen(false);
                                            }
                                        }}
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
                                            onClick={() => setVisibleMetrics(prev => ({ ...prev, [m.id]: !prev[m.id as keyof typeof prev] }))}
                                            className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${visibleMetrics[m.id as keyof typeof visibleMetrics]
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
                                visibleMetrics={visibleMetrics}
                                onEditCycle={handleEditCycle}
                                onCreateCycleAfter={handleCreateCycleAfter}
                            />
                        </div>
                    </div>

                    <CycleDetailModal
                        isOpen={isCycleDetailOpen}
                        onClose={() => setIsCycleDetailOpen(false)}
                        cycle={selectedCycle}
                        onSave={updateTrainingCycle}
                        onDelete={deleteTrainingCycle}
                        exercises={exerciseEntries}
                        nutrition={dailyNutrition}
                    />

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
                                    <div
                                        key={ex.id}
                                        className="exercise-row p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:bg-white/10 transition-all cursor-pointer"
                                        onClick={() => handleEditExercise(ex)}
                                    >
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
                {/* Data Analysis Section - Final Polish */}
                <div className="content-card mt-6">
                    <h3 className="section-title mb-4">Djupanalys & Statistik</h3>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {/* Stat 1: Total Tonnage */}
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Totalt Tonnage</div>
                            <div className="text-2xl font-black text-rose-400">
                                {Math.round(exerciseEntries.reduce((sum, e) => sum + (e.tonnage || 0), 0) / 1000)} <span className="text-sm text-slate-500 font-bold">ton</span>
                            </div>
                        </div>

                        {/* Stat 2: Total Distance */}
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Distans</div>
                            <div className="text-2xl font-black text-sky-400">
                                {Math.round(exerciseEntries.reduce((sum, e) => sum + (e.distance || 0), 0))} <span className="text-sm text-slate-500 font-bold">km</span>
                            </div>
                        </div>

                        {/* Stat 3: Avg Intensity (Proxy) */}
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Snittduration</div>
                            <div className="text-2xl font-black text-emerald-400">
                                {Math.round(exerciseEntries.length > 0 ? exerciseEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / exerciseEntries.length : 0)} <span className="text-sm text-slate-500 font-bold">min</span>
                            </div>
                        </div>

                        {/* Stat 4: Total Time */}
                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Träningstid</div>
                            <div className="text-2xl font-black text-indigo-400">
                                {Math.round(exerciseEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / 60)} <span className="text-sm text-slate-500 font-bold">h</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Top Activities Table */}
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Topplista Aktiviteter</h4>
                            <div className="space-y-2">
                                {Object.entries(exerciseEntries.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>))
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 5)
                                    .map(([type, count]) => (
                                        <div key={type} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{EXERCISE_TYPES.find(t => t.type === type)?.icon}</span>
                                                <span className="text-xs font-bold capitalize text-slate-300">{EXERCISE_TYPES.find(t => t.type === type)?.label}</span>
                                            </div>
                                            <div className="text-sm font-black text-white">{count} <span className="text-[10px] text-slate-500 font-normal">pass</span></div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Recent Records (Mock/Real) */}
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Senaste PB & MIstolpar</h4>
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 text-center mb-4">
                                <span className="text-4xl">🏆</span>
                                <h5 className="text-sm font-bold text-emerald-400 mt-2">Nytt Volymrekord!</h5>
                                <p className="text-[10px] text-slate-400 mt-1">Du lyfte {Math.round(Math.max(...exerciseEntries.filter(e => e.tonnage).map(e => e.tonnage || 0)) || 0)} kg som mest i ett pass.</p>
                            </div>
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-500/10 to-transparent border border-sky-500/20 text-center">
                                <span className="text-4xl">👟</span>
                                <h5 className="text-sm font-bold text-sky-400 mt-2">Distanstopp</h5>
                                <p className="text-[10px] text-slate-400 mt-1">Längsta passet var {Math.max(...exerciseEntries.filter(e => e.distance).map(e => e.distance || 0)) || 0} km.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Extracted Modals */}
            <ExerciseModal
                isOpen={isExerciseModalOpen}
                onClose={() => {
                    setIsExerciseModalOpen(false);
                    setEditingExerciseId(null);
                }}
                onSave={handleSmartAction}
                smartInput={smartInput}
                setSmartInput={setSmartInput}
                effectiveExerciseType={effectiveExerciseType}
                effectiveDuration={effectiveDuration}
                effectiveIntensity={effectiveIntensity}
                exerciseForm={exerciseForm}
                setExerciseForm={setExerciseForm}
                calculateCalories={calculateExerciseCalories}
                isEditing={!!editingExerciseId}
                onDelete={() => {
                    if (editingExerciseId) {
                        deleteExercise(editingExerciseId);
                        setIsExerciseModalOpen(false);
                        setEditingExerciseId(null);
                    }
                }}
            />

            <WeightModal
                isOpen={isWeightModalOpen}
                onClose={() => setIsWeightModalOpen(false)}
                weightInput={weightInput}
                setWeightInput={setWeightInput}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                onSave={handleAddWeight}
            />
        </div>
    );
}
