import React, { useMemo, useState } from 'react';
// Version: 1.0.1 - Cache Busting Fix
import { useNavigate } from 'react-router-dom';
import { useData } from '../../../context/DataShared.ts';
import { useSettings } from '../../../context/SettingsContext.tsx';
import { getActiveCalorieTarget } from '../../../utils/calorieTarget.ts';
import {
    Zap,
    Flame,
    Info,
    BrainCircuit,
    Calculator,
    Lock,
    Unlock,
    Scale,
    Weight,
    Target,
    Settings as SettingsIcon
} from 'lucide-react';

type ViewMode = 'calories' | 'protein' | 'carbs' | 'fat' | 'training';

export function WeeklyMetabolismAnalyticCard() {
    const {
        unifiedActivities,
        trainingPeriods,
        performanceGoals,
        calculateDailyNutrition,
        weightEntries
    } = useData();
    const { settings, updateSettings } = useSettings();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<ViewMode>('calories');
    const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    const toLocalISO = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const stats = useMemo(() => {
        const now = new Date();
        const todayISO = toLocalISO(now);
        const d = new Date(now);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        let totalConsumed = 0;
        let totalBurned = 0;
        let totalAdjustedTarget = 0;
        let totalMetabolism = 0; // For weight theory: BMR + 100% of activity
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let daysPassed = 0;
        let bankedBalance = 0; // Cumulative balance through YESTERDAY
        const dailyBreakdown: any[] = [];

        // --- NEW: Physics-based BMR (Mifflin-St Jeor) ---
        const age = settings.birthYear ? (new Date().getFullYear() - settings.birthYear) : 34;
        const height = settings.height || 180;
        const gender = settings.gender || 'male';
        const lastWeight = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1].weight : (settings.weight || 75);
        const metabolicBaselineRaw = (10 * lastWeight) + (6.25 * height) - (5 * age) + (gender === 'female' ? -161 : 5);
        const palMultiplier = settings.metabolicBaselineMultiplier || 1.2;
        const metabolicBaseline = metabolicBaselineRaw * palMultiplier;
        const multiplier = settings.exerciseCalorieMultiplier ?? 1.0;

        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const isoDate = toLocalISO(date);
            const isFuture = date > now && isoDate !== todayISO;
            const isToday = isoDate === todayISO;

            const nutrition = calculateDailyNutrition(isoDate);
            const dailyActivities = unifiedActivities.filter(a => a.date === isoDate && !(a.excludeFromStats || a.performance?.excludeFromStats));
            const dailyBurned = dailyActivities.reduce((sum, a) => sum + (a.caloriesBurned || 0), 0);

            const targetResult = getActiveCalorieTarget(
                isoDate,
                trainingPeriods,
                performanceGoals,
                settings.dailyCalorieGoal || 2000,
                2500,
                settings.calorieMode || 'tdee',
                dailyBurned,
                multiplier
            );

            const weightsOnDate = weightEntries.filter(w => w.date === isoDate);
            const weightValue = weightsOnDate.length > 0 ? weightsOnDate[0].weight : null;

            if (isoDate <= todayISO) {
                daysPassed++;
                totalConsumed += nutrition.calories;
                totalBurned += dailyBurned;
                totalAdjustedTarget += targetResult.calories;
                totalMetabolism += metabolicBaseline + dailyBurned;
                totalProtein += nutrition.protein;
                totalCarbs += nutrition.carbs;
                totalFat += nutrition.fat;

                // Only bank balance for days that are completed (prior to today)
                if (isoDate < todayISO) {
                    bankedBalance += (targetResult.calories - nutrition.calories);
                }
            }

            dailyBreakdown.push({
                date: isoDate,
                consumed: Math.round(nutrition.calories),
                target: Math.round(targetResult.calories),
                burned: Math.round(dailyBurned),
                multiplier: multiplier,
                effectiveBurned: Math.round(dailyBurned * multiplier),
                balance: Math.round(targetResult.calories - nutrition.calories),
                protein: Math.round(nutrition.protein),
                carbs: Math.round(nutrition.carbs),
                fat: Math.round(nutrition.fat),
                weight: weightValue,
                isFuture, isToday,
                dayName: ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'][i]
            });
        }

        const weekWeights = dailyBreakdown.map(d => d.weight).filter(w => w !== null);
        const startWeight = weekWeights.length > 0 ? weekWeights[0] : (weightEntries[weightEntries.length - 1]?.weight || 0);
        const currentWeight = weekWeights.length > 0 ? weekWeights[weekWeights.length - 1] : startWeight;
        const physicsDeficit = totalConsumed - totalMetabolism;
        const activeWeightGoal = performanceGoals.find(g => (g.type === 'weight' || g.type === 'nutrition') && g.status === 'active');

        const activePeriod = trainingPeriods.find(p => p.status === 'active' || (p.startDate <= todayISO && p.endDate >= todayISO));
        const daysInPeriodRemaining = activePeriod ? Math.max(0, (new Date(activePeriod.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        // Use completed days for averages
        const completedDays = Math.max(1, daysPassed - 1);
        const avgDailyPhysicsDeficit = physicsDeficit / daysPassed;

        const sundayForecast = currentWeight + (avgDailyPhysicsDeficit * (7 - daysPassed) / 7700);
        const periodEndForecast = currentWeight + (avgDailyPhysicsDeficit * daysInPeriodRemaining / 7700);

        return {
            totalConsumed, totalBurned, totalAdjustedTarget, totalProtein, totalCarbs, totalFat, daysPassed, dailyBreakdown,
            balance: bankedBalance, // KPI shows banked through yesterday
            todayBalance: dailyBreakdown.find(d => d.isToday)?.balance || 0,
            physicsBalance: physicsDeficit,
            activeWeightGoal,
            activePeriod,
            forecasts: {
                sunday: sundayForecast,
                periodEnd: periodEndForecast,
                avgDaily: avgDailyPhysicsDeficit,
                daysRemaining: daysInPeriodRemaining
            },
            weightStats: {
                start: startWeight,
                current: currentWeight,
                actualChange: currentWeight - startWeight,
                theoreticalChange: physicsDeficit / 7700,
                totalDeficit: bankedBalance // budget deficit through yesterday
            },
            goals: { protein: settings.dailyProteinGoal || 150, carbs: settings.dailyCarbsGoal || 200, fat: settings.dailyFatGoal || 60 },
            metabolicBaseline
        };
    }, [unifiedActivities, trainingPeriods, performanceGoals, settings, calculateDailyNutrition, weightEntries]);

    const activeDay = selectedDayIdx !== null ? stats.dailyBreakdown[selectedDayIdx] : stats.dailyBreakdown.find(d => d.isToday);
    const getVal = (day: any) => {
        if (viewMode === 'protein') return day.protein;
        if (viewMode === 'carbs') return day.carbs;
        if (viewMode === 'fat') return day.fat;
        if (viewMode === 'training') return day.burned;
        return day.consumed;
    };
    const getTarget = (day: any) => {
        if (viewMode === 'calories') return day.target;
        if (viewMode === 'protein') return stats.goals.protein;
        if (viewMode === 'carbs') return stats.goals.carbs;
        if (viewMode === 'fat') return stats.goals.fat;
        return 0;
    };

    const maxVal = Math.max(...stats.dailyBreakdown.map(d => Math.max(getVal(d), getTarget(d))), 10) * 1.15;

    return (
        <div className="bg-slate-900 border border-white/5 rounded-[1.5rem] p-5 shadow-2xl relative overflow-hidden text-slate-200">
            {/* 1. EXTENDED KPI BAR (Dual Mode) */}
            <div className="flex flex-wrap items-center justify-between gap-6 mb-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-6">
                    {/* BANKAT DUAL */}
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Bankat (Saldo)</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black ${stats.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.balance >= 0 ? `+${Math.round(stats.balance)}` : Math.round(stats.balance)}
                                </span>
                                <span className="text-[8px] font-bold text-slate-600">kcal</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Idag (+/-)</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black ${stats.todayBalance >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                    {stats.todayBalance > 0 ? '+' : ''}{Math.round(stats.todayBalance)}
                                </span>
                                <span className="text-[8px] font-bold text-slate-600">kcal</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Metabolism (Vecka)</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-black ${stats.physicsBalance <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.physicsBalance <= 0 ? '' : '+'}{Math.round(stats.physicsBalance)}
                                </span>
                                <span className="text-[8px] font-bold text-slate-600">kcal v. BMR</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-white/5" />

                    {/* PROGNOSER */}
                    <div className="flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Söndag</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-indigo-300">
                                    {stats.forecasts.sunday.toFixed(1)}
                                </span>
                                <span className="text-[8px] font-bold text-slate-600">kg</span>
                            </div>
                        </div>
                        {stats.activePeriod && (
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Period-slut</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-emerald-400">
                                        {stats.forecasts.periodEnd.toFixed(1)}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-600">kg</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-8 w-[1px] bg-white/5 hidden sm:block" />

                    <div className="hidden sm:flex flex-col">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Vecko-förändring</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-xl font-black ${stats.weightStats.actualChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stats.weightStats.actualChange > 0 ? '+' : ''}{stats.weightStats.actualChange.toFixed(1)}
                            </span>
                            <span className="text-[8px] font-bold text-slate-600">kg</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5">
                    {(['calories', 'protein', 'carbs', 'fat', 'training'] as ViewMode[]).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-white'
                                }`}
                        >
                            {mode === 'calories' ? 'Energi' : mode === 'protein' ? 'Prot' : mode === 'carbs' ? 'Kolh' : mode === 'fat' ? 'Fett' : 'Fys'}
                        </button>
                    ))}
                </div>
            </div>

            {/* NEW: GOAL SPECIFICS BAR (The "What applies" section) */}
            <div
                onClick={() => stats.activeWeightGoal && navigate(`/goals?goal=${stats.activeWeightGoal.id}`)}
                className={`flex items-center gap-4 bg-slate-950/40 p-2.5 px-4 rounded-xl border border-white/5 mb-4 overflow-x-auto no-scrollbar whitespace-nowrap transition-all ${stats.activeWeightGoal ? 'cursor-pointer hover:bg-slate-950/60 hover:border-white/10 active:scale-[0.99]' : ''}`}
            >
                <div className="flex items-center gap-1.5 shrink-0">
                    <Target size={12} className="text-indigo-400" />
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Mål-detaljer:</span>
                    <span className="text-[10px] font-bold text-white">{stats.activeWeightGoal?.name || 'Metabolic Engine Active'}</span>
                </div>
                <div className="h-3 w-[1px] bg-white/10 shrink-0" />
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase">Underhåll</span>
                        <span className="text-[10px] font-black text-indigo-300">{Math.round(stats.metabolicBaseline)}</span>
                    </div>
                    <span className="text-slate-700 text-[10px] font-bold">-</span>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase">Underskott</span>
                        <span className="text-[10px] font-black text-rose-400">-{Math.round(stats.metabolicBaseline - (settings.dailyCalorieGoal || 2000))}</span>
                    </div>
                    <span className="text-slate-700 text-[10px] font-bold">+</span>
                    <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase">Träning</span>
                        <span className="text-[10px] font-black text-amber-300">{Math.round((settings.exerciseCalorieMultiplier ?? 1.0) * 100)}%</span>
                    </div>
                </div>
                <div className="h-3 w-[1px] bg-white/10 shrink-0" />
                <div className="flex flex-col shrink-0">
                    <span className="text-[8px] font-black text-slate-600 uppercase">Protein</span>
                    <span className="text-[10px] font-black text-emerald-400">{settings.proteinMultiplier || (stats.goals.protein / (stats.weightStats.current || 80)).toFixed(1)}g/kg <span className="text-slate-600 font-bold">({stats.goals.protein}g)</span></span>
                </div>
            </div>

            {/* 2. MAIN CONSOLE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5 items-stretch">
                <div className="lg:col-span-9 bg-slate-950/40 p-5 rounded-2xl border border-white/5 flex flex-col h-48 relative">
                    <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 relative pb-2">
                        {stats.dailyBreakdown.map((day, idx) => {
                            const val = getVal(day);
                            const currentTgt = getTarget(day);
                            const percent = (val / maxVal) * 100;
                            const tgtPercent = (currentTgt / maxVal) * 100;
                            const isSelected = selectedDayIdx === idx || (selectedDayIdx === null && day.isToday);

                            return (
                                <div
                                    key={day.date}
                                    className={`flex-1 flex flex-col items-center gap-2 group cursor-pointer relative transition-all ${day.isFuture ? 'opacity-15' : 'opacity-100'} ${selectedDayIdx === idx ? 'scale-105 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`}
                                    onClick={() => setSelectedDayIdx(selectedDayIdx === idx ? null : idx)}
                                >
                                    <div className="w-full h-full relative flex items-end justify-center min-h-[40px]">
                                        {currentTgt > 0 && (
                                            <div className="absolute bottom-0 w-full bg-slate-800/40 rounded-t-md" style={{ height: `${tgtPercent}%` }} />
                                        )}
                                        <div
                                            className={`relative z-10 w-full rounded-t-md transition-all duration-700 ${viewMode === 'training' ? 'bg-amber-400' :
                                                    (viewMode === 'calories' && val > currentTgt) ? 'bg-rose-500' : 'bg-emerald-500'
                                                }`}
                                            style={{ height: `${percent}%`, minHeight: val > 0 ? '6px' : '3px' }}
                                        >
                                            <div className={`absolute -top-6 inset-x-0 text-center text-[9px] font-black ${isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                                                {val}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`text-[9px] font-black uppercase ${day.isToday ? 'text-indigo-400' : 'text-slate-600'}`}>{day.dayName}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="lg:col-span-3 flex flex-col gap-3">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex-1 flex flex-col justify-between">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{activeDay?.dayName} Analys</span>
                            <span className="text-[9px] font-bold text-slate-500">{activeDay?.date}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-500">INTAG</span>
                                <span className="text-white">{activeDay?.consumed} <span className="text-[9px] opacity-40">kcal</span></span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-500">TRÄNING</span>
                                <span className="text-amber-400">
                                    +{activeDay?.effectiveBurned}
                                    <span className="text-[8px] opacity-40 ml-1">({Math.round(activeDay?.multiplier * 100)}%)</span>
                                </span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold">
                                <span className="text-slate-500">METABOLISM</span>
                                <span className="text-indigo-300">
                                    {Math.round(stats.metabolicBaseline + (activeDay?.burned || 0))}
                                </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-white/5 text-[14px] font-black">
                                <span className="text-slate-400">NETTO</span>
                                <span className={activeDay?.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {activeDay?.balance >= 0 ? '+' : ''}{activeDay?.balance}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {stats.balance >= 0 ? <Lock size={12} className="text-emerald-400" /> : <Unlock size={12} className="text-rose-400" />}
                            <span className="text-[9px] font-black uppercase text-slate-500">Status</span>
                        </div>
                        <span className={`text-[10px] font-bold ${stats.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.balance >= 0 ? 'SAFE' : 'OVER LIMIT'}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. BOTTOM UTILITY STRIP */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { l: 'Protein', c: stats.totalProtein, g: stats.goals.protein * stats.daysPassed, total: stats.goals.protein * 7, color: 'indigo', today: stats.dailyBreakdown.find(d => d.isToday)?.protein || 0 },
                    { l: 'Kolhydr.', c: stats.totalCarbs, g: stats.goals.carbs * stats.daysPassed, total: stats.goals.carbs * 7, color: 'emerald', today: stats.dailyBreakdown.find(d => d.isToday)?.carbs || 0 },
                    { l: 'Fett', c: stats.totalFat, g: stats.goals.fat * stats.daysPassed, total: stats.goals.fat * 7, color: 'amber', today: stats.dailyBreakdown.find(d => d.isToday)?.fat || 0 }
                ].map(m => {
                    const banked = Math.max(0, m.c - m.today);
                    const bankedGoal = stats.goals.protein * (stats.daysPassed - 1); // Fixed: math depends on m context but generic goal for now
                    const currentGoal = stats.goals.protein * stats.daysPassed;
                    // Fix goals for specific macros
                    const mGoal = m.l === 'Protein' ? stats.goals.protein : m.l === 'Kolhydr.' ? stats.goals.carbs : stats.goals.fat;
                    const mBankedGoal = mGoal * (stats.daysPassed - 1);
                    const mFullGoal = mGoal * stats.daysPassed;

                    return (
                        <div key={m.l} className="bg-slate-950/30 p-3 rounded-xl border border-white/5 flex flex-col justify-center min-w-[120px]">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider font-mono">{m.l}</span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[7px] font-bold text-slate-600 uppercase">Bankat</span>
                                    <span className={`text-[10px] font-black ${banked >= mBankedGoal ? 'text-emerald-400' : 'text-slate-300'}`}>
                                        {Math.round(banked)}<span className="opacity-30">/{Math.round(mBankedGoal)}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-[7px] font-bold text-slate-500 uppercase">Total</span>
                                    <span className={`text-[10px] font-black ${m.c >= mFullGoal ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {Math.round(m.c)}<span className="opacity-30">/{Math.round(mFullGoal)}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="h-1 bg-slate-900 rounded-full overflow-hidden mt-2">
                                <div className={`h-full bg-${m.color}-500`} style={{ width: `${Math.min((m.c / (mGoal * 7)) * 100, 100)}%` }} />
                            </div>
                        </div>
                    );
                })}

                <button 
                    onClick={() => setShowDetails(!showDetails)}
                    className={`bg-indigo-500 hover:bg-indigo-400 text-white p-3 rounded-xl flex items-center justify-center gap-2 transition-all group active:scale-95 shadow-lg shadow-indigo-500/10 ${showDetails ? 'ring-2 ring-indigo-400' : ''}`}
                >
                    <Calculator size={14} className="group-hover:rotate-12 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-wider">{showDetails ? 'Göm Detaljer' : 'Beräkna & Detaljer'}</span>
                </button>
            </div>

            {showDetails && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-4 duration-500 overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="text-slate-500 border-b border-white/5">
                                <th className="text-left py-2 font-black uppercase tracking-widest">Dag</th>
                                <th className="text-right py-2 font-black uppercase tracking-widest">Intag</th>
                                <th className="text-right py-2 font-black uppercase tracking-widest">Träning</th>
                                <th className="text-right py-2 font-black uppercase tracking-widest">Balans</th>
                                <th className="text-right py-2 font-black uppercase tracking-widest">Netto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.dailyBreakdown.map(d => (
                                <tr key={d.date} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${d.isToday ? 'bg-indigo-500/5' : ''}`}>
                                    <td className="py-2 font-bold">{d.dayName} <span className="text-[8px] opacity-40 ml-1">{d.date.split('-').slice(1).join('/')}</span></td>
                                    <td className="text-right py-2 font-mono">{d.consumed}</td>
                                    <td className="text-right py-2 font-mono text-amber-400">+{d.effectiveBurned}</td>
                                    <td className="text-right py-2 font-mono text-indigo-300">{Math.round(stats.metabolicBaseline + d.burned)}</td>
                                    <td className={`text-right py-2 font-mono font-bold ${d.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {d.balance > 0 ? '+' : ''}{d.balance}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center px-2 gap-4">
                <div className="flex items-center gap-4 text-[8px] font-black text-slate-700 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <BrainCircuit size={10} />
                        Theoretical Mass Loss Index: {Math.abs(stats.weightStats.theoreticalChange).toFixed(3)}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Bas-aktivitet (PAL)</span>
                        <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-white/5">
                            {[1.0, 1.1, 1.2, 1.3, 1.4, 1.5].map(v => (
                                <button
                                    key={v}
                                    onClick={() => updateSettings({ metabolicBaselineMultiplier: v })}
                                    className={`px-2 py-1 text-[8px] font-black rounded-md transition-all ${
                                        (settings.metabolicBaselineMultiplier || 1.2) === v 
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                        : 'text-slate-600 hover:text-slate-400'
                                    }`}
                                >
                                    {v.toFixed(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="text-[8px] font-bold text-slate-700 uppercase">v3.9</div>
                </div>
            </div>
        </div>
    );
}
