import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import { getISODate, DailyVitals } from '../models/types.ts';
import { useNavigate } from 'react-router-dom';
import { analyzeSleep } from '../utils/vitalsUtils.ts';
import { formatActivityDuration } from '../utils/formatters.ts';
import { getActiveCalories, getActiveCalorieTarget } from '../utils/calorieTarget.ts';
import { EXERCISE_TYPES } from '../components/training/ExerciseModal.tsx';
import { MeasurementEntryModal } from '../components/dashboard/MeasurementEntryModal.tsx';
import {
    Dumbbell,
    Moon,
    Droplets,
    Coffee,
    Flame,
    Check,
    CheckCircle,
    ChevronRight,
    X,
    AlertCircle,
    UtensilsCrossed,
    Zap,
    Wine,
    Calendar,
    Target,
    Settings,
    ChevronLeft,
    Info
} from 'lucide-react';
import { GoalsOverviewWidget } from '../components/goals/GoalsOverviewWidget.tsx';
import { ActiveGoalsCard } from '../components/dashboard/ActiveGoalsCard.tsx';
import { DailySummaryCard } from '../components/dashboard/DailySummaryCard.tsx';
import { StravaActivityImportModal } from '../components/integrations/StravaActivityImportModal.tsx';
import { RefreshCw } from 'lucide-react';
import { CaffeineCard, WeightSparkline } from '../components/dashboard';

// --- Sub-Components (Defined outside to prevent re-mounting) ---

// Enhanced Double Circular Progress
const DoubleCircularProgress = ({
    value,
    max,
    innerValue,
    innerMax,
    label,
    subLabel,
    displayValue
}: {
    value: number,
    max: number,
    innerValue: number,
    innerMax: number,
    label: string,
    subLabel?: React.ReactNode,
    displayValue?: number | string
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
            text: 'text-xl',
            icon: 14
        },
        slim: {
            radius: 85,
            stroke: 9,
            innerRadius: 65,
            innerStroke: 6,
            text: 'text-3xl',
            icon: 20
        },
        cozy: {
            radius: 110,
            stroke: 12,
            innerRadius: 85,
            innerStroke: 10,
            text: 'text-4xl',
            icon: 24
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
                    {displayValue !== undefined ? displayValue : Math.round(value)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</div>
            </div>
        </div>
    );
};

// --- Helper Functions ---

const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Undervikt', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    if (bmi < 25) return { label: 'Normalvikt', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    if (bmi < 30) return { label: 'Övervikt', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    return { label: 'Fetma', color: 'text-rose-500', bg: 'bg-rose-500/10' };
};

const getRelativeDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const d = new Date(dateStr).toISOString().split('T')[0];
    if (d === today) return 'idag';
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (d === yesterday) return 'igår';

    // Calculate diff in days
    const diff = Math.floor((new Date(today).getTime() - new Date(d).getTime()) / 86400000);
    if (diff < 7) return `${diff} dgr sen`;
    if (diff < 30) return `${Math.floor(diff / 7)} v. sen`;
    return dateStr;
};

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

