import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate, DailyVitals, generateId } from '../models/types.ts';
import { useNavigate } from 'react-router-dom';
import { getActiveCalorieTarget } from '../utils/calorieTarget.ts';
import { MeasurementEntryModal } from '../components/dashboard/MeasurementEntryModal.tsx';
import {
    Flame,
    Check,
    CheckCircle,
    ChevronRight,
    AlertCircle,
    Calendar,
    Target,
    ChevronLeft,
    RefreshCw
} from 'lucide-react';
import { ActiveGoalsCard } from '../components/dashboard/ActiveGoalsCard.tsx';
import { DailySummaryCard } from '../components/dashboard/DailySummaryCard.tsx';
import { StravaActivityImportModal } from '../components/integrations/StravaActivityImportModal.tsx';
import { DashboardActionFAB } from '../components/dashboard/DashboardActionFAB.tsx';
import { ImportWorkoutModal } from '../components/training/ImportWorkoutModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { WeeklySummary } from '../components/dashboard/WeeklySummary.tsx';
import { EstimateLunchModal } from '../components/calories/EstimateLunchModal.tsx';
import { useAnalytics } from '../context/AnalyticsContext.tsx';
import { CreatePostModal } from '../components/feed/CreatePostModal.tsx';

// Feature Components
import { DailyIntakeCard } from '../features/dashboard/components/DailyIntakeCard.tsx';
import { TrainingCard } from '../features/dashboard/components/TrainingCard.tsx';
import { HealthMetricsCard } from '../features/dashboard/components/HealthMetricsCard.tsx';
import { WeeklyTimeline } from '../features/dashboard/components/WeeklyTimeline.tsx';
import { DashboardSleepCard, DashboardWaterCard, DashboardAlcoholCard, DashboardCaffeineCard } from '../features/dashboard/components/QuickLogCards.tsx';
import { WeeklyMetabolismAnalyticCard } from '../features/dashboard/components/WeeklyMetabolismAnalyticCard.tsx';
import { ReadinessStreakCard } from '../features/dashboard/components/ReadinessStreakCard.tsx';

// --- Helper Functions ---

