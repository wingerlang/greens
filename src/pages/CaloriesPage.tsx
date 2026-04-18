import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useSettings } from '../context/SettingsContext.tsx';
import { useAnalytics } from '../context/AnalyticsContext.tsx';
import { useHealth } from '../hooks/useHealth.ts';
import {
    type MealType,
    type MealItem,
    type MealEntry,
    type PlannedMeal,
    type QuickMeal,
    getISODate,
    generateId,
} from '../models/types.ts';
import { calculateAdaptiveGoals } from '../utils/performanceEngine.ts';
import { getActiveCalories } from '../utils/calorieTarget.ts';
import { calculateMealItemNutrition } from '../utils/nutrition/calculations.ts';
import { MealTimeline } from '../components/calories/MealTimeline.tsx';
import { QuickAddModal } from '../components/calories/QuickAddModal.tsx';
import { CreateQuickMealModal } from '../components/calories/CreateQuickMealModal.tsx';
import { NutritionBreakdownModal } from '../components/calories/NutritionBreakdownModal.tsx';
import { NutritionInsights } from '../components/calories/NutritionInsights.tsx';
import { MacroDistribution } from '../components/calories/MacroDistribution.tsx';
import { normalizeText, formatActivityDuration } from '../utils/formatters.ts';
import { DatePicker } from '../components/shared/DatePicker.tsx';
import { CalorieRing } from '../components/shared/CalorieRing.tsx';
import { MacroBars } from '../components/shared/MacroBars.tsx';
import { EstimateLunchModal } from '../components/calories/EstimateLunchModal.tsx';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap, Activity, Dumbbell, Heart, Timer, Clock, Map, Navigation, Trash2, ArrowRight } from 'lucide-react';
import './CaloriesPage.css';

