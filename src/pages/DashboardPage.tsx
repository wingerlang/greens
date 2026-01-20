import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate, DailyVitals } from '../models/types.ts';
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

// Feature Components
import { DailyIntakeCard } from '../features/dashboard/components/DailyIntakeCard.tsx';
import { TrainingCard } from '../features/dashboard/components/TrainingCard.tsx';
import { HealthMetricsCard } from '../features/dashboard/components/HealthMetricsCard.tsx';
import { WeeklyTimeline } from '../features/dashboard/components/WeeklyTimeline.tsx';
import { DashboardSleepCard, DashboardWaterCard, DashboardAlcoholCard, DashboardCaffeineCard } from '../features/dashboard/components/QuickLogCards.tsx';

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
        weightEntries,
        bodyMeasurements,
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
    const [isHoveringChart, setIsHoveringChart] = useState(false);
    const [isHoveringTraining, setIsHoveringTraining] = useState(false); // State shared between Intake and Training cards

    // Handle file import
    const handleImport = async (file: File, source: 'strengthlog' | 'hevy') => {
        if (!file || !token) return;

        setImporting(true);
        setImportResult(null);

        try {
            const text = await file.text();
            const res = await fetch('/api/strength/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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
            };
        });
    }, [allUniqueDatesDesc, weightEntries, measurementsByDate]);

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
        burned
    );
    const target = targetResult.calories;

    const baseTarget = getActiveCalorieTarget(
        selectedDate,
        trainingPeriods,
        performanceGoals,
        settings.dailyCalorieGoal,
        2500,
        settings.calorieMode || 'tdee',
        0
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

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-12 font-sans text-slate-900 dark:text-white animate-in fade-in duration-500 transition-colors relative overflow-x-hidden">
            {isHoveringChart && (
                <div className="fixed inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-[50] transition-all duration-500 pointer-events-none" />
            )}

            {/* Sticky Date Header */}
            <div className={`fixed top-16 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all ${selectedDate !== today ? 'py-2' : 'py-2'}`}>
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-4">
                    <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ChevronLeft size={18} /></button>
                    <div onClick={() => setSelectedDate(today)} className={`font-bold text-sm cursor-pointer px-3 py-1 rounded-lg transition-all ${selectedDate !== today ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700' : 'text-slate-900 dark:text-white'}`}>{selectedDate === today ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : new Date(selectedDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}{selectedDate !== today && <span className="ml-2 text-[10px] opacity-70">← Klicka för idag</span>}</div>
                    <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><ChevronRight size={18} /></button>
                </div>
            </div>

            <div className="w-full max-w-5xl mx-auto pt-12">
                <header className={`${density === 'compact' ? 'mb-4' : 'mb-10'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ChevronLeft size={24} /></button>
                            <div className="group relative">
                                <h1 className={`${density === 'compact' ? 'text-2xl' : 'text-4xl md:text-5xl'} font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer`} onClick={() => setSelectedDate(today)}>{selectedDate === today ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : selectedDate}</h1>
                                {selectedDate !== today && <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">Klicka för att återgå till Idag</div>}
                            </div>
                            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"><ChevronRight size={24} /></button>
                        </div>
                        <div className="text-sm font-medium text-slate-500 uppercase tracking-wider opacity-60 px-10">{new Date(selectedDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={() => toggleCompleteDay(selectedDate)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${vitals.completed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-slate-800/10 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'}`} title={vitals.completed ? "Markera som ej avslutad" : "Markera som avslutad"}><CheckCircle size={16} className={vitals.completed ? 'animate-[pulse_1s_ease-in-out_1]' : ''} /><span className="text-xs font-black uppercase tracking-wider">{vitals.completed ? 'Avslutad dag' : 'Avsluta dag'}</span></button>
                        {!vitals.completed && <button onClick={() => toggleIncompleteDay(selectedDate)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${vitals.incomplete ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : 'bg-slate-800/10 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'}`} title={vitals.incomplete ? "Markera som fullständig" : "Markera som ofullständig"}><AlertCircle size={16} className={vitals.incomplete ? 'animate-pulse' : ''} /><span className="text-xs font-black uppercase tracking-wider">{vitals.incomplete ? 'Ofullständig dag' : 'Markera ofullständig'}</span></button>}
                        <button onClick={() => setIsStravaModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] rounded-xl border border-[#FC4C02]/20 transition-all group" title="Synka med Strava (7 dagar)"><RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" /><span className="text-xs font-black uppercase tracking-wider">Synka Strava</span></button>
                        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">{(['compact', 'slim', 'cozy'] as const).map((m) => (<button key={m} onClick={() => setDensityMode(m)} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${density === m ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>{m === 'compact' ? 'Tiny' : m === 'slim' ? 'Slim' : 'Cozy'}</button>))}</div>
                    </div>
                </header>

                <div className={`grid grid-cols-1 md:grid-cols-12 ${density === 'compact' ? 'gap-3' : density === 'slim' ? 'gap-4' : 'gap-6'} items-stretch`}>
                    {/* Top Section: Daily Summary & Active Goals */}
                    <div className="md:col-span-12 flex flex-col gap-4 mb-4">
                        <DailySummaryCard
                            calories={{ current: consumed, target: target }}
                            protein={{ current: proteinCurrent, target: proteinTarget }}
                            trainingMinutes={completedTraining.reduce((sum, act) => sum + act.durationMinutes, 0)}
                            burnedCalories={burned}
                            measurementsCount={0}
                            weighInDone={unifiedHistory.some(w => w.date === today && w.weight)}
                            sleepHours={vitals.sleep || 0}
                            alcoholUnits={vitals.alcohol || 0}
                            density={density === 'compact' ? 'compact' : 'normal'}
                        />
                        <div className="md:col-span-12 mt-2 mb-4">
                            <WeeklySummary selectedDate={selectedDate} activities={unifiedActivities} history={unifiedHistory} />
                        </div>
                    </div>

                    {/* Cards Grid */}
                    {cardOrder.map((card) => {
                        if (card.id === 'intake') {
                            return (
                                <DailyIntakeCard
                                    key="intake"
                                    isDone={card.isDone}
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
                                />
                            );
                        }
                        if (card.id === 'training') {
                            return (
                                <TrainingCard
                                    key="training"
                                    isDone={card.isDone}
                                    onToggle={toggleCardCompletion}
                                    density={density}
                                    completedTraining={completedTraining}
                                    todaysPlan={todaysPlan}
                                    deleteExercise={deleteExercise}
                                    isHoveringTraining={isHoveringTraining}
                                    settings={settings}
                                />
                            );
                        }
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

                    <ActiveGoalsCard />

                    <div className={`md:col-span-12 ${density === 'compact' ? 'p-3 rounded-2xl' : 'p-6 rounded-[2rem]'} bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center`}>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 border-r border-slate-100 dark:border-slate-800 pr-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-500/10 rounded-full text-rose-500 ring-2 ring-rose-500/5"><Flame className={density === 'compact' ? 'w-4 h-4' : 'w-5 h-5'} /></div>
                                        <div><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loggningsstreak</span><div className={`${density === 'compact' ? 'text-xl' : 'text-2xl'} font-black text-slate-900 dark:text-white tracking-tighter`}>{streakDays} Dagar</div></div>
                                    </div>
                                    {density !== 'compact' && (
                                        <div className="text-right">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Mål: 30</span>
                                            <div className="h-1 w-20 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((streakDays / 30) * 100, 100)}%` }} /></div>
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
                            <div className="flex-[1.5] grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all" onClick={() => navigate('/planning/training')}>
                                    <div className="flex items-center gap-2 mb-1"><Calendar size={12} className="text-indigo-500" /><span className="text-[8px] font-bold uppercase text-slate-400">Planera Träning</span></div>
                                    <div className="text-xl font-black text-indigo-500 dark:text-indigo-400">+ Pass</div>
                                </div>
                                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20">
                                    <div className="flex items-center gap-2 mb-1"><Calendar size={12} className="text-emerald-500" /><span className="text-[8px] font-bold uppercase text-slate-400">Veckor i rad</span></div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">{weeklyStreak} <span className="text-[10px] text-slate-400">v.</span></div>
                                </div>
                                <div className="p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100/50 dark:border-rose-900/20">
                                    <div className="flex items-center gap-2 mb-1"><Target size={12} className="text-rose-500" /><span className="text-[8px] font-bold uppercase text-slate-400">Kalorimål</span></div>
                                    <div className="text-xl font-black text-slate-900 dark:text-white">{calorieStreak} <span className="text-[10px] text-slate-400">dag</span></div>
                                </div>
                            </div>
                        </div>
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
                initialRange="7days"
            />
            <DashboardActionFAB
                onLogMeasurements={() => setIsWeightModalOpen(true)}
                onImportWorkout={() => setShowImportModal(true)}
            />
            <ImportWorkoutModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImport}
                isImporting={importing}
                importResult={importResult}
            />
        </div>
    );
}