const DayHoverCard = ({
    date,
    activities,
    nutrition,
    onActivityClick
}: {
    date: string,
    activities: any[],
    nutrition: any,
    onActivityClick: (actId: string) => void
}) => {
    const navigate = useNavigate();
    const dayName = new Date(date).toLocaleDateString('sv-SE', { weekday: 'long' });
    const formattedDate = new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

    return (
        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-3 bg-slate-800/50 border-b border-slate-700/50 flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{dayName}</span>
                    <span className="text-xs font-bold text-white">{formattedDate}</span>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-slate-500 uppercase">Energi</div>
                    <div className="text-xs font-black text-emerald-400">{Math.round(nutrition.calories)} kcal</div>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
                {/* Activities */}
                {activities.length > 0 ? (
                    <div className="space-y-1.5">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Träning</div>
                        <div className="space-y-1">
                            {activities.map(act => {
                                const typeDef = EXERCISE_TYPES.find(t => t.type === act.type);
                                return (
                                    <div
                                        key={act.id}
                                        onClick={(e) => { e.stopPropagation(); onActivityClick(act.id); }}
                                        className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors cursor-pointer group"
                                    >
                                        <div className="text-sm">{typeDef?.icon || '💪'}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-white">{typeDef?.label || act.type}</div>
                                            <div className="text-[9px] text-slate-500">{formatActivityDuration(act.durationMinutes)} {act.distance ? `• ${act.distance} km` : ''}</div>
                                        </div>
                                        <ChevronRight size={10} className="text-slate-600 group-hover:text-white" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <span className="text-[10px] text-slate-600 italic">Ingen träning loggad</span>
                    </div>
                )}

                {/* Nutrition Summary (Mini) */}
                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-700/50">
                    <div className="text-center">
                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Prot</div>
                        <div className="text-[10px] font-black text-rose-400">🌱 {Math.round(nutrition.protein)}g</div>
                    </div>
                    <div className="text-center border-l border-slate-700/50">
                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Kolh</div>
                        <div className="text-[10px] font-black text-blue-400">{Math.round(nutrition.carbs)}g</div>
                    </div>
                    <div className="text-center border-l border-slate-700/50">
                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Fett</div>
                        <div className="text-[10px] font-black text-amber-400">{Math.round(nutrition.fat)}g</div>
                    </div>
                </div>
            </div>

            {/* Footer Link */}
            <div
                onClick={() => navigate(`/calories?date=${date}`)}
                className="bg-slate-800/80 p-2 text-center border-t border-slate-700/50 hover:bg-indigo-600 transition-colors cursor-pointer group/footer"
            >
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/footer:text-white flex items-center justify-center gap-1">
                    Se Detaljer <ChevronRight size={10} />
                </div>
            </div>
        </div>
    );
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
        addWeightEntry,
        bulkAddWeightEntries,
        getLatestWeight,
        getLatestWaist,
        plannedActivities,
        unifiedActivities,
        weightEntries,
        bodyMeasurements,
        trainingPeriods,
        performanceGoals,
        toggleIncompleteDay,
        toggleCompleteDay,
        dailyVitals
    } = useData();

    const [selectedDate, setSelectedDate] = useState(getISODate());
    const health = useHealth(selectedDate);
    const today = getISODate();

    // Local state for interactivity
    const [vitals, setVitals] = useState<DailyVitals>({ water: 0, sleep: 0, caffeine: 0, alcohol: 0, updatedAt: '' });
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [tempWaist, setTempWaist] = useState<string>("");
    const [tempChest, setTempChest] = useState<string>("");
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [bulkInput, setBulkInput] = useState("");
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [isHoveringTraining, setIsHoveringTraining] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [weightRange, setWeightRange] = useState<'7d' | '14d' | '30d' | '3m' | '1y' | 'year' | 'all'>('1y');
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const [isStravaModalOpen, setIsStravaModalOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [isHoveringChart, setIsHoveringChart] = useState(false);

    const changeDate = (days: number) => {
        setSelectedDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + days);
            return d.toISOString().split('T')[0];
        });
    };

    // --- Derived Data: Weight & Measurement Logic (Moved up to avoid TDZ) ---
    const getRangeDays = (range: typeof weightRange) => {
        switch (range) {
            case '7d': return 7;
            case '14d': return 14;
            case '30d': return 30;
            case '3m': return 90;
            case '1y': return 365;
            case 'year': return 365; // Dynamic but roughly
            default: return 9999;
        }
    };

    const rangeStartISO = getRangeStartDate(weightRange);

    // Build map of bodyMeasurements by date for merging
    const measurementsByDate: Record<string, { waist?: number, chest?: number }> = {};
    (bodyMeasurements || []).forEach((m: { date: string; type: string; value: number }) => {
        if (!measurementsByDate[m.date]) {
            measurementsByDate[m.date] = {};
        }
        if (m.type === 'waist') {
            measurementsByDate[m.date].waist = m.value;
        } else if (m.type === 'chest') {
            measurementsByDate[m.date].chest = m.value;
        }
    });

    // Filter and sort for sparkline, merging bodyMeasurements
    const weightTrendEntries = useMemo(() => {
        // 1. Collect all unique dates from both weight entries and measurements
        const allDates = new Set([
            ...weightEntries.map(w => w.date),
            ...(bodyMeasurements || []).map(m => m.date)
        ]);

        // 2. Filter dates by range and format
        const filteredDates = Array.from(allDates)
            .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .filter(d => weightRange === 'all' || d >= rangeStartISO)
            .sort();

        // 3. Map to entries
        return filteredDates.map(date => {
            const weightEntry = weightEntries.find(w => w.date === date);
            const measurements = measurementsByDate[date];

            // If we have a weight entry, use it as baseline
            if (weightEntry) {
                return {
                    ...weightEntry,
                    waist: weightEntry.waist ?? measurements?.waist,
                    chest: weightEntry.chest ?? measurements?.chest,
                };
            }

            // If we only have measurements, create a "virtual" entry
            return {
                id: `v-${date}`,
                date,
                weight: 0, // Mark as 0 to be ignored by weight line but shown in chart context
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

    // Keyboard navigation (Ctrl + Arrows)
    useEffect(() => {
        const handleNavKeyDown = (e: KeyboardEvent) => {
            // Only trigger if no input/textarea is focused
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
    }, []);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedSave = useCallback((type: string, value: number) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            updateVitals(selectedDate, { [type]: value });
        }, 1000);
    }, [selectedDate, updateVitals]);

    // Load data whenever context changes or date changes
    useEffect(() => {
        const currentVitals = getVitalsForDate(selectedDate);
        setVitals(currentVitals);
    }, [selectedDate, getVitalsForDate]);

    // Accessibility: ESC to close modals
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

    // Click outside to close edit mode
    useEffect(() => {
        if (!editing) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if click is inside the editing card (by data attribute or class)
            if (!target.closest('[data-editing-card]')) {
                setEditing(null);
            }
        };

        // Add slight delay to avoid immediate close on the click that opens edit mode
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

    // --- Specific Quick Handlers ---
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

    // --- Derived Data ---



    // 2. Calories & Nutrition
    const dailyNutrition = calculateDailyNutrition(selectedDate);
    const consumed = dailyNutrition.calories;
    const burned = health.dailyCaloriesBurned || 0;

    // Determine target using centralized function
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

    // Base target (without exercise calories) for scaling and Netto comparison
    const baseTarget = getActiveCalorieTarget(
        selectedDate,
        trainingPeriods,
        performanceGoals,
        settings.dailyCalorieGoal,
        2500,
        settings.calorieMode || 'tdee',
        0
    ).calories;

    // Scaling factor for macros (only in fixed mode when training increases the goal)
    const extraCalories = Math.max(0, target - baseTarget);

    // Base Macros
    const baseProtein = settings.dailyProteinGoal || 160;
    const baseCarbs = settings.dailyCarbsGoal || 250;
    const baseFat = settings.dailyFatGoal || 80;

    let finalProtein = baseProtein;
    let finalCarbs = baseCarbs;
    let finalFat = baseFat;

    if (extraCalories > 0) {
        // Standard training fuel split: 10% Protein, 20% Fat, 70% Carbs
        // (Unless overridden by specific logic, but implementing this as requested)
        const addedProteinCalories = extraCalories * 0.10;
        const addedFatCalories = extraCalories * 0.20;
        const addedCarbsCalories = extraCalories * 0.70;

        let addedProtein = addedProteinCalories / 4;
        const addedFat = addedFatCalories / 9;
        let addedCarbs = addedCarbsCalories / 4;

        // Apply Protein Cap (2.5g / kg)
        const userWeight = latestWeightVal || 75; // Default to 75 if unknown
        const maxProtein = userWeight * 2.5;

        if ((baseProtein + addedProtein) > maxProtein) {
            // Cap protein
            const allowedAddedProtein = Math.max(0, maxProtein - baseProtein);
            const surplusProteinCalories = (addedProtein - allowedAddedProtein) * 4;

            addedProtein = allowedAddedProtein;
            // Redistribute surplus calories to Carbs
            addedCarbs += surplusProteinCalories / 4;
        }

        finalProtein += addedProtein;
        finalFat += addedFat;
        finalCarbs += addedCarbs;
    }

    // 3. Macros (Scaled proportionally if training calories are added)
    const proteinTarget = Math.round(finalProtein);
    const proteinCurrent = dailyNutrition.protein;

    const carbsTarget = Math.round(finalCarbs);
    const carbsCurrent = dailyNutrition.carbs;

    const fatTarget = Math.round(finalFat);
    const fatCurrent = dailyNutrition.fat;

    const proteinRatio = latestWeightVal > 0 ? (proteinCurrent / latestWeightVal) : 0;
    const targetProteinRatio = latestWeightVal > 0 ? (proteinTarget / latestWeightVal) : 0;


    const getBMICategory = (val: number) => {
        if (val < 18.5) return { label: 'Undervikt', color: 'text-amber-400', bg: 'bg-amber-400/10' };
        if (val < 25) return { label: 'Normalvikt', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
        if (val < 30) return { label: 'Övervikt', color: 'text-orange-400', bg: 'bg-orange-400/10' };
        return { label: 'Fetma', color: 'text-rose-400', bg: 'bg-rose-400/10' };
    };

    // 4. Training Analysis
    const todaysPlan = plannedActivities.find(p => p.date === selectedDate);
    const completedTraining = unifiedActivities.filter(e => e.date === selectedDate);

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
            <div className={`flex flex-col ${density === 'compact' ? 'gap-0.5 w-full p-1' : density === 'slim' ? 'gap-1.5 w-full p-2' : 'gap-2 w-full p-3'} rounded-2xl transition-colors ${goalMet ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>
                {/* Summary Header */}
                <div className="flex flex-wrap justify-between items-center gap-2 mb-0.5 px-0.5">
                    <div className="text-[9px] font-bold uppercase text-slate-400">Dagens Totalt</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-900 dark:text-white">{Math.round(totalDuration)} min</span>
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
                    metricParts.push(`${Math.round(act.durationMinutes)} min`);

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
                                navigate(`/logg?activityId=${act.id}`);
                            }}
                            className={`flex items-center ${density === 'compact' ? 'gap-1.5 p-1 rounded-lg' : 'gap-2 p-2 rounded-xl'} group/item cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all border ${isHoveringTraining ? 'border-emerald-500 bg-emerald-500/5 shadow-md -translate-y-[1px]' : 'border-transparent'} hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-sm relative bg-white/40 dark:bg-slate-900/40`}
                        >
                            <div className={`${density === 'compact' ? 'text-sm p-1' : 'text-lg p-1.5'} bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50`}>
                                {typeDef?.icon || '💪'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white leading-tight capitalize flex items-center gap-1.5 truncate">
                                    {typeDef?.label || act.type}
                                    {hrString && <span className="text-[8px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded tracking-wide">{hrString}</span>}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
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
        let label = todaysPlan.type as string;

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

    // 7. Streak - Pass selectedDate to calculate relative to current view
    const streakDays = calculateStreak(selectedDate);
    const trainingStreak = calculateTrainingStreak(selectedDate);
    const weeklyStreak = calculateWeeklyTrainingStreak(selectedDate);
    const calorieStreak = calculateCalorieGoalStreak(selectedDate);

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

    // --- Card Completion Logic for Sorting ---
    // --- Card Completion Logic for Sorting ---
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

    // Card Definition
    const cardOrder = [
        { id: 'intake', isDone: isIntakeDone, component: null }, // Handled specially
        { id: 'training', isDone: isTrainingDone, component: null },
        { id: 'sleep', isDone: isSleepDone, component: null },
        { id: 'water', isDone: isWaterDone, component: null },
        { id: 'alcohol', isDone: isAlcoholDone, component: null },
        { id: 'caffeine', isDone: isCaffeineDone, component: null },
    ].sort((a, b) => {
        if (a.isDone === b.isDone) return 0;
        return a.isDone ? 1 : -1;
    });

    return (
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-12 font-sans text-slate-900 dark:text-white animate-in fade-in duration-500 transition-colors relative">
            {isHoveringChart && (
                <div className="fixed inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm z-[50] transition-all duration-500 pointer-events-none" />
            )}

            {/* Sticky Date Header - appears when scrolling */}
            <div className={`fixed top-16 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all ${selectedDate !== today ? 'py-2' : 'py-2'}`}>
                <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-4">
                    <button
                        onClick={() => changeDate(-1)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div
                        onClick={() => setSelectedDate(today)}
                        className={`font-bold text-sm cursor-pointer px-3 py-1 rounded-lg transition-all ${selectedDate !== today
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                            : 'text-slate-900 dark:text-white'
                            }`}
                    >
                        {selectedDate === today ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : new Date(selectedDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                        {selectedDate !== today && <span className="ml-2 text-[10px] opacity-70">← Klicka för idag</span>}
                    </div>
                    <button
                        onClick={() => changeDate(1)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto pt-12">
                <header className={`${density === 'compact' ? 'mb-4' : 'mb-10'} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => changeDate(-1)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <ChevronLeft size={24} />
                            </button>

                            <div className="group relative">
                                <h1 className={`${density === 'compact' ? 'text-2xl' : 'text-4xl md:text-5xl'} font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer`} onClick={() => setSelectedDate(today)}>
                                    {selectedDate === today ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : selectedDate}
                                </h1>
                                {selectedDate !== today && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                                        Klicka för att återgå till Idag
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => changeDate(1)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </div>
                        <div className="text-sm font-medium text-slate-500 uppercase tracking-wider opacity-60 px-10">
                            {new Date(selectedDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Complete Day Toggle */}
                        <button
                            onClick={() => toggleCompleteDay(selectedDate)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${vitals.completed
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                                : 'bg-slate-800/10 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'
                                }`}
                            title={vitals.completed ? "Markera som ej avslutad" : "Markera som avslutad"}
                        >
                            <CheckCircle size={16} className={vitals.completed ? 'animate-[pulse_1s_ease-in-out_1]' : ''} />
                            <span className="text-xs font-black uppercase tracking-wider">
                                {vitals.completed ? 'Avslutad dag' : 'Avsluta dag'}
                            </span>
                        </button>

                        {/* Incomplete Day Toggle */}
                        {!vitals.completed && (
                            <button
                                onClick={() => toggleIncompleteDay(selectedDate)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${vitals.incomplete
                                    ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                                    : 'bg-slate-800/10 border-white/5 text-slate-500 hover:text-white hover:bg-slate-800'
                                    }`}
                                title={vitals.incomplete ? "Markera som fullständig" : "Markera som ofullständig"}
                            >
                                <AlertCircle size={16} className={vitals.incomplete ? 'animate-pulse' : ''} />
                                <span className="text-xs font-black uppercase tracking-wider">
                                    {vitals.incomplete ? 'Ofullständig dag' : 'Markera ofullständig'}
                                </span>
                            </button>
                        )}

                        {/* Strava Sync Button */}
                        <button
                            onClick={() => setIsStravaModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] rounded-xl border border-[#FC4C02]/20 transition-all group"
                            title="Synka med Strava (7 dagar)"
                        >
                            <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                            <span className="text-xs font-black uppercase tracking-wider">Synka Strava</span>
                        </button>

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
                    </div>
                </header>

                <div className={`grid grid-cols-1 md:grid-cols-12 ${density === 'compact' ? 'gap-3' : density === 'slim' ? 'gap-4' : 'gap-6'} items-stretch`}>
                    {/* Top Section: Daily Summary & Active Goals */}
                    <div className="md:col-span-12 flex flex-col gap-4 mb-4">
                        <DailySummaryCard
                            calories={{ current: consumed, target: target }}
                            protein={{ current: proteinCurrent, target: proteinTarget }}
                            trainingMinutes={completedTraining.reduce((sum, act) => sum + act.durationMinutes, 0)}
                            measurementsCount={0}
                            weighInDone={unifiedHistory.some(w => w.date === today && w.weight)}
                            sleepHours={vitals.sleep || 0}
                            alcoholUnits={vitals.alcohol || 0}
                            density={density === 'compact' ? 'compact' : 'normal'}
                        />


                        {/* Weekly Summary Row */}
                        <div className="md:col-span-12 mt-2 mb-4">
                            {(() => {
                                // Determine "Current Week" based on selectedDate
                                const d = new Date(selectedDate);
                                const day = d.getDay();
                                const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                                const monday = new Date(d.setDate(diff)).toISOString().split('T')[0];
                                const sunday = new Date(d.setDate(diff + 6)).toISOString().split('T')[0];

                                // Simple ISO week number
                                const targetDate = new Date(monday);
                                const jan4 = new Date(targetDate.getFullYear(), 0, 4);
                                const weekNum = 1 + Math.round((((targetDate.getTime() - jan4.getTime()) / 86400000) - 3 + ((jan4.getDay() + 6) % 7)) / 7);

                                // Aggregate data for this calendar week
                                const weekActivities = unifiedActivities.filter(a => a.date >= monday && a.date <= sunday);
                                const weekVolume = weekActivities.reduce((sum, a) => sum + (a.tonnage || 0), 0) / 1000;
                                const weekDistance = weekActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
                                // const weekDuration = weekActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
                                // const weekWorkouts = weekActivities.length;

                                // Calculate context label
                                const currentWeekNum = (() => {
                                    const d = new Date();
                                    const day = d.getDay();
                                    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                    const mon = new Date(d.setDate(diff));
                                    const jan4 = new Date(mon.getFullYear(), 0, 4);
                                    return 1 + Math.round((((mon.getTime() - jan4.getTime()) / 86400000) - 3 + ((jan4.getDay() + 6) % 7)) / 7);
                                })();

                                let mainTitle = `Vecka ${weekNum} Summary`;
                                if (weekNum === currentWeekNum) {
                                    mainTitle = 'NUVARANDE VECKA SUMMARY';
                                }

                                // Measurement Diffs
                                const getDiff = (type: 'weight' | 'waist' | 'chest') => {
                                    const records = unifiedHistory
                                        .map(h => ({ date: h.date, value: h[type] }))
                                        .filter(r => r.value !== undefined && r.value !== null && r.value !== 0)
                                        .sort((a, b) => a.date.localeCompare(b.date));

                                    if (records.length === 0) return null;

                                    const inWeek = records.filter(r => r.date >= monday && r.date <= sunday);
                                    if (inWeek.length === 0) {
                                        // If no measurements in week, we can't show a diff for the week, 
                                        // but we can show the current value if it exists
                                        const latestOverall = records[records.length - 1];
                                        return { diff: 0, current: latestOverall.value };
                                    }

                                    const latestInWeek = inWeek[inWeek.length - 1];
                                    const beforeWeek = records.filter(r => r.date < monday);

                                    if (beforeWeek.length > 0) {
                                        const baseline = beforeWeek[beforeWeek.length - 1];
                                        return { diff: latestInWeek.value - baseline.value, current: latestInWeek.value };
                                    } else if (inWeek.length > 1) {
                                        const baseline = inWeek[0];
                                        return { diff: latestInWeek.value - baseline.value, current: latestInWeek.value };
                                    }
                                    return { diff: 0, current: latestInWeek.value };
                                };

                                const wDiff = getDiff('weight');
                                const waistDiff = getDiff('waist');
                                const chestDiff = getDiff('chest');

                                return (
                                    <div className="flex flex-col items-center">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 opacity-70">
                                            {mainTitle}
                                        </div>
                                        <div className="flex flex-wrap justify-center gap-4 w-full">
                                            {/* Running Box */}
                                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-8 py-5 flex flex-col items-center justify-center shadow-sm min-w-[220px] hover:shadow-md transition-shadow">
                                                <div className="text-xl mb-1">🏃‍♂️</div>
                                                <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Löpning</div>
                                                <div className="text-lg font-bold text-emerald-500">
                                                    {weekActivities.filter(a => a.type === 'running' || a.type === 'cycling' || a.type === 'walking').length} pass <span className="text-slate-300 mx-1">|</span> {Math.round(weekDistance)}km
                                                </div>
                                            </div>

                                            {/* Strength Box */}
                                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-8 py-5 flex flex-col items-center justify-center shadow-sm min-w-[220px] hover:shadow-md transition-shadow">
                                                <div className="text-xl mb-1">💪</div>
                                                <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">Styrka</div>
                                                <div className="text-lg font-bold text-indigo-500">
                                                    {weekActivities.filter(a => a.type === 'strength').length} pass <span className="text-slate-300 mx-1">|</span> {weekVolume.toFixed(1)} ton
                                                </div>
                                            </div>

                                            {/* Measurement Diffs Card */}
                                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-8 py-5 flex flex-col items-center justify-center shadow-sm min-w-[220px] hover:shadow-md transition-shadow">
                                                <div className="text-xl mb-1">⚖️</div>
                                                <div className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">Framsteg</div>
                                                <div className="grid grid-cols-3 gap-4 w-full">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Vikt</span>
                                                        <span className={`text-xs font-black ${wDiff && wDiff.diff !== 0 ? (wDiff.diff < 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                                            {wDiff ? (wDiff.diff > 0 ? `+${wDiff.diff.toFixed(1)}` : wDiff.diff.toFixed(1)) : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Midja</span>
                                                        <span className={`text-xs font-black ${waistDiff && waistDiff.diff !== 0 ? (waistDiff.diff < 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                                            {waistDiff ? (waistDiff.diff > 0 ? `+${waistDiff.diff.toFixed(1)}` : waistDiff.diff.toFixed(1)) : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">Bröst</span>
                                                        <span className={`text-xs font-black ${chestDiff && chestDiff.diff !== 0 ? (chestDiff.diff < 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                                            {chestDiff ? (chestDiff.diff > 0 ? `+${chestDiff.diff.toFixed(1)}` : chestDiff.diff.toFixed(1)) : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* 7-Day Performance Summary */}
                    {/* Render Sorted Cards */}
                    {cardOrder.map((card) => {
                        const isDone = card.isDone;
                        // Visual state: "Done" = slightly transparent, checkmark badge, grayscale
                        const opacityClass = isDone
                            ? 'opacity-60 grayscale-[0.8] hover:opacity-100 hover:grayscale-0 transition-all duration-500'
                            : '';

                        const Wrapper = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
                            <div className={`${className} ${opacityClass} relative group/card`}>
                                {/* Manual Completion Toggle */}
                                <button
                                    onClick={(e) => toggleCardCompletion(card.id, e)}
                                    className={`absolute -top-3 -right-3 z-30 p-2 rounded-full shadow-lg transition-all transform hover:scale-110 ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 opacity-0 group-hover/card:opacity-100'}`}
                                    title={isDone ? "Markera som ej klar" : "Markera som klar"}
                                >
                                    <Check size={14} strokeWidth={3} />
                                </button>

                                {children}
                            </div>
                        );

                        if (card.id === 'intake') {
                            return (
                                <Wrapper key="intake" className="md:col-span-12 lg:col-span-6 h-full flex">
                                    <div
                                        onClick={() => navigate(`/calories?date=${selectedDate}`)}
                                        className={`flex-1 flex items-start ${density === 'compact' ? 'gap-2 p-2' : 'gap-4 p-4'} border rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800 h-full relative cursor-pointer hover:scale-[1.01] transition-transform`}>
                                        <DoubleCircularProgress
                                            value={consumed}
                                            max={target}
                                            innerValue={proteinCurrent}
                                            innerMax={proteinTarget}
                                            displayValue={Math.round(target - consumed)}
                                            label="Kvar"
                                        />
                                        <div className="flex-1 ml-4 min-w-0 pb-6">
                                            <div className={`font-black text-slate-900 dark:text-white uppercase tracking-tighter ${density === 'compact' ? 'text-[10px] mb-2' : 'text-sm mb-4'}`}>Dagens Intag</div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                                {/* Protein */}
                                                <div>
                                                    <div className={`flex justify-between items-baseline mb-1`}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protein</span>
                                                            {latestWeightVal > 0 && (
                                                                <div className="group relative">
                                                                    <Info size={10} className="text-slate-300 hover:text-emerald-500 cursor-help transition-colors" />
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 text-[10px] text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all group-hover:translate-y-[-4px] pointer-events-none shadow-2xl border border-white/10 z-[100] leading-tight text-center">
                                                                        <div className="flex justify-between items-center mb-2 px-1">
                                                                            <div className="flex flex-col items-center">
                                                                                <span className="text-[8px] uppercase opacity-50 font-bold">Nuvarande</span>
                                                                                <span className={`text-sm font-black ${proteinRatio >= targetProteinRatio ? 'text-emerald-400' : 'text-white'}`}>{proteinRatio.toFixed(1)}</span>
                                                                            </div>
                                                                            <div className="h-4 w-[1px] bg-white/10" />
                                                                            <div className="flex flex-col items-center">
                                                                                <span className="text-[8px] uppercase opacity-50 font-bold">Mål</span>
                                                                                <span className="text-sm font-black text-blue-400">{targetProteinRatio.toFixed(1)}</span>
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-[9px] mb-1 opacity-70">Gram protein per kg kroppsvikt</p>
                                                                        {settings.trainingGoal === 'deff' && proteinRatio < 2.0 ? (
                                                                            <p className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400/90 italic border border-amber-500/20">Vid deff bör du ligga på drygt 2.0g/kg för att behålla muskelmassa.</p>
                                                                        ) : proteinRatio >= targetProteinRatio ? (
                                                                            <p className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400/90 font-bold border border-emerald-500/20">Snyggt! Du når ditt proteinmål.</p>
                                                                        ) : (
                                                                            <p className="opacity-70">Baserat på din senaste vikt ({latestWeightVal}kg).</p>
                                                                        )}
                                                                        {/* Arrow */}
                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-slate-900 dark:text-white`}>
                                                            {Math.round(proteinCurrent)}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold">/ {proteinTarget}g</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((proteinCurrent / proteinTarget) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>

                                                {/* Carbs */}
                                                <div>
                                                    <div className={`flex justify-between items-baseline mb-1`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kolh.</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-slate-900 dark:text-white`}>
                                                            {Math.round(carbsCurrent)}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold">/ {carbsTarget}g</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((carbsCurrent / carbsTarget) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>

                                                {/* Fat */}
                                                <div>
                                                    <div className={`flex justify-between items-baseline mb-1`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fett</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-slate-900 dark:text-white`}>
                                                            {Math.round(fatCurrent)}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold">/ {fatTarget}g</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((fatCurrent / fatTarget) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>

                                                {/* Calories */}
                                                <div>
                                                    <div className={`flex justify-between items-baseline mb-1`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kcal</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} ${consumed > target ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                                                            {Math.round(consumed)}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold">/ {target}</span>
                                                    </div>
                                                    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                                        <div className={`h-full rounded-full ${consumed > target ? 'bg-rose-500' : 'bg-slate-900 dark:bg-white'}`} style={{ width: `${Math.min((consumed / target) * 100, 100)}%` }}></div>
                                                    </div>
                                                </div>

                                                {/* Training/Burned Calories - Hidden unless active or expanded */}
                                                {(showDetails || burned > 0) && (
                                                    <div
                                                        onMouseEnter={() => setIsHoveringTraining(true)}
                                                        onMouseLeave={() => setIsHoveringTraining(false)}
                                                        className={`transition-all rounded-lg p-1 -m-1 ${isHoveringTraining ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20' : ''}`}
                                                    >
                                                        <div className={`flex justify-between items-baseline mb-1`}>
                                                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Träning</span>
                                                        </div>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} text-emerald-500`}>
                                                                -{Math.round(burned)}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 font-bold">kcal</span>
                                                        </div>
                                                        <div className="h-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden mt-1">
                                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${burned > 0 ? Math.min((burned / 500) * 100, 100) : 0}%` }}></div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Net Calories - Hidden unless expanded */}
                                                {showDetails && (
                                                    <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                                                        <div className={`flex justify-between items-baseline mb-1`}>
                                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Netto</span>
                                                            <span className={`text-[9px] font-bold ${(consumed - burned) > baseTarget ? 'text-rose-500' : (consumed - burned) < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                {(consumed - burned) <= baseTarget ? '✓ Under mål' : '⚠ Över mål'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className={`font-black tracking-tighter ${density === 'compact' ? 'text-sm' : 'text-lg'} ${(consumed - burned) > baseTarget ? 'text-rose-500' : 'text-indigo-500'}`}>
                                                                {Math.round(consumed - burned)}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 font-bold">/ {baseTarget} kcal</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                                            <div className={`h-full rounded-full ${(consumed - burned) > baseTarget ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(Math.max(0, ((consumed - burned) / baseTarget) * 100), 100)}%` }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expand Toggle */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
                                                className="absolute bottom-2 right-4 p-1 text-slate-300 hover:text-slate-600 dark:hover:text-slate-100 transition-colors"
                                            >
                                                {showDetails ? <X size={14} /> : <div className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">Mer <ChevronRight size={10} className="rotate-90" /></div>}
                                            </button>
                                        </div>
                                    </div>
                                </Wrapper>
                            );
                        }

                        if (card.id === 'training') {
                            return (
                                <Wrapper key="training" className="md:col-span-12 lg:col-span-6 h-full">
                                    <div
                                        onClick={() => navigate('/training')}
                                        className={`w-full ${density === 'compact' ? 'p-1.5 gap-2 rounded-xl' : density === 'slim' ? 'p-3 gap-3 rounded-2xl' : 'p-6 gap-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex items-start hover:scale-[1.01] transition-transform cursor-pointer group bg-white dark:bg-slate-900 h-full relative overflow-hidden`}
                                    >
                                        {/* Background Icon */}
                                        <Dumbbell className="absolute -bottom-4 -right-4 w-24 h-24 text-emerald-500/5 dark:text-emerald-400/10 pointer-events-none transform -rotate-12 transition-all group-hover:scale-110" />

                                        <div className={`${density === 'compact' ? 'w-8 h-8' : 'w-14 h-14'} bg-[#DCFCE7] dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors shrink-0 z-10`}>
                                            <Dumbbell className={density === 'compact' ? 'w-4 h-4' : 'w-7 h-7'} />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left z-10">
                                            <div className={`${density === 'compact' ? 'text-[10px]' : 'text-sm'} text-slate-500 dark:text-slate-400 font-semibold mb-1`}>Dagens träning</div>
                                            <div className="w-full">{trainingContent}</div>
                                        </div>
                                    </div>
                                </Wrapper>
                            );
                        }

                        if (card.id === 'sleep') {
                            return (
                                <Wrapper key="sleep" className="md:col-span-6 lg:col-span-3">
                                    <div
                                        data-editing-card={editing === 'sleep' ? true : undefined}
                                        onClick={() => handleCardClick('sleep', vitals.sleep || 0)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between hover:scale-[1.01] transition-transform cursor-pointer group relative overflow-hidden h-full ${(vitals.sleep || 0) > 0 && (vitals.sleep || 0) < 5
                                            ? 'bg-rose-50 dark:bg-rose-900/10'
                                            : (vitals.sleep || 0) >= 5 && (vitals.sleep || 0) < 7
                                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                                : (vitals.sleep || 0) >= 7 && (vitals.sleep || 0) <= 10
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                    : 'bg-white dark:bg-slate-900'
                                            }`}
                                    >
                                        <Moon className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/5 dark:text-indigo-400/10 pointer-events-none transform -rotate-12 transition-all group-hover:scale-110" />
                                        <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'} relative z-10`}>
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
                                                        {parseFloat(tempValue) > 0 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setTempValue('0');
                                                                    setVitals(prev => ({ ...prev, sleep: 0 }));
                                                                    updateVitals(selectedDate, { sleep: 0 });
                                                                }}
                                                                className="w-5 h-5 flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 hover:bg-rose-200 dark:hover:bg-rose-800/50 text-xs font-bold transition-colors"
                                                                title="Rensa sömnvärde"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
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
                                </Wrapper>
                            );
                        }

                        if (card.id === 'alcohol') {
                            const dayOfWeek = (new Date()).getDay();
                            const isWeekendLimit = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
                            const alcLimit = settings.dailyAlcoholLimitWeekend !== undefined && settings.dailyAlcoholLimitWeekday !== undefined ? (isWeekendLimit ? settings.dailyAlcoholLimitWeekend : settings.dailyAlcoholLimitWeekday) : undefined;
                            const alc = vitals.alcohol || 0;
                            const isAlcHigh = alcLimit !== undefined && alc > alcLimit;
                            const isAlcWarning = alcLimit !== undefined && !isAlcHigh && alc > 0 && alc === alcLimit;

                            return (
                                <Wrapper key="alcohol" className="md:col-span-6 lg:col-span-3">
                                    <div
                                        onClick={() => handleCardClick('alcohol', alc)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden h-full ${isAlcHigh
                                            ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'
                                            : isAlcWarning
                                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                            }`}
                                    >
                                        <Wine className="absolute -bottom-4 -right-4 w-24 h-24 text-rose-500/5 dark:text-rose-400/10 pointer-events-none transform rotate-12 transition-all group-hover:scale-110" />
                                        <div className={`flex items-center justify-between ${density === 'compact' ? 'mb-1' : 'mb-2'} relative z-10`}>
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
                                                                    updateVitals(selectedDate, { alcohol: newVal });
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
                                </Wrapper>
                            );
                        }

                        if (card.id === 'water') {
                            const waterGoal = settings.dailyWaterGoal || 8;
                            const isWaterMet = (vitals.water || 0) >= waterGoal;
                            return (
                                <Wrapper key="water" className="md:col-span-6 lg:col-span-3">
                                    <div
                                        onClick={() => handleCardClick('water', vitals.water || 0)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden h-full ${isWaterMet ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <Droplets className="absolute -bottom-4 -right-4 w-24 h-24 text-blue-500/5 dark:text-blue-400/10 pointer-events-none transform -rotate-6 transition-all group-hover:scale-110" />
                                        <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'} relative z-10`}>
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
                                                    <div className={`flex gap-0.5 mt-2 ${density === 'compact' ? 'h-4' : 'h-6'}`}>
                                                        {Array.from({ length: 8 }).map((_, i) => (
                                                            <div key={i} onClick={(e) => { e.stopPropagation(); handleWaterClick(i + 1); }} className={`flex-1 rounded-sm cursor-pointer transition-all border border-transparent ${i < (vitals.water || 0) ? (isWaterMet ? 'bg-emerald-500' : 'bg-blue-400 shadow-sm') : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}`} />
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </Wrapper>
                            );
                        }

                        if (card.id === 'caffeine') {
                            const caffeineLimit = settings.dailyCaffeineLimit || 400;
                            return (
                                <Wrapper key="caffeine" className="md:col-span-6 lg:col-span-3">
                                    <CaffeineCard
                                        density={density}
                                        caffeineLimit={caffeineLimit}
                                        currentCaffeine={vitals.caffeine || 0}
                                        isEditing={editing === 'caffeine'}
                                        tempValue={tempValue}
                                        onCardClick={() => handleCardClick('caffeine', vitals.caffeine || 0)}
                                        onValueChange={setTempValue}
                                        onSave={() => handleSave('caffeine')}
                                        onCancel={() => setEditing(null)}
                                        onKeyDown={(e) => handleKeyDown(e, 'caffeine')}
                                        onQuickAdd={handleCaffeineAdd}
                                    />
                                </Wrapper>
                            );
                        }
                    })}

                    {/* duplicate KPI removed */}<div className="hidden"></div>

                    {/* Old Cards Removed (Sleep/Alc/Water/Caff/Training/Goals) */}<div className="hidden"></div>

                    {/* Health Metrics Card - Expanded */}

                    <div className={`col-span-12 md:col-span-8 lg:col-span-8 ${density === 'compact' ? 'p-1' : 'p-0'} rounded-3xl`}>
                        <div className={`h-full ${density === 'compact' ? 'p-2' : 'p-6'} bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col`}>
                            <div className="relative z-10 flex flex-col h-full">
                                {/* Header with Title and Range Selector */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hälsomått</h3>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                                                    {(latestWeightVal || 0).toFixed(1)}
                                                </span>
                                                <span className="text-sm font-bold text-slate-500">kg</span>
                                            </div>
                                        </div>

                                        {/* Trend integrated into header */}
                                        <div className="border-l border-slate-100 dark:border-white/5 pl-4 flex flex-col justify-center">
                                            <div className={`text-[10px] font-black uppercase ${weightDiffRange < -0.5 ? 'text-emerald-500' : weightDiffRange > 0.5 ? 'text-rose-500' : 'text-slate-500'}`}>
                                                {weightDiffRange < -0.5 ? 'Minskande' : weightDiffRange > 0.5 ? 'Ökande' : 'Stabil'}
                                            </div>
                                            <div className={`text-[9px] font-bold ${weightDiffRange <= 0 ? 'text-emerald-500' : 'text-rose-500'} opacity-80`}>
                                                {weightDiffRange > 0 ? '+' : ''}{weightDiffRange.toFixed(1)} kg
                                            </div>
                                        </div>
                                    </div>

                                    {/* Range Selectors */}
                                    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-0.5 rounded-lg">
                                        {(['7d', '14d', '30d', '3m', '1y', 'year', 'all'] as const).map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setWeightRange(r)}
                                                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all ${weightRange === r ? 'bg-white dark:bg-slate-700 text-blue-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {r === 'all' ? 'All' : r === 'year' ? 'i år' : r.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                                    {/* Current Weight Detail */}
                                    <div className="cursor-pointer group/stat flex flex-col justify-center" onClick={() => {
                                        setTempValue((unifiedHistory[0]?.weight || "").toString());
                                        setTempWaist((latestWaist || "").toString());
                                        setTempChest((latestChest || "").toString());
                                        setIsWeightModalOpen(true);
                                    }}>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Vikt</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-blue-500">{(latestWeightVal || 0).toFixed(1)}<span className="text-[10px] ml-0.5 opacity-50 font-bold">kg</span></div>
                                    </div>

                                    {/* Waist Detail */}
                                    <div className="cursor-pointer group/stat border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center" onClick={() => {
                                        setTempValue((latest3Weights[0]?.weight || "").toString());
                                        setTempWaist((latestWaist || "").toString());
                                        setTempChest((latestChest || "").toString());
                                        setIsWeightModalOpen(true);
                                    }}>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Midja</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-emerald-500">
                                            {latestWaist || '--'}
                                            <span className="text-[10px] ml-0.5 opacity-50 font-bold">cm</span>
                                        </div>
                                    </div>

                                    {/* Chest (Bröst) */}
                                    <div className="border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center hidden md:flex cursor-pointer" onClick={() => {
                                        setTempValue((unifiedHistory[0]?.weight || "").toString());
                                        setTempWaist((latestWaist || "").toString());
                                        setTempChest((latestChest || "").toString());
                                        setIsWeightModalOpen(true);
                                    }}>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Bröst</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white">
                                            {latestChest || '--'}
                                            <span className="text-[10px] ml-0.5 opacity-50 font-bold">cm</span>
                                        </div>
                                    </div>

                                    {/* BMI Meter */}
                                    <div className="border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">BMI</div>
                                        {bmi ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-xl font-black transition-colors ${getBMICategory(bmi).color}`}>{bmi.toFixed(1)}</span>
                                                <div className={`p-1 rounded-md ${getBMICategory(bmi).bg} ${getBMICategory(bmi).color}`}>
                                                    <Target size={10} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[8px] text-slate-500 italic">--</div>
                                        )}
                                    </div>
                                </div>

                                {/* Sparkline Visual */}
                                <div className="bg-slate-50 dark:bg-white/[0.02] rounded-3xl p-4 border border-slate-100 dark:border-white/5 relative w-full">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Trendkurva</div>
                                    <div className="h-64 aspect-[4/3]">
                                        <WeightSparkline
                                            data={weightTrendEntries}
                                            dates={weightTrendEntries.map(e => e.date)}
                                            onPointClick={(idx) => {
                                                const entry = weightTrendEntries[idx];
                                                if (entry) {
                                                    setTempValue(entry.weight > 0 ? entry.weight.toString() : "");
                                                    setTempWaist((entry.waist || "").toString());
                                                    setTempChest((entry.chest || "").toString());
                                                    setSelectedDate(entry.date);
                                                    setIsWeightModalOpen(true);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-end mt-2 px-1">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{weightTrendEntries[0]?.date || ''}</span>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{weightTrendEntries[weightTrendEntries.length - 1]?.date || ''}</span>
                                    </div>
                                </div>

                                {/* Footer / Latest 3 */}
                                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senaste historik</div>
                                        <button
                                            onClick={() => setShowAllHistory(!showAllHistory)}
                                            className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-500 hover:text-white transition-all transform active:scale-95"
                                            title={showAllHistory ? "Visa färre" : "Visa fler"}
                                        >
                                            {showAllHistory ? <X size={12} /> : <div className="text-sm font-bold mt-[-1px]">+</div>}
                                        </button>
                                    </div>
                                    <div className={`grid grid-cols-2 gap-2 ${showAllHistory ? 'max-h-[400px] overflow-y-auto pr-2 custom-scrollbar' : ''}`}>
                                        {(showAllHistory ? unifiedHistory : unifiedHistory.slice(0, 4)).map((w) => (
                                            <div key={w.id} className="px-3 py-2 bg-white dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between group/item hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => {
                                                setTempValue((w.weight || "").toString());
                                                setTempWaist((w.waist || "").toString());
                                                setTempChest((w.chest || "").toString());
                                                setSelectedDate(w.date);
                                                setIsWeightModalOpen(true);
                                            }}>
                                                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase min-w-[60px]">{getRelativeDateLabel(w.date)}</span>
                                                    <div className="flex items-center flex-wrap gap-x-2">
                                                        {w.weight ? (
                                                            <span className="text-sm font-black text-slate-900 dark:text-white">{w.weight.toFixed(1)} <span className="text-[10px] text-slate-400">kg</span></span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 italic">Ingen vikt</span>
                                                        )}

                                                        {w.waist && (
                                                            <>
                                                                <span className="text-slate-200 dark:text-slate-700">|</span>
                                                                <span className="text-sm font-bold text-emerald-500">{w.waist} <span className="text-[10px] font-normal opacity-70">cm (midja)</span></span>
                                                            </>
                                                        )}

                                                        {w.chest && (
                                                            <>
                                                                <span className="text-slate-200 dark:text-slate-700">|</span>
                                                                <span className="text-sm font-bold text-indigo-500">{w.chest} <span className="text-[10px] font-normal opacity-70">cm (bröst)</span></span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight size={12} className="text-slate-300 group-hover/item:text-blue-500 transition-colors" />
                                            </div>
                                        ))}
                                        {unifiedHistory.length === 0 && (
                                            <div className="col-span-1 text-center py-4 text-xs text-slate-400 italic">Ingen historik tillgänglig ännu.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 7-Day Performance Summary - Horizontal Timeline */}
                    <div
                        className="col-span-12 md:col-span-12 relative z-[60]"
                        onMouseEnter={() => setIsHoveringChart(true)}
                        onMouseLeave={() => setIsHoveringChart(false)}
                    >
                        <div className={`w-full ${density === 'compact' ? 'p-4' : 'p-6'} bg-slate-900 rounded-2xl border border-slate-800 transition-all duration-300`}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white">Senaste 7 Dagarna</h3>

                                    {/* Date Context Highlight */}
                                    {(() => {
                                        const now = new Date();
                                        const sel = new Date(selectedDate);
                                        const diffTime = sel.getTime() - now.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                        let label = '';
                                        if (selectedDate === now.toISOString().split('T')[0]) label = 'IDAG';
                                        else if (diffDays === 0) label = 'IDAG'; // Fallback
                                        else if (diffDays === 1) label = 'IMORGON';
                                        else if (diffDays === -1) label = 'IGÅR';
                                        else label = selectedDate;

                                        return label ? (
                                            <span className="ml-2 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-wider border border-indigo-500/20">
                                                {label}
                                            </span>
                                        ) : null;
                                    })()}
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Träning</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">Idag</span>
                                    </div>
                                </div>
                            </div>

                            {/* Horizontal Timeline */}
                            {(() => {
                                // Rolling window ending on SELECTED DATE
                                const days = Array.from({ length: 7 }, (_, i) => {
                                    const d = new Date(selectedDate);
                                    d.setDate(d.getDate() - (6 - i));
                                    return d.toISOString().split('T')[0];
                                });

                                const dayLabels = ['SÖN', 'MÅN', 'TIS', 'ONS', 'TORS', 'FRE', 'LÖR'];

                                // Calculate totals
                                let totalMinutes = 0;
                                let totalTonnage = 0;
                                let totalDistance = 0;
                                let cardioCount = 0;
                                let strengthCount = 0;

                                days.forEach(date => {
                                    const dayActivities = unifiedActivities.filter(a => a.date === date);
                                    dayActivities.forEach(a => {
                                        totalMinutes += a.durationMinutes || 0;
                                        totalTonnage += (a.tonnage || 0) / 1000;
                                        totalDistance += a.distance || 0;
                                        if (a.type === 'strength') strengthCount++;
                                        else cardioCount++;
                                    });
                                });

                                const totalMinsRounded = Math.round(totalMinutes);
                                const totalHours = Math.floor(totalMinsRounded / 60);
                                const remainingMins = totalMinsRounded % 60;
                                const completedWorkouts = cardioCount + strengthCount;

                                return (
                                    <>
                                        {/* Timeline Row */}
                                        <div className="flex items-end justify-between mb-8 relative h-32 px-2">
                                            {/* Baseline */}
                                            <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-700"></div>

                                            {days.map((date, i) => {
                                                const d = new Date(date);
                                                const dayOfWeek = d.getDay();
                                                // Check against SELECTED DATE for visual marker
                                                const isSelected = date === selectedDate;
                                                const isToday = date === new Date().toISOString().split('T')[0];

                                                const dayActivities = unifiedActivities.filter(a => a.date === date);
                                                const hasTraining = dayActivities.length > 0;
                                                const isIncomplete = dailyVitals[date]?.incomplete;

                                                // Calculate bar height based on duration (max 100px)
                                                const totalDuration = dayActivities.reduce((sum, a) => sum + (a.durationMinutes || 0), 0);
                                                const barHeight = Math.min(Math.max(totalDuration, 4), 100); // Min 4px visibility

                                                return (
                                                    <div
                                                        key={date}
                                                        className={`flex-1 flex flex-col items-center justify-end h-full cursor-pointer relative z-10 group transition-all duration-300 ${hoveredDay && hoveredDay !== date ? 'blur-[1px] opacity-40 scale-[0.98]' : 'blur-0 opacity-100 scale-100'}`}
                                                        onMouseEnter={() => setHoveredDay(date)}
                                                        onMouseLeave={() => setHoveredDay(null)}
                                                        onClick={() => setSelectedDate(date)}
                                                    >
                                                        {hoveredDay === date && (
                                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-[100]">
                                                                <DayHoverCard
                                                                    date={date}
                                                                    activities={dayActivities}
                                                                    nutrition={calculateDailyNutrition(date)}
                                                                    onActivityClick={(id) => navigate(`/logg?activityId=${id}`)}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Activity Bar */}
                                                        {hasTraining ? (
                                                            <div
                                                                className={`w-2 md:w-3 rounded-full mb-2 transition-all duration-300 ${dayActivities.some(a => a.type === 'strength')
                                                                    ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]'
                                                                    : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                                                    } ${hoveredDay === date ? 'scale-110' : ''}`}
                                                                style={{ height: `${barHeight}%` }}
                                                            ></div>
                                                        ) : (
                                                            <div className="mb-2"></div>
                                                        )}

                                                        {/* Day Label & Marker */}
                                                        <div className="flex flex-col items-center gap-1 mb-2">
                                                            {isIncomplete && (
                                                                <div className="w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_4px_rgba(249,115,22,0.6)] animate-pulse absolute -top-2" title="Ej fullständigt loggad dag" />
                                                            )}

                                                            <div className={`relative px-2 py-1 rounded-lg transition-colors ${isSelected ? 'bg-slate-800 border border-slate-700' : 'hover:bg-slate-800/50'}`}>
                                                                <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : isToday ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                                    {dayLabels[dayOfWeek]}
                                                                </span>
                                                                {isSelected && (
                                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500"></div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* No "Plupp" - clean baseline */}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Stats Row - Classic Layout (Reverted) */}
                                        <div className="flex items-center justify-between px-2 mt-4">
                                            {/* Total Tid */}
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Tid</div>
                                                <div className="text-2xl md:text-3xl font-black text-white">{totalHours}h {remainingMins}m</div>
                                                <div className="text-[10px] text-slate-500">{completedWorkouts} Slutförda pass</div>
                                            </div>

                                            {/* Volym */}
                                            <div className="space-y-1 border-l border-slate-800 pl-8">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volym</div>
                                                <div className="text-2xl md:text-3xl font-black text-emerald-400">{totalTonnage.toFixed(1)} <span className="text-sm text-slate-500">Ton</span></div>
                                                <div className="text-[10px] text-slate-500">Styrketräning</div>
                                            </div>

                                            {/* Distans */}
                                            <div className="space-y-1 border-l border-slate-800 pl-8">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distans</div>
                                                <div className="text-2xl md:text-3xl font-black text-indigo-400">{totalDistance.toFixed(1)} <span className="text-sm text-slate-500">Km</span></div>
                                                <div className="text-[10px] text-slate-500">Löpning / Gång</div>
                                            </div>

                                            {/* NEW: Streak Split */}
                                            <div className="space-y-1 border-l border-slate-800 pl-8">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Träningsstreak</div>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase w-14">Styrka</span>
                                                        <span className="text-sm font-black text-white">{calculateTrainingStreak(selectedDate, 'strength')} dagar</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase w-14">Kondition</span>
                                                        <span className="text-sm font-black text-white">{calculateTrainingStreak(selectedDate, 'running')} dagar</span>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1">{calculateWeeklyTrainingStreak(selectedDate)} veckor i rad (totalt)</div>
                                            </div>

                                            {/* Typ */}
                                            <div className="space-y-2 border-l border-slate-800 pl-8 hidden md:block">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Typ</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                    <span className="text-xs text-slate-300">Kondition {completedWorkouts > 0 ? Math.round((cardioCount / completedWorkouts) * 100) : 0}%</span>
                                                    <span className="text-[10px] text-slate-500">({cardioCount} pass)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    <span className="text-xs text-slate-300">Styrka {completedWorkouts > 0 ? Math.round((strengthCount / completedWorkouts) * 100) : 0}%</span>
                                                    <span className="text-[10px] text-slate-500">({strengthCount} pass)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>


                    {/* Moved Active Goals Card */}
                    <ActiveGoalsCard />

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
                                <div
                                    className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-all"
                                    onClick={() => navigate('/planning/training')}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Calendar size={12} className="text-indigo-500" />
                                        <span className="text-[8px] font-bold uppercase text-slate-400">Planera Träning</span>
                                    </div>
                                    <div className="text-xl font-black text-indigo-500 dark:text-indigo-400">+ Pass</div>
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
                </div >
            </div >



            {/* Weight & Measurements Modal */}
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
        </div >
    );
}

const EditIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);