export function CaloriesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        foodItems,
        recipes,
        mealEntries,
        addMealEntry,
        updateMealEntry,
        deleteMealEntry,
        getMealEntriesForDate,
        updateVitals,
        calculateDailyNutrition,
        getRecipeWithNutrition,
        getFoodItem,
        getPlannedMealsForDate,
        getExercisesForDate,
        getVitalsForDate,
        trainingPeriods,
        performanceGoals,
        toggleIncompleteDay,
        userSettings,
        deleteExercise,
        quickMeals,
        addQuickMeal,
        foodAliases,
        setSelectedDate: setDataSelectedDate
    } = useData();

    const { settings } = useSettings();
    const { logEvent } = useAnalytics();

    // Initialize from URL or default to today
    const urlDate = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(urlDate || getISODate());

    // Sync context date
    useEffect(() => {
        if (setDataSelectedDate) {
            setDataSelectedDate(selectedDate);
        }
    }, [selectedDate, setDataSelectedDate]);

    // Sync URL when date changes
    useEffect(() => {
        const current = searchParams.get('date');
        if (current !== selectedDate) {
            setSearchParams({ date: selectedDate });
        }
    }, [selectedDate, searchParams, setSearchParams]);

    const [isFormOpen, setIsFormOpen] = useState(false);

    // Smart meal type default based on time of day and selected date
    const getDefaultMealType = (date: string): MealType => {
        const today = getISODate();
        // If logging for a past date, default to snack (mellanmål)
        if (date !== today) {
            return 'snack';
        }
        // For today, use time-based logic
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 10) return 'breakfast';
        if (hour >= 10 && hour < 14) return 'lunch';
        if (hour >= 14 && hour < 17) return 'snack';
        if (hour >= 17 && hour < 21) return 'dinner';
        if (hour >= 21 || hour < 5) return 'evening_meal';
        return 'snack';
    };

    const [mealType, setMealType] = useState<MealType>(getDefaultMealType(urlDate || getISODate()));
    const [viewMode, setViewMode] = useState<'normal' | 'compact'>(() => (localStorage.getItem('calories_view_mode') as 'normal' | 'compact') || 'normal');

    // Quick-add state
    const [searchQuery, setSearchQuery] = useState('');
    const [quickAddServings, setQuickAddServings] = useState(1);
    const [portionMode] = useState<'portions' | 'st' | 'grams'>('portions');
    const [isQuickMealModalOpen, setIsQuickMealModalOpen] = useState(false);
    const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
    const [quickMealItems, setQuickMealItems] = useState<MealItem[]>([]);

    // Nutrition breakdown modal state
    const [breakdownItem, setBreakdownItem] = useState<MealItem | null>(null);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Tracking for smart suggestions
    const [lastAddedId, setLastAddedId] = useState<{ type: 'recipe' | 'foodItem', id: string } | null>(null);

    const dailyEntries = useMemo(
        () => getMealEntriesForDate(selectedDate),
        [getMealEntriesForDate, selectedDate]
    );

    const dailyExercises = useMemo(
        () => getExercisesForDate(selectedDate),
        [getExercisesForDate, selectedDate]
    );

    // Vitals local state
    const currentVitals = useMemo(() => getVitalsForDate(selectedDate), [getVitalsForDate, selectedDate]);
    const [editing, setEditing] = useState<string | null>(null);
    const [tempValue, setTempValue] = useState<string>("");

    const handleCardClick = (type: string, currentValue: number) => {
        setEditing(type);
        setTempValue(currentValue.toString());
    };

    const handleSave = (type: string) => {
        const val = parseFloat(tempValue);
        if (!isNaN(val)) {
            updateVitals(selectedDate, { [type]: val });
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, type: string) => {
        if (e.key === 'Enter') handleSave(type);
        if (e.key === 'Escape') setEditing(null);
    };

    const changeDate = useCallback((days: number) => {
        const d = new Date(selectedDate);
        d.setUTCDate(d.getUTCDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    }, [selectedDate, setSelectedDate]);

    const dailyNutrition = useMemo(
        () => calculateDailyNutrition(selectedDate),
        [calculateDailyNutrition, selectedDate]
    );

    const { tdee: maintenance, bmr, dailyCaloriesBurned: burned } = useHealth(selectedDate);

    // View mode toggle hotkey and navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only toggle if not in an input field
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            if (e.key.toLowerCase() === 'v') {
                setViewMode(prev => prev === 'compact' ? 'normal' : 'compact');
            }

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

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [changeDate]);

    const entriesByMeal = useMemo(() => {
        const grouped: Record<MealType, MealEntry[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
            beverage: [],
            estimate: [],
            evening_meal: [],
        };
        dailyEntries.forEach((entry: MealEntry) => {
            // Integration: Move 'estimate' entries into 'lunch' for display
            const targetType = entry.mealType === 'estimate' ? 'lunch' : entry.mealType;
            grouped[targetType].push(entry);
        });

        // Remove 'beverage' row if empty or by preference (user requested dryck hidden)
        return grouped;
    }, [dailyEntries]);

    const searchResults = useMemo(() => {
        const query = normalizeText(searchQuery);
        if (!query) return [];

        const recipeResults = recipes
            .filter(r => normalizeText(r.name).includes(query))
            .slice(0, 5)
            .map(r => ({ type: 'recipe' as const, id: r.id, name: r.name, subtitle: `${r.servings} portioner` }));

        const foodResults = foodItems
            .filter(f => {
                const alias = foodAliases[f.id];
                if (alias && normalizeText(alias).includes(query)) return true;
                return normalizeText(f.name).includes(query);
            })
            .slice(0, 5)
            .map(f => {
                const alias = foodAliases[f.id];
                return {
                    type: 'foodItem' as const,
                    id: f.id,
                    name: alias ? `${alias} (${f.name})` : f.name,
                    subtitle: `${f.calories} kcal/100g`,
                    defaultPortion: f.defaultPortionGrams,
                    yieldFactor: f.yieldFactor,
                    isCooked: f.isCooked
                };
            });

        return [...recipeResults, ...foodResults].slice(0, 8);
    }, [searchQuery, recipes, foodItems, foodAliases]);

    const proposals = useMemo(() => {
        const counts: Record<string, { type: 'recipe' | 'foodItem' | 'estimate'; id: string; count: number; lastUsed: number }> = {};

        mealEntries.forEach(entry => {
            const time = new Date(entry.createdAt || entry.date).getTime();
            entry.items.forEach(item => {
                if (item.type === 'estimate') return; // Skip estimates in proposals for now
                const key = `${item.type}-${item.referenceId}`;
                if (!counts[key]) {
                    counts[key] = { type: item.type, id: item.referenceId, count: 0, lastUsed: time };
                }
                counts[key].count++;
                counts[key].lastUsed = Math.max(counts[key].lastUsed, time);
            });
        });

        return Object.values(counts)
            .sort((a, b) => {
                const aRecency = a.lastUsed;
                const bRecency = b.lastUsed;
                if (a.count !== b.count) return b.count - a.count;
                return bRecency - aRecency;
            })
            .slice(0, 10)
            .map(p => {
                if (p.type === 'recipe') {
                    const r = recipes.find(rec => rec.id === p.id);
                    return { type: 'recipe' as const, id: p.id, name: r?.name || 'Okänt recept', subtitle: 'Ofta använd' };
                } else {
                    const f = foodItems.find(fi => fi.id === p.id);
                    return {
                        type: 'foodItem' as const,
                        id: p.id,
                        name: f?.name || 'Okänd råvara',
                        subtitle: 'Ofta använd',
                        defaultPortion: f?.defaultPortionGrams,
                        yieldFactor: f?.yieldFactor,
                        isCooked: f?.isCooked
                    };
                }
            });
    }, [mealEntries, recipes, foodItems]);

    const recommendations = useMemo(() => {
        if (!lastAddedId) return [];

        const associations: Record<string, number> = {};
        const targetKey = `${lastAddedId.type}-${lastAddedId.id}`;

        mealEntries.forEach(entry => {
            const keys = entry.items
                .filter(i => i.type !== 'estimate')
                .map(i => `${i.type}-${i.referenceId}`);

            if (keys.includes(targetKey)) {
                keys.forEach(k => {
                    if (k !== targetKey) {
                        associations[k] = (associations[k] || 0) + 1;
                    }
                });
            }
        });

        // Filter out items already in today's meal
        const currentMealItems = dailyEntries
            .filter(e => e.mealType === mealType)
            .flatMap(e => e.items.map(i => `${i.type}-${i.referenceId}`));

        return Object.entries(associations)
            .filter(([key]) => !currentMealItems.includes(key))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key]) => {
                const [type, id] = key.split('-');
                if (type === 'recipe') {
                    const r = recipes.find(rec => rec.id === id);
                    return { type: 'recipe' as const, id, name: r?.name || 'Okänt recept', subtitle: 'Rekommenderat' };
                } else {
                    const f = foodItems.find(fi => fi.id === id);
                    return {
                        type: 'foodItem' as const,
                        id,
                        name: f?.name || 'Okänd råvara',
                        subtitle: 'Rekommenderat',
                        defaultPortion: f?.defaultPortionGrams,
                        yieldFactor: f?.yieldFactor,
                        isCooked: f?.isCooked
                    };
                }
            });
    }, [lastAddedId, mealEntries, recipes, foodItems, dailyEntries, mealType]);

    const handleQuickAdd = (type: 'recipe' | 'foodItem', id: string, defaultPortion?: number, loggedAsCooked?: boolean, effectiveYieldFactor?: number, variantId?: string, durationMs?: number | null) => {
        let servingsValue = quickAddServings;

        if (type === 'foodItem') {
            if (portionMode === 'st' && defaultPortion) {
                servingsValue = defaultPortion * quickAddServings;
            } else if (portionMode === 'grams') {
                servingsValue = quickAddServings;
            } else {
                servingsValue = (defaultPortion || 100) * quickAddServings;
            }
        }

        const itemName = type === 'foodItem'
            ? foodItems.find(f => f.id === id)?.name || 'Okänd råvara'
            : recipes.find(r => r.id === id)?.name || 'Okänt recept';

        logEvent('quick_add_log', itemName, type, {
            type,
            itemId: id,
            grams: type === 'foodItem' ? servingsValue : undefined,
            isCooked: loggedAsCooked,
            durationMs
        });

        addMealEntry({
            date: selectedDate,
            mealType,
            items: [{
                type,
                referenceId: id,
                servings: servingsValue,
                ...(loggedAsCooked && { loggedAsCooked: true }),
                ...(effectiveYieldFactor && { effectiveYieldFactor }),
                ...(variantId && { variantId })
            }],
        });

        setSearchQuery('');
        setQuickAddServings(1);
        setLastAddedId({ type, id });
    };

    const handleDeleteEntry = (id: string) => {
        deleteMealEntry(id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === dailyEntries.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(dailyEntries.map(e => e.id)));
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Ta bort ${selectedIds.size} markerade måltider?`)) return;

        selectedIds.forEach(id => deleteMealEntry(id));
        setSelectedIds(new Set());
    };

    const getItemName = (item: MealItem): string => {
        if (item.type === 'estimate') {
            return (item.estimateDetails?.uncertaintyEmoji ? `${item.estimateDetails.uncertaintyEmoji} ` : '') + (item.estimateDetails?.name || 'Estimering');
        }
        if (item.type === 'recipe') {
            const recipe = recipes.find(r => r.id === item.referenceId);
            return recipe?.name || 'Okänt recept';
        } else {
            const food = foodItems.find(f => f.id === item.referenceId);
            const alias = foodAliases[item.referenceId];
            if (alias && food) return `${alias} (${food.name})`;
            return food?.name || 'Okänd råvara';
        }
    };

    const getItemCalories = (item: MealItem): number => {
        const { nutrition } = calculateMealItemNutrition(item, recipes, foodItems, quickMeals);
        return Math.round(nutrition.calories);
    };

    const getItemBrand = (item: MealItem): string | undefined => {
        if (item.type === 'foodItem') {
            const food = getFoodItem(item.referenceId);
            return food?.brand;
        }
        return undefined;
    };

    const getItemNutrition = (item: MealItem) => {
        const { nutrition } = calculateMealItemNutrition(item, recipes, foodItems, quickMeals);
        return {
            calories: Math.round(nutrition.calories),
            protein: Math.round(nutrition.protein),
            carbs: Math.round(nutrition.carbs),
            fat: Math.round(nutrition.fat)
        };
    };

    const isToday = selectedDate === getISODate();

    const plannedMeals = useMemo(
        () => getPlannedMealsForDate(selectedDate),
        [getPlannedMealsForDate, selectedDate]
    );

    const unloggedPlannedMeals = useMemo(() => {
        return plannedMeals.filter((pm: { mealType: MealType, meal: PlannedMeal }) => {
            const alreadyLogged = dailyEntries.some((entry: MealEntry) =>
                entry.mealType === pm.mealType &&
                entry.items.some((item: MealItem) => item.referenceId === pm.meal.recipeId)
            );
            return !alreadyLogged;
        });
    }, [plannedMeals, dailyEntries]);

    const handleLogPlannedMeal = (mType: MealType, recipeId: string) => {
        addMealEntry({
            date: selectedDate,
            mealType: mType,
            items: [{
                type: 'recipe',
                referenceId: recipeId,
                servings: 1,
            }],
        });
    };

    const handleLogAllPlanned = () => {
        unloggedPlannedMeals.forEach((pm: { mealType: MealType, meal: PlannedMeal }) => {
            handleLogPlannedMeal(pm.mealType, pm.meal.recipeId!);
        });
    };

    const handleCreateQuickMeal = () => {
        if (selectedIds.size === 0) return;

        const itemsToSave: MealItem[] = [];
        dailyEntries.forEach(entry => {
            if (selectedIds.has(entry.id)) {
                itemsToSave.push(...entry.items);
            }
        });

        setQuickMealItems(itemsToSave);
        setIsQuickMealModalOpen(true);
    };

    const onSaveQuickMeal = (name: string) => {
        const newMeal = addQuickMeal(name, quickMealItems);

        // Grouping logic requested: 
        // 1. Delete the manual entries that were just used to create the snabbval
        // 2. Log a NEW single entry using that snabbval so they are merged
        selectedIds.forEach(id => deleteMealEntry(id));

        addMealEntry({
            date: selectedDate,
            mealType, // Inherit the current meal type
            items: newMeal.items,
            title: newMeal.name,
            snabbvalId: newMeal.id,
            pieces: 1
        } as any);

        setIsQuickMealModalOpen(false);
        setSelectedIds(new Set());
    };

    const handleLogQuickMeal = (qm: QuickMeal, pieceCount?: number) => {
        addMealEntry({
            date: selectedDate,
            mealType,
            items: qm.items, // Keep original item quantities
            title: qm.name,
            snabbvalId: qm.id, // Track which snabbval this came from
            pieces: pieceCount || 1 // Store the count
        } as any);
        setIsFormOpen(false);
        // Track the first item of the quick meal as the last added for suggestions
        if (qm.items.length > 0) {
            const first = qm.items[0];
            if (first.type === 'recipe' || first.type === 'foodItem') {
                setLastAddedId({ type: first.type, id: first.referenceId });
            }
        }
    };

    const handleSaveEstimate = (details: any) => {
        console.log('[CaloriesPage] handleSaveEstimate', details);
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
            console.error('[CaloriesPage] Failed to save estimate:', err);
        }
    };


    const goals = useMemo(() => {
        const periodTarget = getActiveCalories(
            selectedDate,
            trainingPeriods,
            performanceGoals,
            settings.dailyCalorieGoal,
            2000
        );

        return calculateAdaptiveGoals(settings as any, dailyExercises, periodTarget);
    }, [settings, dailyExercises, trainingPeriods, selectedDate, performanceGoals]);

    return (
        <div className="calories-page">
            {/* Sticky Date Header - always visible when scrolling */}
            <div className={`fixed top-16 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm py-2 transition-all`}>
                <div className="max-w-3xl mx-auto px-4 flex items-center justify-center gap-4">
                    <button
                        onClick={() => changeDate(-1)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div
                        onClick={() => setSelectedDate(getISODate())}
                        className={`flex flex-col items-center cursor-pointer px-4 py-1 rounded-md transition-all ${!isToday
                            ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
                            : ''
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={14} className="text-slate-400" />
                            <span className={`font-bold text-sm ${!isToday ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                {isToday ? 'Idag' : selectedDate === getISODate(new Date(Date.now() - 86400000)) ? 'Igår' : new Date(selectedDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                            </span>
                            {!isToday && <span className="text-[10px] text-amber-600/70 dark:text-amber-400/50">←</span>}
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider opacity-60">
                            {new Date(selectedDate).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>
                    <button
                        onClick={() => changeDate(1)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <ChevronRight size={18} />
                    </button>

                    {/* Compact Incomplete Day Toggle */}
                    <button
                        onClick={() => toggleIncompleteDay(selectedDate)}
                        className={`text-[9px] font-black px-2 py-1 rounded border transition-all ${currentVitals.incomplete
                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                            : 'bg-slate-800/20 border-white/5 text-slate-500 hover:text-white'
                            }`}
                        title={currentVitals.incomplete ? 'Dagen är markerad som inkomplett' : 'Markera dag som inkomplett'}
                    >
                        {currentVitals.incomplete ? '⚠️ INKOMPLETT' : 'MARKERA INKOMPLETT'}
                    </button>

                    {/* View Mode Toggle - Right side */}
                    <div className="absolute right-4 flex items-center gap-1 p-1 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'compact' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            onClick={() => { setViewMode('compact'); localStorage.setItem('calories_view_mode', 'compact'); }}
                            title="Hotkeys: V"
                        >
                            📊 Tiny
                        </button>
                        <button
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'normal' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            onClick={() => { setViewMode('normal'); localStorage.setItem('calories_view_mode', 'normal'); }}
                            title="Hotkeys: V"
                        >
                            📋 Detalj
                        </button>
                    </div>
                </div>
            </div>



            {unloggedPlannedMeals.length > 0 && (
                <div className="planned-meals-banner">
                    <div className="banner-content">
                        <span className="banner-icon">📅</span>
                        <div className="banner-text">
                            <strong>{unloggedPlannedMeals.length} planerade måltid{unloggedPlannedMeals.length > 1 ? 'er' : ''}</strong>
                            <span className="banner-subtitle">
                                {unloggedPlannedMeals.map((pm: { mealType: MealType, meal: PlannedMeal }) => {
                                    const recipe = recipes.find(r => r.id === pm.meal.recipeId);
                                    return recipe?.name || 'Okänt recept';
                                }).join(', ')}
                            </span>
                        </div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleLogAllPlanned}>
                        ✓ Logga alla
                    </button>
                </div>
            )}



            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mx-4 mb-2">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="flex flex-col items-center justify-center p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                            <span className="text-[10px] font-black uppercase text-emerald-500 mb-1">Intag</span>
                            <span className="text-2xl font-black text-white">{Math.round(dailyNutrition.calories)}</span>
                            <span className="text-[9px] text-slate-500 font-bold">kcal</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                            <span className="text-[10px] font-black uppercase text-amber-500 mb-1">Träning</span>
                            <span className="text-2xl font-black text-white">+{Math.round(burned)}</span>
                            <span className="text-[9px] text-slate-500 font-bold">kcal</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                            <span className="text-[10px] font-black uppercase text-indigo-400 mb-1">Balans</span>
                            <div className="flex items-center gap-1">
                                <span className={`text-2xl font-black ${dailyNutrition.calories > maintenance ? 'text-rose-400' : 'text-indigo-300'}`}>
                                    {Math.round(maintenance - dailyNutrition.calories)}
                                </span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold">kcal kvar</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-8 mt-8">
                        <div className="shrink-0">
                            <CalorieRing
                                calories={dailyNutrition.calories}
                                calorieGoal={goals.calories}
                                protein={dailyNutrition.protein}
                                proteinGoal={goals.protein}
                                size="lg"
                            />
                        </div>
                        <div className="flex-1 w-full border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-6 sm:pt-0 sm:pl-8">
                            <MacroBars
                                calories={dailyNutrition.calories}
                                calorieGoal={goals.calories}
                                protein={dailyNutrition.protein}
                                proteinGoal={goals.protein}
                                carbs={dailyNutrition.carbs}
                                carbsGoal={goals.carbs || 250}
                                fat={dailyNutrition.fat}
                                fatGoal={goals.fat || 80}
                                size="md"
                            />

                            {/* Integrated Vitals */}
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2">
                                <div
                                    className="flex flex-col items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors p-2"
                                    onClick={() => handleCardClick('water', currentVitals.water || 0)}
                                >
                                    <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Vatten</span>
                                    <div className="flex items-center gap-1.5 min-h-[1.5rem]">
                                        {editing === 'water' ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                value={tempValue}
                                                onChange={(e) => setTempValue(e.target.value)}
                                                onBlur={() => handleSave('water')}
                                                onKeyDown={(e) => handleKeyDown(e, 'water')}
                                                onClick={e => e.stopPropagation()}
                                                className="bg-slate-100 dark:bg-slate-800 border-none rounded text-center font-bold text-slate-900 dark:text-white w-10 text-xs focus:ring-1 focus:ring-emerald-500"
                                            />
                                        ) : (
                                            <>
                                                <span className="text-sm">💧</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-white">{currentVitals.water || 0}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div
                                    className="flex flex-col items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors p-2"
                                    onClick={() => handleCardClick('caffeine', currentVitals.caffeine || 0)}
                                >
                                    <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Koffein</span>
                                    <div className="flex items-center gap-1.5 min-h-[1.5rem]">
                                        {editing === 'caffeine' ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                value={tempValue}
                                                onChange={(e) => setTempValue(e.target.value)}
                                                onBlur={() => handleSave('caffeine')}
                                                onKeyDown={(e) => handleKeyDown(e, 'caffeine')}
                                                onClick={e => e.stopPropagation()}
                                                className="bg-slate-100 dark:bg-slate-800 border-none rounded text-center font-bold text-slate-900 dark:text-white w-10 text-xs focus:ring-1 focus:ring-emerald-500"
                                            />
                                        ) : (
                                            <>
                                                <span className="text-sm">☕</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-white">{currentVitals.caffeine || 0}<span className="text-[8px] text-slate-400 ml-0.5 font-normal">mg</span></span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div
                                    className="flex flex-col items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors p-2"
                                    onClick={() => handleCardClick('alcohol', currentVitals.alcohol || 0)}
                                >
                                    <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Alkohol</span>
                                    <div className="flex items-center gap-1.5 min-h-[1.5rem]">
                                        {editing === 'alcohol' ? (
                                            <input
                                                autoFocus
                                                type="number"
                                                value={tempValue}
                                                onChange={(e) => setTempValue(e.target.value)}
                                                onBlur={() => handleSave('alcohol')}
                                                onKeyDown={(e) => handleKeyDown(e, 'alcohol')}
                                                onClick={e => e.stopPropagation()}
                                                className="bg-slate-100 dark:bg-slate-800 border-none rounded text-center font-bold text-slate-900 dark:text-white w-10 text-xs focus:ring-1 focus:ring-emerald-500"
                                            />
                                        ) : (
                                            <>
                                                <span className="text-sm">🍷</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-white">{currentVitals.alcohol || 0}<span className="text-[8px] text-slate-400 ml-0.5 font-normal">e</span></span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4">
                    <MacroDistribution
                        entries={dailyEntries}
                        foodItems={foodItems}
                        recipes={recipes}
                        isAdapted={goals.isAdapted}
                        extraCalories={goals.extraCalories}
                    />

                </div>
            </div>


            <MealTimeline
                viewMode={viewMode}
                dailyEntries={dailyEntries}
                entriesByMeal={entriesByMeal}
                getItemName={getItemName}
                getItemCalories={getItemCalories}
                getItemBrand={getItemBrand}
                getItemNutrition={getItemNutrition}
                updateMealEntry={updateMealEntry}
                handleDeleteEntry={handleDeleteEntry}
                setIsFormOpen={setIsFormOpen}
                setMealType={setMealType}
                setBreakdownItem={setBreakdownItem}
                onReplaceItem={(item, entryId) => {
                    setMealType(dailyEntries.find(e => e.id === entryId)?.mealType || 'snack');
                    setIsFormOpen(true);
                }}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onDeleteSelected={handleDeleteSelected}
                onCreateQuickMeal={handleCreateQuickMeal}
            />

            {dailyExercises.length > 0 && (
                <section className="mx-4 mb-8">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <Activity size={18} className="text-emerald-500" />
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Dagens Träningspass</h3>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-white/5">
                            {dailyExercises.length} {dailyExercises.length === 1 ? 'PASS' : 'PASS'} UTFÖRDA
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dailyExercises.map((ex) => {
                            const isCycling = ex.type === 'cycling';
                            const isRunning = ex.type === 'running' || ex.type === 'walking';
                            const isStrength = ex.type === 'strength';
                            
                            const distance = (ex as any).distanceKm || (ex as any).distance || 0;
                            const pace = distance > 0 ? (ex.durationMinutes / distance).toFixed(2).replace('.', ':') : null;
                            const watts = (ex as any).averageWatts || (ex as any).watts || 0;
                            const hr = (ex as any).heartRateAvg || (ex as any).hr || 0;

                            return (
                                <div key={ex.id} className="group relative">
                                    <Link
                                        to={`/logg?id=${ex.id}`}
                                        className="block p-3 bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 rounded-2xl transition-all hover:bg-slate-900/90 shadow-sm active:scale-[0.98]"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/5 shadow-inner ${
                                                isRunning ? 'bg-indigo-500/10 text-indigo-400' :
                                                isCycling ? 'bg-amber-500/10 text-amber-500' :
                                                isStrength ? 'bg-purple-500/10 text-purple-400' :
                                                'bg-slate-700/10 text-slate-400'
                                            }`}>
                                                {isRunning ? <Activity size={20} /> : 
                                                 isCycling ? <Zap size={20} /> : 
                                                 isStrength ? <Dumbbell size={20} /> : 
                                                 <Timer size={20} />}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-base font-black text-rose-400 leading-none">-{ex.caloriesBurned}</div>
                                                <div className="text-[8px] font-black text-rose-500/40 uppercase tracking-tighter mt-0.5">kcal</div>
                                            </div>
                                        </div>

                                        <div className="mb-2">
                                            <h4 className="text-xs font-black text-slate-100 uppercase tracking-wide truncate">
                                                {ex.title || (
                                                    ex.type === 'running' ? 'Löpning' :
                                                    ex.type === 'cycling' ? 'Cykling' :
                                                    ex.type === 'strength' ? 'Styrka' :
                                                    ex.type === 'walking' ? 'Promenad' :
                                                    ex.type === 'swimming' ? 'Simning' :
                                                    ex.type === 'yoga' ? 'Yoga' : 'Träningspass'
                                                )}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{formatActivityDuration(ex.durationMinutes)}</span>
                                                <span className="w-1 h-1 bg-slate-800 rounded-full"></span>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{ex.intensity}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-2 border-t border-slate-800/50">
                                            {distance > 0 && (
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Navigation size={8} className="text-slate-600 shrink-0" />
                                                    <span className="text-[9px] font-black text-emerald-400 truncate">{distance.toFixed(1)}km</span>
                                                </div>
                                            )}
                                            {pace && (
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Timer size={8} className="text-slate-600 shrink-0" />
                                                    <span className="text-[9px] font-black text-indigo-400 truncate">{pace}/k</span>
                                                </div>
                                            )}
                                            {watts > 0 && (
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Zap size={8} className="text-slate-600 shrink-0" />
                                                    <span className="text-[9px] font-black text-amber-500 truncate">{Math.round(watts)}w</span>
                                                </div>
                                            )}
                                            {hr > 0 && (
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Heart size={8} className="text-slate-600 shrink-0" />
                                                    <span className="text-[9px] font-black text-rose-500/80 truncate">{Math.round(hr)}b</span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    {((ex as any).source === 'manual' || (ex as any).source === 'strength') && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm('Vill du ta bort denna aktivitet?')) {
                                                    deleteExercise(ex.id);
                                                }
                                            }}
                                            className="absolute -top-1 -right-1 w-6 h-6 bg-slate-800 text-slate-500 hover:text-rose-400 border border-slate-700 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-xl"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <QuickAddModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                mealType={mealType}
                setMealType={setMealType}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                proposals={proposals}
                quickAddServings={quickAddServings}
                setQuickAddServings={setQuickAddServings}
                handleQuickAdd={handleQuickAdd}
                selectedDate={selectedDate}
                quickMeals={quickMeals}
                onLogQuickMeal={handleLogQuickMeal}
                getItemName={getItemName}
                getItemNutrition={getItemNutrition}
                recommendations={recommendations}
                lastAddedItemName={lastAddedId ? (lastAddedId.type === 'foodItem' ? foodItems.find(f => f.id === lastAddedId.id)?.name : recipes.find(r => r.id === lastAddedId.id)?.name) : undefined}
            />

            <CreateQuickMealModal
                isOpen={isQuickMealModalOpen}
                onClose={() => setIsQuickMealModalOpen(false)}
                onSave={onSaveQuickMeal}
                items={quickMealItems}
                getItemName={getItemName}
                getItemNutrition={getItemNutrition}
                recentQuickMeals={quickMeals}
            />

            <NutritionBreakdownModal
                item={breakdownItem}
                onClose={() => setBreakdownItem(null)}
                recipes={recipes}
                foodItems={foodItems}
                getFoodItem={getFoodItem}
            />

            <section className="mx-4 mt-12 mb-8">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Utveckling & Trender</h3>
                </div>
                <NutritionInsights onDateSelect={setSelectedDate} />
            </section>

            <div className="fixed bottom-6 right-6 flex flex-col gap-3">
                <button
                    className="w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
                    onClick={() => setIsEstimateModalOpen(true)}
                    title="Estimera lunch/middag 🤷"
                >
                    🤷
                </button>
                <button
                    className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
                    onClick={() => setIsFormOpen(true)}
                    title="Logga måltid"
                >
                    +
                </button>
            </div>

            <EstimateLunchModal
                isOpen={isEstimateModalOpen}
                onClose={() => setIsEstimateModalOpen(false)}
                onSave={handleSaveEstimate}
            />
        </div>
    );
}

export default CaloriesPage;
