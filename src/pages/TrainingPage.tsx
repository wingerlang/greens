import React, { useState, useEffect, useMemo } from 'react';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { ExerciseEntry } from '../models/types.ts';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import {
    WEEKDAY_LABELS
} from '../models/types.ts';
import { useSmartPlanner } from '../hooks/useSmartPlanner.ts';
import { UniversalActivity } from '../models/types.ts';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate } from '../models/types.ts';
import { mapUniversalToLegacyEntry } from '../utils/mappers.ts';
import {
    parseCycleString
} from '../utils/nlpParser.ts';
import { formatActivityDuration } from '../utils/formatters.ts';
import { CycleYearChart } from '../components/training/CycleYearChart.tsx';
import { EXERCISE_TYPES, INTENSITIES } from '../components/training/ExerciseModal.tsx';
import { CycleDetailModal } from '../components/training/CycleDetailModal.tsx';
import { GoalCard } from '../components/training/GoalCard.tsx';
import { GoalModal } from '../components/training/GoalModal.tsx';
import { TrainingLoadCorrelation } from '../components/training/TrainingLoadCorrelation.tsx';
import type { PerformanceGoal, TrainingCycle } from '../models/types.ts';
import './TrainingPage.css';

import { TrainingOverview } from '../components/training/TrainingOverview.tsx';
import { HealthScoreCard } from '../components/dashboard/HealthScoreCard.tsx';
import { KonditionView } from './Health/KonditionView.tsx';
import { RaceList } from '../components/training/RaceList.tsx';

