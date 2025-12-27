import React, { useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate } from '../models/types.ts';
import { HealthScoreCard } from '../components/dashboard/HealthScoreCard.tsx';
import { Link, useNavigate } from 'react-router-dom';
import {
    Dumbbell,
    Utensils,
    Flame,
    Moon,
    Weight as WeightIcon,
    Activity,
    Calendar,
    CheckCircle2,
    TrendingUp,
    Zap,
    Coffee,
    ArrowRight
} from 'lucide-react';

export function DashboardPage() {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const {
        exerciseEntries,
        mealEntries,
        getLatestWeight,
        weightEntries,
        trainingCycles,
        plannedActivities
    } = useData();

    const today = getISODate();
    const health = useHealth(today);

    // Derived Data for Score Card
    const todaysExercises = useMemo(() =>
        exerciseEntries.filter(e => e.date === today),
        [exerciseEntries, today]
    );

    const todaysMeals = useMemo(() =>
        mealEntries.filter(m => m.date === today),
        [mealEntries, today]
    );

    // Timeline Construction
    const timelineItems = useMemo(() => {
        const items = [
            ...todaysExercises.map(ex => ({
                id: ex.id,
                type: 'workout',
                title: ex.type,
                subtitle: `${ex.durationMinutes} min • ${ex.caloriesBurned} kcal`,
                time: 'Träning',
                icon: <Dumbbell className="w-4 h-4 text-emerald-400" />,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/5',
                border: 'border-emerald-500/10'
            })),
            ...todaysMeals.map(meal => ({
                id: meal.id,
                type: 'food',
                title: (() => {
                    const names: Record<string, string> = {
                        'breakfast': 'Frukost',
                        'lunch': 'Lunch',
                        'dinner': 'Middag',
                        'snack': 'Mellanmål',
                        'beverage': 'Dryck'
                    };
                    return names[meal.mealType] || 'Måltid';
                })(),
                subtitle: `${meal.items.length} komponenter`,
                time: meal.mealType,
                icon: <Utensils className="w-4 h-4 text-amber-400" />,
                color: 'text-amber-400',
                bg: 'bg-amber-500/5',
                border: 'border-amber-500/10'
            }))
        ];

        const sortOrder: Record<string, number> = {
            'breakfast': 1,
            'lunch': 2,
            'workout': 3,
            'dinner': 4,
            'snack': 5,
            'beverage': 6
        };

        return items.sort((a, b) => {
            const ordA = sortOrder[a.time.toLowerCase()] || sortOrder[a.type] || 99;
            const ordB = sortOrder[b.time.toLowerCase()] || sortOrder[b.type] || 99;
            return ordA - ordB;
        });
    }, [todaysExercises, todaysMeals]);

    // Weight Logic
    const weight = getLatestWeight() || 0;
    const recentWeights = useMemo(() => {
        return [...weightEntries]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-10); // Last 10 points
    }, [weightEntries]);

    // Sparkline SVG Path Generation
    const sparklinePath = useMemo(() => {
        if (recentWeights.length < 2) return "";
        const minW = Math.min(...recentWeights.map(w => w.weight));
        const maxW = Math.max(...recentWeights.map(w => w.weight));
        const range = maxW - minW || 1;

        const width = 100;
        const height = 30;

        const points = recentWeights.map((w, i) => {
            const x = (i / (recentWeights.length - 1)) * width;
            const y = height - ((w.weight - minW) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        return points;
    }, [recentWeights]);

    // Formatting Date
    const dateStr = new Date().toLocaleDateString('sv-SE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    return (
        <div className="min-h-screen pb-20 animate-in fade-in duration-500">
            {/* MINIMAL HERO */}
            <div className="pt-8 pb-8 px-4 md:px-8">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1 capitalize">
                            {dateStr}
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight leading-none">
                            God morgon.
                        </h1>
                    </div>

                    <div className="flex gap-2 opacity-80 hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => navigate('/planera')}
                            className="bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-bold border border-white/5 transition-colors flex items-center gap-2"
                        >
                            <Calendar className="w-3 h-3" />
                            Planera
                        </button>
                        <button
                            onClick={() => navigate('/training')}
                            className="bg-emerald-900/30 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-emerald-500/20 transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] flex items-center gap-2"
                        >
                            <Dumbbell className="w-3 h-3" />
                            Logga Pass
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN DASHBOARD GRID */}
            <div className="max-w-4xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* LEFT COLUMN - ESSENTIALS */}
                <div className="md:col-span-8 flex flex-col gap-6">
                    {/* 1. HEALTH SCORE */}
                    <HealthScoreCard
                        exercises={exerciseEntries}
                        meals={mealEntries}
                        userSettings={settings}
                    />

                    {/* 2. ACTION & STATS GRID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* A. TODAY'S TRAINING MISSION */}
                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between group hover:bg-slate-900/60 transition-colors relative overflow-hidden">
                            <div className="relative z-10 flex justify-between items-start mb-3">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3 text-emerald-500" />
                                        Dagens Pass
                                    </div>
                                </div>
                                <button onClick={() => navigate('/training')} className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors">
                                    Ändra &rarr;
                                </button>
                            </div>

                            {plannedActivities.find(p => p.date === today) ? (
                                (() => {
                                    const plan = plannedActivities.find(p => p.date === today);
                                    return (
                                        <div className="relative z-10">
                                            <div className="mb-4">
                                                <div className="text-lg font-bold text-white leading-tight">{plan?.title}</div>
                                                <div className="text-xs text-slate-400 mt-1">{plan?.description || `${plan?.estimatedDistance} km ${plan?.type}`}</div>
                                                <div className="flex gap-2 mt-2">
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-mono">
                                                        {plan?.targetPace}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/training?log=${plan?.id}`)}
                                                className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-xs rounded-lg transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Utför & Logga
                                            </button>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="relative z-10">
                                    <div className="flex-1 flex flex-col justify-center items-center text-center py-2 opacity-60">
                                        <Coffee className="w-6 h-6 text-slate-600 mb-2" />
                                        <div className="text-xs font-medium text-slate-300">Vila planerad</div>
                                    </div>
                                    <button
                                        onClick={() => navigate('/coach')}
                                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-all border border-white/5 mt-2"
                                    >
                                        + Planera Pass
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* B. NUTRITION & CALORIES */}
                        <div className="bg-slate-900/40 border border-white/5 p-4 rounded-xl flex flex-col justify-between group hover:bg-slate-900/60 transition-colors relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                                    <Flame className="w-3 h-3 text-amber-500" />
                                    Energi
                                </div>
                                <div className="text-[10px] font-mono text-slate-500">{(health.remainingCalories || 0).toFixed(0)} kcal kvar</div>
                            </div>

                            <div className="mb-4 relative z-10">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-white">{(health.dailyCaloriesConsumed || 0).toFixed(0)}</span>
                                    <span className="text-sm font-medium text-slate-500">/ {health.targetCalories || 2000}</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                                    <div className={`h-full ${(health.dailyCaloriesConsumed || 0) > (health.targetCalories || 2000) ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, ((health.dailyCaloriesConsumed || 0) / (health.targetCalories || 1)) * 100)}%` }}></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 relative z-10">
                                <button
                                    onClick={() => navigate('/calories')}
                                    className="py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg border border-white/5 flex items-center justify-center gap-2"
                                >
                                    Logga
                                </button>
                                <button
                                    onClick={() => navigate('/calories?quick=true')}
                                    className="py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-lg border border-amber-500/20 flex items-center justify-center gap-1"
                                >
                                    <Zap className="w-3 h-3" />
                                    Snabb
                                </button>
                            </div>
                        </div>

                        {/* C. QUICK ACTIONS / SYNERGY ROW */}
                        <div className="sm:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">

                            {/* Weigh In with Sparkline */}
                            <button onClick={() => navigate('/health')} className="bg-slate-900/30 hover:bg-slate-800 p-3 rounded-xl border border-white/5 text-left group transition-all relative overflow-hidden">
                                <div className="absolute inset-0 opacity-10 pointer-events-none flex items-end">
                                    {/* Simple SVG Sparkline Background */}
                                    {sparklinePath && (
                                        <svg width="100%" height="40%" viewBox="0 0 100 30" preserveAspectRatio="none" className="text-rose-500 w-full mb-0">
                                            <polyline points={sparklinePath} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                                        </svg>
                                    )}
                                </div>
                                <div className="relative z-10">
                                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 group-hover:text-rose-400 flex items-center gap-1">
                                        <WeightIcon className="w-3 h-3" />
                                        Vikt
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <div className="text-sm font-bold text-white">{weight > 0 ? weight : '-'}</div>
                                        <div className="text-[10px] font-medium text-slate-500">kg</div>
                                    </div>
                                </div>
                            </button>

                            {/* Phase/Coach */}
                            <button onClick={() => navigate('/coach')} className="bg-slate-900/30 hover:bg-slate-800 p-3 rounded-xl border border-white/5 text-left group transition-all">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 group-hover:text-blue-400 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    Fas
                                </div>
                                <div className="text-sm font-bold text-white truncate">{health.activeCycle?.name || 'Grund'}</div>
                            </button>

                            {/* Sleep Placeholder */}
                            <button className="bg-slate-900/30 hover:bg-slate-800 p-3 rounded-xl border border-white/5 text-left group transition-all opacity-50 cursor-not-allowed">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
                                    <Moon className="w-3 h-3" />
                                    Sömn
                                </div>
                                <div className="text-sm font-bold text-white">- h</div>
                            </button>

                            {/* Synergy / Streak Tip */}
                            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                                <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold uppercase mb-0.5">
                                    <Zap className="w-3 h-3" />
                                    Synergi
                                </div>
                                <span className="text-xs font-bold text-indigo-300 leading-tight">
                                    {(health.dailyCaloriesBurned || 0) > 500 ? 'Ät lite mer!' : 'Balansera'}
                                </span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* RIGHT COLUMN - LOGGED HISTORY (CONSOLIDATED TIMELINE) */}
                <div className="md:col-span-4 pl-0 md:pl-4 border-l border-white/5 flex flex-col gap-4">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-3 h-3" />
                        Tidslinje
                    </h3>

                    <div className="space-y-3">
                        {timelineItems.map(item => (
                            <div key={item.id} className={`${item.bg} ${item.border} border rounded-lg p-3 flex justify-between items-center group hover:brightness-110 transition-all`}>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-black/10">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-xs ${item.color} capitalize`}>{item.time}</div>
                                        <div className="text-xs font-bold text-slate-200">{item.title}</div>
                                        <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {timelineItems.length === 0 && (
                            <div className="text-[11px] text-slate-600 italic py-8 text-center border border-dashed border-slate-800 rounded-lg flex flex-col items-center gap-2">
                                <Calendar className="w-6 h-6 opacity-20" />
                                <span>Inget loggat idag ännu.</span>
                            </div>
                        )}
                    </div>

                    {/* Summary Mini-Table */}
                    {timelineItems.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-wider">
                                <span>TOTALT IDAG</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-900 p-2 rounded border border-white/5">
                                    <div className="text-[10px] text-slate-500 mb-0.5">Intag</div>
                                    <div className="text-xs font-bold text-white">{(health.dailyCaloriesConsumed || 0).toFixed(0)} kcal</div>
                                </div>
                                <div className="bg-slate-900 p-2 rounded border border-white/5">
                                    <div className="text-[10px] text-slate-500 mb-0.5">Förbränt</div>
                                    <div className="text-xs font-bold text-white">{(health.dailyCaloriesBurned || 0).toFixed(0)} kcal</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
