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
    Target,
    Settings,
    ChevronLeft
} from 'lucide-react';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal.tsx';
import { GoalsOverviewWidget } from '../components/goals/GoalsOverviewWidget.tsx';
import { ActiveGoalsCard } from '../components/dashboard/ActiveGoalsCard.tsx';
import { DailySummaryCard } from '../components/dashboard/DailySummaryCard.tsx';

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
                    {Math.round(value)}
                </div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</div>
                <div className="mt-2 flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        <div className={`w-2 h-2 rounded-full ${isProteinMet ? 'bg-emerald-500' : 'bg-orange-400'}`} />
                        <span className="text-slate-700 dark:text-slate-300">
                            {Math.round(innerValue)}/{innerMax}g
                        </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Protein
                    </span>
                </div>
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

const getRangeStartDate = (range: '14d' | '30d' | '3m' | '1y' | 'all') => {
    const d = new Date();
    if (range === '14d') d.setDate(d.getDate() - 14);
    else if (range === '30d') d.setDate(d.getDate() - 30);
    else if (range === '3m') d.setMonth(d.getMonth() - 3);
    else if (range === '1y') d.setFullYear(d.getFullYear() - 1);
    else return '0000-00-00';
    return d.toISOString().split('T')[0];
};

const WeightSparkline = ({
    data,
    dates,
    color = 'text-blue-500',
    onPointClick
}: {
    data: number[],
    dates: string[],
    color?: string,
    onPointClick?: (index: number) => void
}) => {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    if (data.length < 2) return <div className="h-[40px] w-full flex items-center justify-center text-[8px] text-slate-300 uppercase font-bold tracking-widest bg-slate-50/50 dark:bg-slate-800/20 rounded-xl">Trend saknas</div>;

    // Calculate range with tighter padding for "scaled up" effect
    const min = Math.min(...data);
    const max = Math.max(...data);
    const padding = (max - min) * 0.05 || 0.2;
    const adjMin = min - padding;
    const adjMax = max + padding;
    const range = adjMax - adjMin || 1;

    const width = 100;
    const heightFixed = 60;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = heightFixed - ((v - adjMin) / range) * heightFixed;
        return { x, y, value: v, index: i };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    // Grid lines (3 horizontal lines)
    const gridLines = [adjMin, adjMin + range / 2, adjMax].map(val => {
        const y = heightFixed - ((val - adjMin) / range) * heightFixed;
        return { y, label: val.toFixed(1) };
    });

    return (
        <div
            className="w-full h-[80px] px-1 group/sparkline relative"
            onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setHoveredIdx(null)}
        >
            <svg
                viewBox={`0 0 ${width} ${heightFixed}`}
                preserveAspectRatio="none"
                className={`w-full h-full overflow-visible ${color}`}
            >
                {/* Horizontal Grid Lines */}
                {gridLines.map((line, i) => (
                    <g key={i} className="opacity-10">
                        <line x1="0" y1={line.y} x2={width} y2={line.y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" />
                        <text x="-2" y={line.y} fontSize="4" className="fill-slate-400 font-bold text-right" style={{ dominantBaseline: 'middle', textAnchor: 'end' }}>{line.label}</text>
                    </g>
                ))}

                {/* The Path */}
                <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    points={polylinePoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-sm transition-all duration-500"
                />

                {/* Interactive Data Points */}
                {points.map((p, i) => (
                    <g
                        key={i}
                        className="cursor-pointer"
                        onClick={() => onPointClick?.(i)}
                        onMouseEnter={() => setHoveredIdx(i)}
                    >
                        {/* Transparent hit area */}
                        <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
                        {/* The actual dot */}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredIdx === i ? "2.5" : "1.5"}
                            className={`fill-white stroke-current stroke-[2] transition-all ${hoveredIdx === i ? 'opacity-100' : 'opacity-0 group-hover/sparkline:opacity-100'}`}
                        />
                    </g>
                ))}
            </svg>

            {/* Hover Tooltip/Card */}
            {hoveredIdx !== null && (
                <div
                    className="absolute z-50 pointer-events-none bg-slate-900/90 dark:bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 dark:border-black/5 shadow-2xl flex flex-col gap-0.5 min-w-[80px]"
                    style={{
                        left: `${(hoveredIdx / (data.length - 1)) * 100}%`,
                        top: '0',
                        transform: `translate(${hoveredIdx > data.length / 2 ? '-100%' : '20%'}, -100%)`
                    }}
                >
                    <div className="text-[10px] font-black text-white/50 dark:text-black/50 uppercase tracking-widest">{dates[hoveredIdx]}</div>
                    <div className="text-sm font-black text-white dark:text-slate-900">{data[hoveredIdx].toFixed(1)} <span className="text-[10px] text-white/60 dark:text-slate-500">kg</span></div>
                </div>
            )}
        </div>
    );
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
    onActivityClick: (act: any) => void
}) => {
    const navigate = useNavigate();
    const dayName = new Date(date).toLocaleDateString('sv-SE', { weekday: 'long' });
    const formattedDate = new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

    return (
        <div className="absolute z-[100] bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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
                                        onClick={(e) => { e.stopPropagation(); onActivityClick(act); }}
                                        className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors cursor-pointer group"
                                    >
                                        <div className="text-sm">{typeDef?.icon || '💪'}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-white">{typeDef?.label || act.type}</div>
                                            <div className="text-[9px] text-slate-500">{act.durationMinutes} min {act.distance ? `• ${act.distance} km` : ''}</div>
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
        trainingPeriods
    } = useData();

    const [selectedDate, setSelectedDate] = useState(getISODate());
    const health = useHealth(selectedDate);
    const today = getISODate();

    // Local state for interactivity
    const [vitals, setVitals] = useState<DailyVitals>({ water: 0, sleep: 0, caffeine: 0, alcohol: 0, updatedAt: '' });
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");
    const [tempWaist, setTempWaist] = useState<string>("");
    const [selectedActivity, setSelectedActivity] = useState<any>(null);
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [bulkInput, setBulkInput] = useState("");
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [weightRange, setWeightRange] = useState<'14d' | '30d' | '3m' | '1y' | 'all'>('1y');
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);

    const changeDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

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
                setSelectedActivity(null);
                setEditing(null);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

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

    // 1. Calories & Nutrition
    const dailyNutrition = calculateDailyNutrition(selectedDate);
    const consumed = dailyNutrition.calories;
    const burned = health.dailyCaloriesBurned || 0;

    // Determine target based on hierarchy: Active Period Goal > Settings > Default
    const activePeriod = trainingPeriods.find(p => selectedDate >= p.startDate && selectedDate <= p.endDate);
    const target = activePeriod?.nutritionGoal?.calories || settings.dailyCalorieGoal || 2500;

    // 2. Macros
    const proteinTarget = settings.dailyProteinGoal || 160;
    const proteinCurrent = dailyNutrition.protein;

    const carbsTarget = settings.dailyCarbsGoal || 250;
    const carbsCurrent = dailyNutrition.carbs;

    const fatTarget = settings.dailyFatGoal || 80;
    const fatCurrent = dailyNutrition.fat;

    // 3. Weight & Measurement Logic
    const getRangeDays = (range: typeof weightRange) => {
        switch (range) {
            case '14d': return 14;
            case '30d': return 30;
            case '3m': return 90;
            case '1y': return 365;
            default: return 9999;
        }
    };

    const rangeStartISO = getRangeStartDate(weightRange);

    // Filter and sort for sparkline
    const weightTrendEntries = [...weightEntries]
        .filter(w => /^\d{4}-\d{2}-\d{2}$/.test(w.date))
        .filter(w => weightRange === 'all' || w.date >= rangeStartISO)
        .sort((a, b) => a.date.localeCompare(b.date));

    const earliestWeightInRange = weightTrendEntries.length > 0 ? weightTrendEntries[0].weight : 0;
    const latestWeightInRange = weightTrendEntries.length > 0 ? weightTrendEntries[weightTrendEntries.length - 1].weight : 0;
    const weightDiffRange = latestWeightInRange - earliestWeightInRange;

    // Data for sparkline (values only)
    const weightTrend = weightTrendEntries.map(e => e.weight);

    const latest3Weights = [...weightEntries]
        .filter(w => /^\d{4}-\d{2}-\d{2}$/.test(w.date))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);

    const currentUserHeight = settings.height || 0;
    const latestWeightVal = latest3Weights[0]?.weight;
    const bmi = (latestWeightVal && currentUserHeight)
        ? (latestWeightVal / (Math.pow(currentUserHeight / 100, 2)))
        : null;

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
                            className={`flex items-center ${density === 'compact' ? 'gap-1.5 p-1 rounded-lg' : 'gap-2 p-2 rounded-xl'} group/item cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 hover:shadow-sm relative bg-white/40 dark:bg-slate-900/40`}
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
        <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-950 p-4 md:p-12 font-sans text-slate-900 dark:text-white animate-in fade-in duration-500 transition-colors">
            <div className="max-w-5xl mx-auto">
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

                <div className={`grid grid-cols-1 md:grid-cols-12 ${density === 'compact' ? 'gap-3' : density === 'slim' ? 'gap-4' : 'gap-6'} items-stretch`}>
                    {/* Top Section: Daily Summary & Active Goals */}
                    <div className="md:col-span-12 flex flex-col gap-4 mb-4">
                        <DailySummaryCard
                            calories={{ current: consumed, target: target }}
                            protein={{ current: proteinCurrent, target: proteinTarget }}
                            trainingMinutes={completedTraining.reduce((sum, act) => sum + act.durationMinutes, 0)}
                            measurementsCount={0}
                            weighInDone={latest3Weights.some(w => w.date === today)}
                            sleepHours={vitals.sleep || 0}
                            alcoholUnits={vitals.alcohol || 0}
                            density={density === 'compact' ? 'compact' : 'normal'}
                        />
                        <ActiveGoalsCard />
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
                                    <div className={`flex-1 flex items-start ${density === 'compact' ? 'gap-2 p-2' : 'gap-4 p-4'} border rounded-2xl bg-white dark:bg-slate-900 shadow-sm border-slate-100 dark:border-slate-800 h-full`}>
                                        <DoubleCircularProgress
                                            value={consumed}
                                            max={target}
                                            innerValue={proteinCurrent}
                                            innerMax={proteinTarget}
                                            label="Kcal"
                                            subLabel={<span>{Math.round(consumed - target)} kcal</span>}
                                        />
                                        <div className="flex-1 ml-4 overflow-hidden">
                                            <div className={`font-black text-slate-900 dark:text-white uppercase tracking-tighter ${density === 'compact' ? 'text-[10px] mb-2' : 'text-sm mb-4'}`}>Dagens Intag</div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                                {/* Protein */}
                                                <div>
                                                    <div className={`flex justify-between items-baseline mb-1`}>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protein</span>
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
                                            </div>
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
                                        className={`w-full ${density === 'compact' ? 'p-1.5 gap-2 rounded-xl' : density === 'slim' ? 'p-3 gap-3 rounded-2xl' : 'p-6 gap-4 rounded-3xl'} shadow-sm border border-slate-100 dark:border-slate-800 flex items-start hover:scale-[1.01] transition-transform cursor-pointer group bg-white dark:bg-slate-900 h-full`}
                                    >
                                        <div className={`${density === 'compact' ? 'w-8 h-8' : 'w-14 h-14'} bg-[#DCFCE7] dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500 transition-colors shrink-0`}>
                                            <Dumbbell className={density === 'compact' ? 'w-4 h-4' : 'w-7 h-7'} />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
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
                            const caff = vitals.caffeine || 0;
                            const isCaffHigh = caff >= caffeineLimit;
                            const isCaffWarning = !isCaffHigh && caff >= caffeineLimit * 0.7;

                            return (
                                <Wrapper key="caffeine" className="md:col-span-6 lg:col-span-3">
                                    <div
                                        onClick={() => handleCardClick('caffeine', vitals.caffeine || 0)}
                                        className={`${density === 'compact' ? 'p-2.5 rounded-2xl' : 'p-4 rounded-3xl'} border shadow-sm flex flex-col justify-between hover:scale-[1.02] transition-all cursor-pointer overflow-hidden relative h-full ${isCaffHigh ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' : isCaffWarning ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
                                    >
                                        <Coffee className="absolute -bottom-4 -right-4 w-24 h-24 text-amber-500/5 dark:text-amber-400/10 pointer-events-none transform rotate-6 transition-all group-hover:scale-110" />
                                        <div className={`flex items-center ${density === 'compact' ? 'gap-1.5 mb-1' : 'gap-2 mb-2'} relative z-10`}>
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
                                                                    updateVitals(selectedDate, { caffeine: newVal });
                                                                }} className="w-5 h-5 flex items-center justify-center text-[10px] font-bold hover:bg-white dark:hover:bg-slate-700 rounded">-</button>
                                                            <span className="text-[10px] mx-0.5">🥤</span>
                                                            <button
                                                                onMouseDown={e => e.preventDefault()}
                                                                onClick={() => {
                                                                    const newVal = (vitals.caffeine || 0) + 180;
                                                                    setVitals(p => ({ ...p, caffeine: newVal }));
                                                                    setTempValue(newVal.toString());
                                                                    updateVitals(selectedDate, { caffeine: newVal });
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
                                </Wrapper>
                            );
                        }
                    })}

                    {/* duplicate KPI removed */}<div className="hidden"></div>

                    {/* Old Cards Removed (Sleep/Alc/Water/Caff/Training/Goals) */}<div className="hidden"></div>

                    {/* Health Metrics Card - Expanded */}

                    <div className={`col-span-12 md:col-span-8 lg:col-span-6 ${density === 'compact' ? 'p-1' : 'p-0'} rounded-3xl`}>
                        <div className={`h-full ${density === 'compact' ? 'p-2' : 'p-6'} bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col`}>
                            <div className="relative z-10 flex flex-col h-full">
                                {/* Header with Title and Range Selector */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hälsomått</h3>
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                                                    {(latest3Weights[0]?.weight || 0).toFixed(1)}
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
                                        {(['14d', '30d', '3m', '1y', 'all'] as const).map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setWeightRange(r)}
                                                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all ${weightRange === r ? 'bg-white dark:bg-slate-700 text-blue-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {r === 'all' ? 'All' : r}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Stats Grid */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {/* Current Weight Detail */}
                                    <div className="cursor-pointer group/stat flex flex-col justify-center" onClick={() => {
                                        setTempValue((latest3Weights[0]?.weight || "").toString());
                                        setTempWaist((latest3Weights[0]?.waist || "").toString());
                                        setIsWeightModalOpen(true);
                                    }}>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Vikt</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-blue-500">{(latest3Weights[0]?.weight || 0).toFixed(1)}<span className="text-[10px] ml-0.5 opacity-50 font-bold">kg</span></div>
                                    </div>

                                    {/* Waist Detail */}
                                    <div className="cursor-pointer group/stat border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center" onClick={() => {
                                        setTempValue((latest3Weights[0]?.weight || "").toString());
                                        setTempWaist((latest3Weights[0]?.waist || "").toString());
                                        setIsWeightModalOpen(true);
                                    }}>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Midja</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white transition-colors group-hover/stat:text-emerald-500">
                                            {useData().bodyMeasurements?.filter(m => m.type === 'waist').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.value || latest3Weights[0]?.waist || '--'}
                                            <span className="text-[10px] ml-0.5 opacity-50 font-bold">cm</span>
                                        </div>
                                    </div>

                                    {/* Chest (Bröst) */}
                                    <div className="border-l border-slate-100 dark:border-white/5 pl-3 flex flex-col justify-center hidden md:flex">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Bröst</div>
                                        <div className="text-xl font-black text-slate-900 dark:text-white">
                                            {useData().bodyMeasurements.filter(m => m.type === 'chest').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.value || '--'}
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
                                <div className="flex-1 min-h-[120px] bg-slate-50 dark:bg-white/[0.02] rounded-3xl p-4 border border-slate-100 dark:border-white/5 relative">
                                    <div className="absolute top-4 left-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Trendkurva</div>
                                    <div className="h-20 mt-4">
                                        <WeightSparkline
                                            data={weightTrend}
                                            dates={weightTrendEntries.map(e => e.date)}
                                            color={weightDiffRange <= 0 ? 'text-emerald-500' : 'text-rose-500'}
                                            onPointClick={(idx) => {
                                                const entry = weightTrendEntries[idx];
                                                if (entry) {
                                                    setTempValue(entry.weight.toString());
                                                    setTempWaist((entry.waist || "").toString());
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
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Senaste historik</div>
                                    <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
                                        {latest3Weights.length > 0 ? latest3Weights.map((w) => (
                                            <div key={w.id} className="px-3 py-2 bg-white dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between group/item hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => {
                                                setTempValue(w.weight.toString());
                                                setTempWaist((w.waist || "").toString());
                                                setIsWeightModalOpen(true);
                                            }}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase min-w-[60px]">{getRelativeDateLabel(w.date)}</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-sm font-black text-slate-900 dark:text-white">{w.weight}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">kg</span>
                                                        {w.waist && (
                                                            <>
                                                                <span className="mx-1.5 opacity-20">|</span>
                                                                <span className="text-sm font-black text-slate-900 dark:text-white">{w.waist}</span>
                                                                <span className="text-[9px] font-bold text-slate-400">cm</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight size={12} className="text-slate-300 group-hover/item:text-blue-500 transition-colors" />
                                            </div>
                                        )) : (
                                            <div className="col-span-3 text-center py-4 text-xs text-slate-400 italic">Ingen historik tillgänglig ännu.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 7-Day Performance Summary - Horizontal Timeline */}
                    <div className="col-span-12 md:col-span-12">
                        <div className={`w-full ${density === 'compact' ? 'p-4' : 'p-6'} bg-slate-900 rounded-2xl border border-slate-800`}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white">Senaste 7 Dagarna</h3>
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
                                const days = Array.from({ length: 7 }, (_, i) => {
                                    const d = new Date();
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

                                const totalHours = Math.floor(totalMinutes / 60);
                                const remainingMins = totalMinutes % 60;
                                const completedWorkouts = cardioCount + strengthCount;

                                return (
                                    <>
                                        {/* Timeline Row */}
                                        <div className="flex items-end justify-between mb-8 relative">
                                            {/* Baseline */}
                                            <div className="absolute bottom-3 left-0 right-0 h-px bg-slate-700"></div>

                                            {days.map((date, i) => {
                                                const d = new Date(date);
                                                const dayOfWeek = d.getDay();
                                                const isToday = date === new Date().toISOString().split('T')[0];
                                                const dayActivities = unifiedActivities.filter(a => a.date === date);
                                                const hasTraining = dayActivities.length > 0;

                                                return (
                                                    <div
                                                        key={date}
                                                        className={`flex-1 flex flex-col items-center cursor-pointer relative ${isToday ? 'z-10' : ''}`}
                                                        onMouseEnter={() => setHoveredDay(date)}
                                                        onMouseLeave={() => setHoveredDay(null)}
                                                    >
                                                        {hoveredDay === date && (
                                                            <DayHoverCard
                                                                date={date}
                                                                activities={dayActivities}
                                                                nutrition={calculateDailyNutrition(date)}
                                                                onActivityClick={(act) => setSelectedActivity(act)}
                                                            />
                                                        )}
                                                        {/* Day Label */}
                                                        <span className={`text-[10px] font-bold mb-2 ${isToday ? 'text-white' : 'text-slate-500'}`}>
                                                            {dayLabels[dayOfWeek]}
                                                        </span>

                                                        {/* Activity Bar or Dot */}
                                                        {isToday ? (
                                                            <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-1">
                                                                <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                                                            </div>
                                                        ) : hasTraining ? (
                                                            <div
                                                                className="w-1.5 rounded-full bg-emerald-500 mb-1"
                                                                style={{ height: `${Math.min(dayActivities.reduce((sum, a) => sum + (a.durationMinutes || 30), 0) / 2, 40)}px` }}
                                                            ></div>
                                                        ) : (
                                                            <div className="w-2 h-2 rounded-full bg-slate-700 mb-1"></div>
                                                        )}

                                                        {/* Baseline Dot */}
                                                        <div className={`w-1.5 h-1.5 rounded-full ${hasTraining ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Stats Row */}
                                        <div className="grid grid-cols-4 gap-4">
                                            {/* Total Tid */}
                                            <div className="space-y-1">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Tid</div>
                                                <div className="text-2xl font-black text-white">{totalHours}h {remainingMins}m</div>
                                                <div className="text-[10px] text-slate-500">{completedWorkouts} Slutförda pass</div>
                                            </div>

                                            {/* Volym */}
                                            <div className="space-y-1 border-l border-slate-800 pl-4">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volym</div>
                                                <div className="text-2xl font-black text-emerald-400">{totalTonnage.toFixed(1)} Ton</div>
                                                <div className="text-[10px] text-slate-500">Styrketräning</div>
                                            </div>

                                            {/* Distans */}
                                            <div className="space-y-1 border-l border-slate-800 pl-4">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distans</div>
                                                <div className="text-2xl font-black text-indigo-400">{totalDistance.toFixed(1)} Km</div>
                                                <div className="text-[10px] text-slate-500">Löpning / Gång</div>
                                            </div>

                                            {/* Typ */}
                                            <div className="space-y-2 border-l border-slate-800 pl-4">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Typ</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                    <span className="text-xs text-slate-300">Kondition {cardioCount > 0 ? Math.round((cardioCount / (cardioCount + strengthCount)) * 100) : 0}%</span>
                                                    <span className="text-[10px] text-slate-500">({cardioCount} pass)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                    <span className="text-xs text-slate-300">Styrka {strengthCount > 0 ? Math.round((strengthCount / (cardioCount + strengthCount)) * 100) : 0}%</span>
                                                    <span className="text-[10px] text-slate-500">({strengthCount} pass)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
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

            {/* Weight & Measurements Modal */}
            {isWeightModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsWeightModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">Vägning & mätning</h2>
                                    <p className="text-xs font-medium text-slate-500">Logga {getRelativeDateLabel(selectedDate === today ? today : selectedDate).toLowerCase()} form</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowBulkImport(!showBulkImport)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                                        title="Bulk-import"
                                    >
                                        <Zap size={20} className={showBulkImport ? 'text-blue-500' : ''} />
                                    </button>
                                    <button
                                        onClick={() => setIsWeightModalOpen(false)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {showBulkImport ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={bulkInput}
                                        onChange={(e) => setBulkInput(e.target.value)}
                                        placeholder="Klistra in data (Datum Vikt Midja)..."
                                        className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-sm outline-none focus:ring-2 ring-blue-500/20"
                                    />
                                    <button
                                        onClick={() => {
                                            const entries = bulkInput.split('\n')
                                                .map(line => line.trim())
                                                .filter(line => line.length > 0)
                                                .map(line => {
                                                    // Split on tab, comma, or multiple spaces
                                                    const parts = line.split(/[\t, ]+/);
                                                    // Expect: Date Weight [Waist]
                                                    if (parts.length >= 2) {
                                                        const date = parts[0];
                                                        const weight = parseFloat(parts[1].replace(',', '.'));
                                                        const waist = parts.length > 2 ? parseFloat(parts[2].replace(',', '.')) : undefined;

                                                        if (!isNaN(weight)) {
                                                            return { date, weight, waist };
                                                        }
                                                    }
                                                    return null;
                                                })
                                                .filter((e): e is { date: string, weight: number, waist?: number } => e !== null);

                                            if (entries.length > 0) {
                                                bulkAddWeightEntries(entries);
                                                setBulkInput("");
                                                setShowBulkImport(false);
                                            }
                                        }}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-lg transition-all"
                                    >
                                        Importera Data
                                    </button>
                                </div>
                            ) : (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const w = parseFloat(tempValue);
                                        const waist = tempWaist ? parseFloat(tempWaist) : undefined;
                                        if (!isNaN(w)) {
                                            addWeightEntry(w, selectedDate, waist);
                                            setIsWeightModalOpen(false);
                                        }
                                    }}
                                    className="space-y-6"
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vikt (kg)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                autoFocus
                                                value={tempValue}
                                                onChange={(e) => setTempValue(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-3xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 ring-blue-500/20"
                                                placeholder="0.0"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Midja (cm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={tempWaist}
                                                onChange={(e) => setTempWaist(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-5 text-3xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 ring-blue-500/20"
                                                placeholder="-"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                                    >
                                        Spara
                                    </button>
                                </form>
                            )}

                            <div className="mt-8">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Historik (Senaste 5)</h3>
                                <div className="space-y-2">
                                    {weightEntries.slice().reverse().slice(0, 5).map(entry => (
                                        <div key={entry.date} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl group transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{entry.date}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-black text-slate-900 dark:text-white">{entry.weight.toFixed(1)} <span className="text-[10px] text-slate-400">kg</span></span>
                                                    {entry.waist && <span className="text-sm font-black text-slate-400 italic">{entry.waist} <span className="font-normal not-italic">cm</span></span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        setTempValue(entry.weight.toString());
                                                        setTempWaist((entry.waist || "").toString());
                                                        setIsWeightModalOpen(true);
                                                    }}
                                                    className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-500 transition-colors"
                                                >
                                                    <Settings size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const EditIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
);