const getRangeStartDate = (range: '7d' | '14d' | '30d' | '3m' | '1y' | 'year' | 'all') => {
    const d = new Date();
    if (range === '7d') d.setDate(d.getDate() - 7);
    else if (range === '14d') d.setDate(d.getDate() - 14);
    else if (range === '30d') d.setDate(d.getDate() - 30);
    else if (range === '3m') d.setMonth(d.getMonth() - 3);
    else if (range === '1y') d.setFullYear(d.getFullYear() - 1);
    else if (range === 'year') {
        d.setMonth(0, 1); // Jan 1st
    }
    else return '0000-00-00';
    return d.toISOString().split('T')[0];
};

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
        addMealEntry,
        weightEntries,
        bodyMeasurements,
        deleteWeightEntry,
        deleteBodyMeasurement,
        trainingPeriods,
        performanceGoals,
        toggleIncompleteDay,
        toggleCompleteDay,
        dailyVitals,
        selectedDate,
        setSelectedDate,
        refreshData,
        plannedActivities,
        unifiedActivities
    } = useData();
    const { token } = useAuth();
    const { logEvent } = useAnalytics();

    const health = useHealth(selectedDate);
    const today = getISODate();

    // Local state for interactivity
    const [vitals, setVitals] = useState<DailyVitals>({ water: 0, sleep: 0, caffeine: 0, alcohol: 0, updatedAt: '' });
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [tempWaist, setTempWaist] = useState<string>("");
    const [tempChest, setTempChest] = useState<string>("");
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<any | null>(null);
    const [weightRange, setWeightRange] = useState<'7d' | '14d' | '30d' | '3m' | '1y' | 'year' | 'all'>('1y');
    const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
    const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
    const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
    const [isHoveringChart, setIsHoveringChart] = useState(false);
    const [isHoveringTraining, setIsHoveringTraining] = useState(false); // State shared between Intake and Training cards

    // Handle file import
    const handleImport = async (file: File, source: 'strengthlog' | 'hevy') => {
        console.log('[DashboardPage] handleImport', { file: !!file, token: !!token, source });
        if (!file) {
            console.warn('[DashboardPage] Early return from handleImport: missing file');
            return;
        }
        setImporting(true);
        setImportResult(null);

        try {
            const text = await file.text();
            const headers: HeadersInit = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/strength/import', {
                method: 'POST',
                headers,
                body: JSON.stringify({ csv: text, source })
            });

            const result = await res.json();

            // Normalize generic API error response
            if (!res.ok && result.error) {
                setImportResult({
                    success: false,
                    errors: [result.error],
                    workoutsImported: 0,
                    workoutsUpdated: 0,
                    workoutsSkipped: 0,
                    exercisesDiscovered: 0,
                    personalBestsFound: 0
                });
                return;
            }

            setImportResult(result);

            if (result.success) {
                await refreshData();
            }
        } catch (e) {
            console.error('Import failed:', e);
            setImportResult({ success: false, errors: ['Import failed: ' + (e instanceof Error ? e.message : String(e))], workoutsImported: 0, workoutsUpdated: 0, workoutsSkipped: 0, exercisesDiscovered: 0, personalBestsFound: 0 });
        } finally {
            setImporting(false);
        }
    };

    const changeDate = useCallback((days: number) => {
        const d = new Date(selectedDate);
        d.setUTCDate(d.getUTCDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    }, [selectedDate, setSelectedDate]);

    const rangeStartISO = getRangeStartDate(weightRange);

    // Build map of bodyMeasurements by date for merging
    const measurementsByDate = useMemo(() => {
        const map: Record<string, { waist?: number, chest?: number }> = {};
        (bodyMeasurements || []).forEach((m: { date: string; type: string; value: number }) => {
            if (!map[m.date]) {
                map[m.date] = {};
            }
            if (m.type === 'waist') {
                map[m.date].waist = m.value;
            } else if (m.type === 'chest') {
                map[m.date].chest = m.value;
            }
        });
        return map;
    }, [bodyMeasurements]);

    // Filter and sort for sparkline, merging bodyMeasurements
    const weightTrendEntries = useMemo(() => {
        const allDates = new Set([
            ...weightEntries.map(w => w.date),
            ...(bodyMeasurements || []).map(m => m.date)
        ]);

        const filteredDates = Array.from(allDates)
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .filter(d => weightRange === 'all' || d >= rangeStartISO)
            .sort();

        return filteredDates.map(date => {
            const weightEntry = weightEntries.find(w => w.date === date);
            const measurements = measurementsByDate[date];

            if (weightEntry) {
                return {
                    ...weightEntry,
                    waist: weightEntry.waist ?? measurements?.waist,
                    chest: weightEntry.chest ?? measurements?.chest,
                };
            }

            return {
                id: `v-${date}`,
                date,
                weight: 0,
                waist: measurements?.waist,
                chest: measurements?.chest,
                createdAt: new Date().toISOString()
            } as any;
        });
    }, [weightEntries, bodyMeasurements, weightRange, rangeStartISO, measurementsByDate]);

    // Unified latest values for KPIs
    const allUniqueDatesDesc = useMemo(() => {
        const dates = new Set([
            ...weightEntries.map(w => w.date),
            ...(bodyMeasurements || []).map(m => m.date)
        ]);
        return Array.from(dates).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort((a, b) => b.localeCompare(a));
    }, [weightEntries, bodyMeasurements]);

    const latestWaist = useMemo(() => {
        for (const date of allUniqueDatesDesc) {
            const wEntry = weightEntries.find(w => w.date === date);
            if (wEntry?.waist) return wEntry.waist;
            const bEntry = (bodyMeasurements || []).find(m => m.date === date && m.type === 'waist');
            if (bEntry) return bEntry.value;
        }
        return undefined;
    }, [allUniqueDatesDesc, weightEntries, bodyMeasurements]);

    const latestChest = useMemo(() => {
        for (const date of allUniqueDatesDesc) {
            const wEntry = weightEntries.find(w => w.date === date);
            if (wEntry?.chest) return wEntry.chest;
            const bEntry = (bodyMeasurements || []).find(m => m.date === date && m.type === 'chest');
            if (bEntry) return bEntry.value;
        }
        return undefined;
    }, [allUniqueDatesDesc, weightEntries, bodyMeasurements]);

    const unifiedHistory = useMemo(() => {
        return allUniqueDatesDesc.map(date => {
            const weightEntry = weightEntries.find(w => w.date === date);
            const measurements = measurementsByDate[date];
            return {
                id: weightEntry?.id || `v-${date}`,
                date,
                weight: weightEntry?.weight,
                waist: weightEntry?.waist ?? measurements?.waist,
                chest: weightEntry?.chest ?? measurements?.chest,
                weightEntryId: weightEntry?.id,
                waistId: (bodyMeasurements || []).find(m => m.date === date && m.type === 'waist')?.id,
                chestId: (bodyMeasurements || []).find(m => m.date === date && m.type === 'chest')?.id,
            };
        });
    }, [allUniqueDatesDesc, weightEntries, bodyMeasurements, measurementsByDate]);

    const earliestWeightInRange = weightTrendEntries.length > 0 ? weightTrendEntries[0].weight : 0;
    const latestWeightInRange = weightTrendEntries.length > 0 ? weightTrendEntries[weightTrendEntries.length - 1].weight : 0;
    const weightDiffRange = latestWeightInRange - earliestWeightInRange;

    const currentUserHeight = settings.height || 0;
    const latestWeightVal = unifiedHistory[0]?.weight || settings.weight || 0;
    const bmi = (latestWeightVal && currentUserHeight)
        ? (latestWeightVal / (Math.pow(currentUserHeight / 100, 2)))
        : null;

    // Keyboard navigation
    useEffect(() => {
        const handleNavKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            if (e.ctrlKey) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    changeDate(-1);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    changeDate(1);
                }
            }
        };
        window.addEventListener('keydown', handleNavKeyDown);
        return () => window.removeEventListener('keydown', handleNavKeyDown);
    }, [changeDate]);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedSave = useCallback((type: string, value: number) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            updateVitals(selectedDate, { [type]: value });
        }, 1000);
    }, [selectedDate, updateVitals]);

    useEffect(() => {
        const currentVitals = getVitalsForDate(selectedDate);
        setVitals(currentVitals);
    }, [selectedDate, getVitalsForDate]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsWeightModalOpen(false);
                setEditing(null);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    useEffect(() => {
        if (!editing) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-editing-card]')) {
                setEditing(null);
            }
        };
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [editing]);

    // Handlers
    const handleCardClick = (type: string, currentValue: number) => {
        setEditing(type);
        setTempValue(currentValue.toString());
    };

    const handleSave = (type: string) => {
        const val = parseFloat(tempValue);
        if (!isNaN(val)) {
            updateVitals(selectedDate, { [type]: val });
            setVitals(prev => ({ ...prev, [type]: val }));
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: string) => {
        if (e.key === 'Enter') handleSave(type);
        if (e.key === 'Escape') setEditing(null);
    };

    const handleWaterClick = (count: number) => {
        const newVal = vitals.water === count ? count - 1 : count;
        updateVitals(selectedDate, { water: newVal });
        setVitals(prev => ({ ...prev, water: newVal }));
    };

    const handleCaffeineAdd = (amount: number, type: 'coffee' | 'nocco') => {
        const current = vitals.caffeine || 0;
        updateVitals(selectedDate, { caffeine: current + amount });
        setVitals(prev => ({ ...prev, caffeine: current + amount }));
    };

    const handleAlcoholAdd = (amount: number) => {
        const current = vitals.alcohol || 0;
        updateVitals(selectedDate, { alcohol: current + amount });
        setVitals(prev => ({ ...prev, alcohol: current + amount }));
    };

    const handleAlcoholClick = (count: number) => {
        const newVal = vitals.alcohol === count ? count - 1 : count;
        updateVitals(selectedDate, { alcohol: newVal });
        setVitals(prev => ({ ...prev, alcohol: newVal }));
    };

    // Calories & Nutrition
    const dailyNutrition = calculateDailyNutrition(selectedDate);
    const consumed = dailyNutrition.calories;
    const burned = health.dailyCaloriesBurned || 0;

    const targetResult = getActiveCalorieTarget(
        selectedDate,
        trainingPeriods,
        performanceGoals,
        settings.dailyCalorieGoal,
        2500,
        settings.calorieMode || 'tdee',
        burned,
        settings.exerciseCalorieMultiplier ?? 1.0
    );
    const target = targetResult.calories;

    const baseTarget = getActiveCalorieTarget(
        selectedDate,
        trainingPeriods,
        performanceGoals,
        settings.dailyCalorieGoal,
        2500,
        settings.calorieMode || 'tdee',
        0,
        settings.exerciseCalorieMultiplier ?? 1.0
    ).calories;

    const extraCalories = Math.max(0, target - baseTarget);
    const baseProtein = settings.dailyProteinGoal || 160;
    const baseCarbs = settings.dailyCarbsGoal || 250;
    const baseFat = settings.dailyFatGoal || 80;

    let finalProtein = baseProtein;
    let finalCarbs = baseCarbs;
    let finalFat = baseFat;

    if (extraCalories > 0) {
        const addedProteinCalories = extraCalories * 0.10;
        const addedFatCalories = extraCalories * 0.20;
        const addedCarbsCalories = extraCalories * 0.70;

        let addedProtein = addedProteinCalories / 4;
        const addedFat = addedFatCalories / 9;
        let addedCarbs = addedCarbsCalories / 4;

        const userWeight = latestWeightVal || 75;
        const maxProtein = userWeight * 2.5;

        if ((baseProtein + addedProtein) > maxProtein) {
            const allowedAddedProtein = Math.max(0, maxProtein - baseProtein);
            const surplusProteinCalories = (addedProtein - allowedAddedProtein) * 4;
            addedProtein = allowedAddedProtein;
            addedCarbs += surplusProteinCalories / 4;
        }

        finalProtein += addedProtein;
        finalFat += addedFat;
        finalCarbs += addedCarbs;
    }

    const proteinTarget = Math.round(finalProtein);
    const proteinCurrent = dailyNutrition.protein;
    const carbsTarget = Math.round(finalCarbs);
    const carbsCurrent = dailyNutrition.carbs;
    const fatTarget = Math.round(finalFat);
    const fatCurrent = dailyNutrition.fat;

    const proteinRatio = latestWeightVal > 0 ? (proteinCurrent / latestWeightVal) : 0;
    const targetProteinRatio = latestWeightVal > 0 ? (proteinTarget / latestWeightVal) : 0;

    // Training Analysis
    const todaysPlan = plannedActivities.find(p => p.date.split('T')[0] === selectedDate);
    const completedTraining = unifiedActivities.filter(e => e.date.split('T')[0] === selectedDate);

    // Streak
    const streakDays = calculateStreak(selectedDate);
    const weeklyStreak = calculateWeeklyTrainingStreak(selectedDate);
    const calorieStreak = calculateCalorieGoalStreak(selectedDate);

    // Card Completion Logic
    const [completedCards, setCompletedCards] = useState<string[]>([]);
    const toggleCardCompletion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCompletedCards(prev =>
            prev.includes(id)
                ? prev.filter(c => c !== id)
                : [...prev, id]
        );
    };

    const isIntakeDone = completedCards.includes('intake');
    const isTrainingDone = completedCards.includes('training');
    const isSleepDone = completedCards.includes('sleep');
    const isWaterDone = completedCards.includes('water');
    const isCaffeineDone = completedCards.includes('caffeine');
    const isAlcoholDone = completedCards.includes('alcohol');

    const cardOrder = [
        { id: 'intake', isDone: isIntakeDone },
        { id: 'training', isDone: isTrainingDone },
        { id: 'sleep', isDone: isSleepDone },
        { id: 'water', isDone: isWaterDone },
        { id: 'alcohol', isDone: isAlcoholDone },
        { id: 'caffeine', isDone: isCaffeineDone },
    ].sort((a, b) => {
        if (a.isDone === b.isDone) return 0;
        return a.isDone ? 1 : -1;
    });

    const handleSaveEstimate = (details: any) => {
        try {
            addMealEntry({
                date: selectedDate,
                mealType: 'estimate',
                items: [{
                    type: 'estimate',
                    referenceId: generateId(),
                    servings: 1,
                    estimateDetails: details
                }],
            });
            logEvent('estimate_lunch_log', details.name, 'estimate', {
                kcalAvg: details.caloriesAvg,
                isUncertain: !!details.uncertaintyEmoji
            });
        } catch (err) {
            console.error('[DashboardPage] Failed to save estimate:', err);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-2 md:p-8 font-sans text-slate-900 dark:text-white animate-in fade-in duration-500 transition-colors relative overflow-x-hidden">
            {isHoveringChart && (
                <div className="fixed inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-[50] transition-all duration-500 pointer-events-none" />
            )}

            {/* Sticky Date Header */}
            <div className={`fixed top-12 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all`}>
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-4">
                    <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ChevronLeft size={18} /></button>
                    <div onClick={() => setSelectedDate(today)} className={`font-bold text-sm cursor-pointer px-3 py-1 rounded-lg transition-all ${selectedDate !== today ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700' : 'text-slate-900 dark:text-white'}`}>{selectedDate === today ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : new Date(selectedDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}{selectedDate !== today && <span className="ml-2 text-[10px] opacity-70">← Klicka för idag</span>}</div>
                    <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ChevronRight size={18} /></button>
                </div>
            </div>

            <div className="w-full max-w-5xl mx-auto">
                <header className={`${density === 'compact' ? 'mb-4' : 'mb-6 md:mb-10'} flex flex-col md:flex-row justify-between items-center gap-4`}>
                    <div className="flex flex-col gap-1 items-center md:items-start w-full md:w-auto">
                        <div className="flex items-center gap-4">
                            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ChevronLeft size={24} /></button>
                            <div className="group relative">
                                <h1 className={`${density === 'compact' ? 'text-2xl' : 'text-3xl md:text-5xl'} font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer text-center`} onClick={() => setSelectedDate(today)}>{selectedDate === today ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : selectedDate}</h1>
                                {selectedDate !== today && <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">Klicka för att återgå till Idag</div>}
                            </div>
                            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ChevronRight size={24} /></button>
                        </div>
                        <div className="text-sm font-medium text-slate-500 uppercase tracking-wider opacity-60 px-10 text-center md:text-left">{new Date(selectedDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-end items-center gap-2 w-full md:w-auto">
                        <button onClick={() => toggleCompleteDay(selectedDate)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${vitals.completed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-slate-800/10 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'}`} title={vitals.completed ? "Markera som ej avslutad" : "Markera som avslutad"}><CheckCircle size={16} className={vitals.completed ? 'animate-[pulse_1s_ease-in-out_1]' : ''} /><span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">{vitals.completed ? 'Klar' : 'Avsluta'}</span></button>
                        {!vitals.completed && (
                            <button 
                                onClick={() => toggleIncompleteDay(selectedDate)} 
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${vitals.incomplete ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : 'bg-slate-800/10 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'}`}
                                title={vitals.incomplete ? "Ångra (Markera som fullständig)" : "Markera som ofullständig"}
                            >
                                <AlertCircle size={16} className={vitals.incomplete ? 'animate-pulse' : ''} />
                                <span className="text-xs font-black uppercase tracking-wider whitespace-nowrap">
                                    {vitals.incomplete ? 'Ofullständig' : 'Markera Ofullständig'}
                                </span>
                            </button>
                        )}
                        <button onClick={() => setIsStravaModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] rounded-xl border border-[#FC4C02]/20 transition-all group" title="Synka med Strava (7 dagar)"><RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" /></button>
                        <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">{(['compact', 'slim', 'cozy'] as const).map((m) => (<button key={m} onClick={() => setDensityMode(m)} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${density === m ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{m === 'compact' ? 'Tiny' : m === 'slim' ? 'Slim' : 'Cozy'}</button>))}</div>
                    </div>
                </header>

                <div className={`grid grid-cols-1 md:grid-cols-12 ${density === 'compact' ? 'gap-3' : density === 'slim' ? 'gap-4' : 'gap-6'} items-stretch`}>
                    {/* Row 1: Primary Action Cards */}
                    {cardOrder.find(c => c.id === 'intake') && (
                        <DailyIntakeCard
                            key="intake"
                            isDone={cardOrder.find(c => c.id === 'intake')!.isDone}
                            onToggle={toggleCardCompletion}
                            density={density}
                            selectedDate={selectedDate}
                            consumed={consumed}
                            target={target}
                            proteinCurrent={proteinCurrent}
                            proteinTarget={proteinTarget}
                            carbsCurrent={carbsCurrent}
                            carbsTarget={carbsTarget}
                            fatCurrent={fatCurrent}
                            fatTarget={fatTarget}
                            burned={burned}
                            baseTarget={baseTarget}
                            trainingGoal={settings.trainingGoal}
                            latestWeightVal={latestWeightVal}
                            proteinRatio={proteinRatio}
                            targetProteinRatio={targetProteinRatio}
                            onHoverTraining={setIsHoveringTraining}
                            maintenance={health.tdee}
                            explanation={targetResult.explanation}
                            className="md:col-span-12 lg:col-span-6 h-full"
                        />
                    )}
                    {cardOrder.find(c => c.id === 'training') && (
                        <TrainingCard
                            key="training"
                            category="all"
                            isDone={cardOrder.find(c => c.id === 'training')!.isDone}
                            onToggle={toggleCardCompletion}
                            density={density}
                            completedTraining={completedTraining}
                            todaysPlan={todaysPlan}
                            deleteExercise={deleteExercise}
                            isHoveringTraining={isHoveringTraining}
                            settings={settings}
                            className="md:col-span-12 lg:col-span-6 h-full"
                        />
                    )}

                    {/* Row 2: Summary Analytics */}
                    <div className="md:col-span-12 mt-2">
                        <WeeklySummary selectedDate={selectedDate} activities={unifiedActivities} history={unifiedHistory} />
                    </div>

                    <div className="md:col-span-8">
                        <WeeklyMetabolismAnalyticCard />
                    </div>
                    <div className="md:col-span-4 flex flex-col gap-6">
                        <ActiveGoalsCard fullWidth={false} />
                    </div>

                    {/* Vitals Grid (Shifted below primary cards) */}
                    {cardOrder.map((card) => {
                        if (card.id === 'intake' || card.id === 'training') return null;
                        if (card.id === 'sleep') {
                            return (
                                <DashboardSleepCard
                                    key="sleep"
                                    isDone={card.isDone}
                                    onToggle={toggleCardCompletion}
                                    density={density}
                                    sleep={vitals.sleep || 0}
                                    isEditing={editing === 'sleep'}
                                    tempValue={tempValue}
                                    onCardClick={() => handleCardClick('sleep', vitals.sleep || 0)}
                                    onValueChange={setTempValue}
                                    onSave={(val) => {
                                        setVitals(prev => ({ ...prev, sleep: val }));
                                        debouncedSave('sleep', val);
                                    }}
                                    onClear={() => {
                                        setTempValue('0');
                                        setVitals(prev => ({ ...prev, sleep: 0 }));
                                        updateVitals(selectedDate, { sleep: 0 });
                                    }}
                                    onCancel={() => setEditing(null)}
                                />
                            );
                        }
                        if (card.id === 'alcohol') {
                            const dayOfWeek = (new Date(selectedDate)).getDay();
                            const isWeekendLimit = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
                            const alcLimit = settings.dailyAlcoholLimitWeekend !== undefined && settings.dailyAlcoholLimitWeekday !== undefined ? (isWeekendLimit ? settings.dailyAlcoholLimitWeekend : settings.dailyAlcoholLimitWeekday) : undefined;

                            return (
                                <DashboardAlcoholCard
                                    key="alcohol"
                                    isDone={card.isDone}
                                    onToggle={toggleCardCompletion}
                                    density={density}
                                    alcohol={vitals.alcohol || 0}
                                    alcoholLimit={alcLimit}
                                    isEditing={editing === 'alcohol'}
                                    tempValue={tempValue}
                                    onCardClick={() => handleCardClick('alcohol', vitals.alcohol || 0)}
                                    onValueChange={setTempValue}
                                    onSave={() => handleSave('alcohol')}
                                    onKeyDown={(e) => handleKeyDown(e, 'alcohol')}
                                    onAlcoholClick={(count) => {
                                        const newVal = (vitals.alcohol === count) ? count - 1 : count;
                                        updateVitals(selectedDate, { alcohol: newVal });
                                        setVitals(p => ({ ...p, alcohol: newVal }));
                                    }}
                                />
                            );
                        }
                        if (card.id === 'water') {
                            return (
                                <DashboardWaterCard
                                    key="water"
                                    isDone={card.isDone}
                                    onToggle={toggleCardCompletion}
                                    density={density}
                                    water={vitals.water || 0}
                                    waterGoal={settings.dailyWaterGoal || 8}
                                    isEditing={editing === 'water'}
                                    tempValue={tempValue}
                                    onCardClick={() => handleCardClick('water', vitals.water || 0)}
                                    onValueChange={setTempValue}
                                    onSave={() => handleSave('water')}
                                    onKeyDown={(e) => handleKeyDown(e, 'water')}
                                    onWaterClick={handleWaterClick}
                                />
                            );
                        }
                        if (card.id === 'caffeine') {
                            return (
                                <DashboardCaffeineCard
                                    key="caffeine"
                                    isDone={card.isDone}
                                    onToggle={toggleCardCompletion}
                                    density={density}
                                    caffeine={vitals.caffeine || 0}
                                    caffeineLimit={settings.dailyCaffeineLimit || 400}
                                    isEditing={editing === 'caffeine'}
                                    tempValue={tempValue}
                                    onCardClick={() => handleCardClick('caffeine', vitals.caffeine || 0)}
                                    onValueChange={setTempValue}
                                    onSave={() => handleSave('caffeine')}
                                    onCancel={() => setEditing(null)}
                                    onKeyDown={(e) => handleKeyDown(e, 'caffeine')}
                                    onQuickAdd={handleCaffeineAdd}
                                />
                            );
                        }
                    })}

                    <div className="md:col-span-8 xl:col-span-8">
                        <HealthMetricsCard
                            density={density}
                            latestWeightVal={latestWeightVal}
                            latestWaist={latestWaist}
                            latestChest={latestChest}
                            bmi={bmi}
                            weightDiffRange={weightDiffRange}
                            weightRange={weightRange}
                            setWeightRange={setWeightRange}
                            weightTrendEntries={weightTrendEntries}
                            unifiedHistory={unifiedHistory}
                            performanceGoals={performanceGoals}
                            trainingPeriods={trainingPeriods}
                            onDeleteEntry={(data) => {
                                if (data.weightEntryId) deleteWeightEntry(data.weightEntryId);
                                if (data.waistId) deleteBodyMeasurement(data.waistId);
                                if (data.chestId) deleteBodyMeasurement(data.chestId);
                            }}
                            onOpenWeightModal={(data) => {
                                setTempValue(data.weight?.toString() || "");
                                setTempWaist(data.waist?.toString() || "");
                                setTempChest(data.chest?.toString() || "");
                                if (data.date) {
                                    setSelectedDate(data.date);
                                }
                                setIsWeightModalOpen(true);
                            }}
                        />
                    </div>

                    <div className="md:col-span-4 xl:col-span-4">
                        <ReadinessStreakCard
                            density={density}
                            streakDays={streakDays}
                            weeklyStreak={weeklyStreak}
                            calorieStreak={calorieStreak}
                        />
                    </div>

                    <div className="md:col-span-12">
                        <WeeklyTimeline
                            density={density}
                            selectedDate={selectedDate}
                            setSelectedDate={setSelectedDate}
                            unifiedActivities={unifiedActivities}
                            dailyVitals={dailyVitals}
                            calculateDailyNutrition={calculateDailyNutrition}
                            calculateTrainingStreak={calculateTrainingStreak}
                            calculateWeeklyTrainingStreak={calculateWeeklyTrainingStreak}
                            onHoverChange={setIsHoveringChart}
                        />
                    </div>
                </div>
            </div>

            <MeasurementEntryModal
                isOpen={isWeightModalOpen}
                onClose={() => setIsWeightModalOpen(false)}
                selectedDate={selectedDate}
                initialWeight={tempValue}
                initialWaist={tempWaist}
                initialChest={tempChest}
            />
            <StravaActivityImportModal
                isOpen={isStravaModalOpen}
                onClose={() => setIsStravaModalOpen(false)}
                autoStart={true}
            />
            <EstimateLunchModal
                isOpen={isEstimateModalOpen}
                onClose={() => setIsEstimateModalOpen(false)}
                onSave={handleSaveEstimate}
            />
            <DashboardActionFAB
                onLogMeasurements={() => setIsWeightModalOpen(true)}
                onImportWorkout={() => setShowImportModal(true)}
                onQuickEstimate={() => setIsEstimateModalOpen(true)}
                onCreatePost={() => setIsCreatePostModalOpen(true)}
            />
            <ImportWorkoutModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
                isImporting={importing}
                importResult={importResult}
            />
            {isCreatePostModalOpen && (
                <CreatePostModal
                    onClose={() => setIsCreatePostModalOpen(false)}
                    onPostCreated={() => {
                        setIsCreatePostModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}

export default DashboardPage;