export function TrainingPage() {
    const {
        exerciseEntries: legacyExerciseEntries = [],
        weightEntries = [],
        addExercise,
        deleteExercise,
        addWeightEntry,
        getLatestWeight,
        calculateExerciseCalories,
        calculateBMR,
        addTrainingCycle,
        deleteTrainingCycle,
        trainingCycles = [],
        mealEntries = [],
        foodItems = [],
        recipes = [],
        updateTrainingCycle,
        performanceGoals = [],
        addGoal,
        updateGoal,
        deleteGoal,
        universalActivities = [],
        strengthSessions = []
    } = useData();

    const navigate = useNavigate();

    // Merge Data - combine server and local entries
    const exerciseEntries = useMemo(() => {
        const serverEntries = (universalActivities || [])
            .map(mapUniversalToLegacyEntry)
            .filter((e): e is ExerciseEntry => e !== null);

        const strength = (strengthSessions || []).map((w): ExerciseEntry => ({
            id: w.id,
            date: w.date,
            type: 'strength',
            durationMinutes: w.duration || (w.exercises.length * 4) + (w.totalSets * 1.5) || 45,
            intensity: 'high',
            caloriesBurned: w.totalVolume ? Math.round(w.totalVolume * 0.05) : 300,
            tonnage: w.totalVolume,
            notes: w.name,
            source: 'strength',
            createdAt: w.createdAt
        }));

        // Combine: prefer server entries, add unique legacy entries
        const serverIds = new Set(serverEntries.map(e => e.id));
        const uniqueLegacy = (legacyExerciseEntries || []).filter(e => !serverIds.has(e.id));

        return [...serverEntries, ...strength, ...uniqueLegacy];
    }, [universalActivities, legacyExerciseEntries, strengthSessions]);

    // Handlers for Chart Interaction
    const [selectedCycle, setSelectedCycle] = useState<TrainingCycle | null>(null);
    const [isCycleDetailOpen, setIsCycleDetailOpen] = useState(false);

    // Goal Modal State
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<PerformanceGoal | null>(null);

    // Tab state for main view switcher
    const [currentTab, setCurrentTab] = useState<'overview' | 'styrka' | 'kondition' | 'races'>('overview');

    const handleEditCycle = (cycle: TrainingCycle) => {
        setSelectedCycle(cycle);
        setIsCycleDetailOpen(true);
    };

    const handleCreateCycleAfter = (cycle: TrainingCycle) => {
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
        (mealEntries || []).forEach(entry => {
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

    // Period Filter State
    const [activePreset, setActivePreset] = useState<'all' | 'ytd' | 'prev' | '3m' | '6m' | '9m' | 'ttm'>('all');
    const [filterStartDate, setFilterStartDate] = useState<string | null>(null);
    const [filterEndDate, setFilterEndDate] = useState<string | null>(null);

    const applyPeriodPreset = (preset: typeof activePreset) => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        setActivePreset(preset);

        switch (preset) {
            case 'all':
                // Find earliest date
                if (exerciseEntries.length > 0) {
                    const sorted = [...exerciseEntries].sort((a, b) => a.date.localeCompare(b.date));
                    setFilterStartDate(sorted[0].date.split('T')[0]);
                } else {
                    setFilterStartDate(null);
                }
                setFilterEndDate(null);
                break;
            case 'ytd':
                setFilterStartDate(`${now.getFullYear()}-01-01`);
                setFilterEndDate(today);
                break;
            case 'prev':
                setFilterStartDate(`${now.getFullYear() - 1}-01-01`);
                setFilterEndDate(`${now.getFullYear() - 1}-12-31`);
                break;
            case '3m': {
                const d = new Date();
                d.setMonth(d.getMonth() - 3);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '6m': {
                const d = new Date();
                d.setMonth(d.getMonth() - 6);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case '9m': {
                const d = new Date();
                d.setMonth(d.getMonth() - 9);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
            case 'ttm': {
                const d = new Date();
                d.setFullYear(d.getFullYear() - 1);
                setFilterStartDate(d.toISOString().split('T')[0]);
                setFilterEndDate(today);
                break;
            }
        }
    };

    // Apply Period Filter to data
    const filteredExerciseEntries = useMemo(() => {
        return exerciseEntries.filter(e => {
            if (filterStartDate && e.date < filterStartDate) return false;
            if (filterEndDate && e.date > filterEndDate) return false;
            return true;
        });
    }, [exerciseEntries, filterStartDate, filterEndDate]);

    const filteredWeightEntries = useMemo(() => {
        return (weightEntries || []).filter(e => {
            if (filterStartDate && e.date < filterStartDate) return false;
            if (filterEndDate && e.date > filterEndDate) return false;
            return true;
        });
    }, [weightEntries, filterStartDate, filterEndDate]);

    const filteredDailyNutrition = useMemo(() => {
        return dailyNutrition.filter(e => {
            if (filterStartDate && e.date < filterStartDate) return false;
            if (filterEndDate && e.date > filterEndDate) return false;
            return true;
        });
    }, [dailyNutrition, filterStartDate, filterEndDate]);

    const { settings, updateSettings } = useSettings();

    const [selectedDate, setSelectedDate] = useState(getISODate());

    // Chart State
    const [zoomLevel, setZoomLevel] = useState(6);
    const [visibleMetrics, setVisibleMetrics] = useState({
        calories: true,
        volume: true,
        workouts: true
    });

    const [cycleInput, setCycleInput] = useState('');
    const [isCycleCreatorOpen, setIsCycleCreatorOpen] = useState(false);
    const [cycleForm, setCycleForm] = useState({
        goal: 'neutral' as 'neutral' | 'deff' | 'bulk',
        startDate: getISODate(),
        endDate: '',
        name: ''
    });


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

    const [selectedActivity, setSelectedActivity] = useState<(ExerciseEntry & { source: string; _mergeData?: any }) | null>(null);

    const handleEditExercise = (ex: any) => {
        // Transform to full object if needed, or just pass 'ex' if it matches ExerciseEntry
        // ensuring we have the source if missing
        const fullActivity = { ...ex, source: ex.source || 'manual' };
        setSelectedActivity(fullActivity);
    };

    return (
        <div className="training-page">

            {/* Tab Navigation */}
            <div className="flex p-1 bg-slate-900 border border-white/5 rounded-xl self-start mb-6 overflow-x-auto">
                <button
                    onClick={() => setCurrentTab('overview')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${currentTab === 'overview'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    📊 Översikt
                </button>
                <button
                    onClick={() => navigate('/styrka')}
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap text-slate-500 hover:text-slate-300"
                >
                    🏋️ Styrka
                </button>
                <button
                    onClick={() => setCurrentTab('kondition')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${currentTab === 'kondition'
                        ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    🏃 Kondition
                </button>
                <button
                    onClick={() => setCurrentTab('races')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${currentTab === 'races'
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    🏆 Tävlingar
                </button>
            </div>

            {/* Period Selector - Sticky Header */}
            <div className="sticky top-[64px] z-40 -mx-4 px-4 py-4 mb-8 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shadow-2xl">
                <div className="flex flex-nowrap items-center gap-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 px-3 border-r border-white/5 mr-1">
                        <span className="text-xl">📅</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block">Visa Period</span>
                    </div>
                    {[
                        { id: 'all', label: 'ALLT' },
                        { id: 'ytd', label: 'I ÅR' },
                        { id: 'prev', label: 'FÖREG. ÅR' },
                        { id: '3m', label: '3 MÅN' },
                        { id: '6m', label: '6 MÅN' },
                        { id: '9m', label: '9 MÅN' },
                        { id: 'ttm', label: 'TTM (12M)' }
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => applyPeriodPreset(p.id as any)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${activePreset === p.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conditionally render based on tab */}
            {
                currentTab === 'overview' && (
                    <>

                        {/* Dashboard Overview */}
                        <TrainingOverview
                            exercises={filteredExerciseEntries}
                            year={filterStartDate ? new Date(filterStartDate).getFullYear() : new Date().getFullYear()}
                            isFiltered={true}
                            onExerciseClick={handleEditExercise}
                            periodLabel={
                                activePreset === 'all' ? 'Total Volym' :
                                    activePreset === 'ytd' ? `Årsvolym ${new Date().getFullYear()}` :
                                        activePreset === 'prev' ? `Årsvolym ${new Date().getFullYear() - 1}` :
                                            activePreset === 'ttm' ? 'Trailing 12 Months' :
                                                `Periodens Volym (${activePreset.toUpperCase()})`
                            }
                        />

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
                                                        deleteTrainingCycle(activeCycle!.id);
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

                        {/* Full Width Layout for Charts */}
                        {/* Analysis Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left: Cycle & Progress Chart */}
                            <div className="content-card overflow-hidden">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            📊 Årsöversikt & Utveckling
                                            {activePreset !== 'all' && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">PERIODISERA</span>}
                                        </h3>
                                        <p className="text-slate-400 text-xs mt-1">Vikt, kalorier och träningsbelastning</p>
                                    </div>
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

                                <div className="h-[350px]">
                                    <CycleYearChart
                                        cycles={trainingCycles}
                                        weightEntries={filteredWeightEntries}
                                        nutrition={filteredDailyNutrition}
                                        exercises={filteredExerciseEntries}
                                        zoomMonths={zoomLevel}
                                        visibleMetrics={visibleMetrics}
                                        filterStartDate={filterStartDate}
                                        filterEndDate={filterEndDate}
                                        onEditCycle={handleEditCycle}
                                        onCreateCycleAfter={handleCreateCycleAfter}
                                    />
                                </div>
                            </div>

                            <HealthScoreCard
                                exercises={filteredExerciseEntries}
                                meals={mealEntries}
                                userSettings={{ bmr: calculateBMR() }}
                            />
                        </div>

                        <CycleDetailModal
                            isOpen={isCycleDetailOpen}
                            onClose={() => setIsCycleDetailOpen(false)}
                            cycle={selectedCycle}
                            onSave={updateTrainingCycle}
                            onDelete={deleteTrainingCycle}
                            exercises={exerciseEntries}
                            nutrition={dailyNutrition}
                            onAddGoal={addGoal}
                        />

                        {/* Training Load & Weight Correlation Dashboard */}
                        <TrainingLoadCorrelation
                            exercises={filteredExerciseEntries}
                            weightEntries={filteredWeightEntries}
                        />

                        {/* Exercise Log */}
                        <div className="content-card">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="section-title">Träningsdagbok</h3>
                                <div className="flex items-center gap-4">
                                    {activePreset !== 'all' && (
                                        <div className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/20">
                                            FILTER AKTIVT
                                        </div>
                                    )}
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-slate-800 border-none rounded-lg text-xs p-2 text-white"
                                    />
                                </div>
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
                                                    <div className="text-xs text-slate-500">{formatActivityDuration(ex.durationMinutes)} • {ex.notes || 'Inga anteckningar'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-rose-400 font-bold text-sm">-{ex.caloriesBurned} kcal</span>
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all"
                                                    onClick={(e) => { e.stopPropagation(); deleteExercise(ex.id); }}
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


                        {/* Data Analysis Section - Full Width */}
                        <div className="content-card mt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="section-title">Djupanalys & Statistik</h3>
                                <a
                                    href="#mina-mal"
                                    className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg text-xs uppercase transition-all flex items-center gap-2"
                                >
                                    🎯 Mina Mål
                                </a>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                {/* Stat 1: Total Tonnage */}
                                <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Totalt Tonnage</div>
                                    <div className="text-2xl font-black text-rose-400">
                                        {Math.round(filteredExerciseEntries.reduce((sum, e) => sum + (e.tonnage || 0), 0) / 1000)} <span className="text-sm text-slate-500 font-bold">ton</span>
                                    </div>
                                </div>

                                {/* Stat 2: Total Distance */}
                                <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Distans</div>
                                    <div className="text-2xl font-black text-sky-400">
                                        {Math.round(filteredExerciseEntries.reduce((sum, e) => sum + (e.distance || 0), 0))} <span className="text-sm text-slate-500 font-bold">km</span>
                                    </div>
                                </div>

                                {/* Stat 3: Avg Intensity (Proxy) */}
                                <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Snittduration</div>
                                    <div className="text-2xl font-black text-emerald-400">
                                        {Math.round(filteredExerciseEntries.length > 0 ? filteredExerciseEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / filteredExerciseEntries.length : 0)} <span className="text-sm text-slate-500 font-bold">min</span>
                                    </div>
                                </div>

                                {/* Stat 4: Total Time */}
                                <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Total Träningstid</div>
                                    <div className="text-2xl font-black text-indigo-400">
                                        {Math.round(filteredExerciseEntries.reduce((sum, e) => sum + e.durationMinutes, 0) / 60)} <span className="text-sm text-slate-500 font-bold">h</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Top Activities Table */}
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Topplista Aktiviteter</h4>
                                    <div className="space-y-2">
                                        {Object.entries(filteredExerciseEntries.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {} as Record<string, number>))
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

                                {/* Recent Records - Only show if there's data */}
                                {(exerciseEntries.some(e => e.tonnage) || exerciseEntries.some(e => e.distance)) && (
                                    <div>
                                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Senaste PB & Milstolpar</h4>
                                        {exerciseEntries.some(e => e.tonnage) && (
                                            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 text-center mb-4">
                                                <span className="text-4xl">🏆</span>
                                                <h5 className="text-sm font-bold text-emerald-400 mt-2">Nytt Volymrekord!</h5>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    Du lyfte {Math.round(Math.max(0, ...exerciseEntries.filter(e => e.tonnage).map(e => e.tonnage || 0)))} kg som mest i ett pass.
                                                </p>
                                            </div>
                                        )}
                                        {exerciseEntries.some(e => e.distance) && (
                                            <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-500/10 to-transparent border border-sky-500/20 text-center">
                                                <span className="text-4xl">👟</span>
                                                <h5 className="text-sm font-bold text-sky-400 mt-2">Distanstopp</h5>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    Längsta passet var {Math.max(0, ...exerciseEntries.filter(e => e.distance).map(e => e.distance || 0))} km.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Goals Section */}
                        <div id="mina-mal" className="content-card mt-6 scroll-mt-24">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="section-title">🎯 Mina Mål</h3>
                                <button
                                    onClick={() => { setEditingGoal(null); setIsGoalModalOpen(true); }}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs uppercase transition-all"
                                >
                                    + Nytt Mål
                                </button>
                            </div>

                            {performanceGoals.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {performanceGoals.map(goal => {
                                        // Calculate progress
                                        const now = new Date();
                                        const weekStart = new Date(now);
                                        weekStart.setDate(now.getDate() - now.getDay() + 1);
                                        const weekStartStr = weekStart.toISOString().split('T')[0];

                                        let current = 0;
                                        if (goal.type === 'frequency' && goal.targets[0]?.exerciseType) {
                                            current = exerciseEntries.filter(e =>
                                                e.type === goal.targets[0].exerciseType &&
                                                e.date >= weekStartStr
                                            ).length;
                                        } else if (goal.type === 'distance') {
                                            current = exerciseEntries
                                                .filter(e => e.date >= weekStartStr)
                                                .reduce((sum, e) => sum + (e.distance || 0), 0);
                                        } else if (goal.type === 'tonnage') {
                                            current = exerciseEntries
                                                .filter(e => e.date >= weekStartStr)
                                                .reduce((sum, e) => sum + (e.tonnage || 0), 0) / 1000;
                                        }

                                        const target = goal.targets[0]?.count || goal.targets[0]?.value || 1;
                                        const percentage = (current / target) * 100;

                                        return (
                                            <GoalCard
                                                key={goal.id}
                                                goal={goal}
                                                progress={{ current, target, percentage }}
                                                onEdit={() => { setEditingGoal(goal); setIsGoalModalOpen(true); }}
                                                onDelete={() => deleteGoal(goal.id)}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-600">
                                    <span className="text-4xl block mb-3">🎯</span>
                                    <p className="text-sm">Inga mål ännu. Skapa ett för att börja spåra din framgång!</p>
                                </div>
                            )}
                        </div>
                    </>
                )
            }

            {
                currentTab === 'kondition' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <KonditionView
                            filterStartDate={filterStartDate}
                            filterEndDate={filterEndDate}
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                        />
                    </div>
                )
            }

            {
                currentTab === 'races' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <RaceList
                            exerciseEntries={exerciseEntries}
                            universalActivities={universalActivities}
                            filterStartDate={filterStartDate}
                            filterEndDate={filterEndDate}
                        />
                    </div>
                )
            }

            {/* Goal Modal */}
            <GoalModal
                isOpen={isGoalModalOpen}
                onClose={() => setIsGoalModalOpen(false)}
                onSave={(goalData) => {
                    if (editingGoal) {
                        updateGoal(editingGoal.id, goalData);
                    } else {
                        addGoal(goalData);
                    }
                }}
                cycles={trainingCycles}
                editingGoal={editingGoal}
            />

            {/* Activity Detail / Edit Modal */}
            {selectedActivity && (
                <ActivityDetailModal
                    activity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                    initiallyEditing={true}
                />
            )}
        </div>
    );
}
