
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useAnalytics } from '../context/AnalyticsContext.tsx';
import { parseOmniboxInput } from '../utils/nlpParser.ts';
import { performSmartSearch } from '../utils/searchUtils.ts';
import {
    ExerciseType,
    ExerciseIntensity,
    FoodItem,
    MealType,
    BodyMeasurementType,
    QuickMeal,
    Recipe,
    MealItem,
    PlannedActivity,
} from '../models/types.ts';
import {
    Search,
    Dumbbell,
    Moon,
    Droplets,
    Coffee,
    Zap,
    Flame,
    ArrowRight,
    MapPin,
    Heart,
    Info,
    Calculator,
    Calendar
} from 'lucide-react';
import { NutritionLabel } from './shared/NutritionLabel.tsx';

import { 
    isSavedEstimate, 
    NAVIGATION_ROUTES, 
    EXERCISE_TYPES, 
    INTENSITIES, 
    VITALS_INFO, 
    ACTION_COMMANDS, 
    MEASUREMENT_INFO, 
    getCategoryEmoji, 
    DEFAULT_YIELD_FACTORS, 
    canLogAsCooked, 
    getSavedMealTypePreference, 
    saveMealTypePreference 
} from './omnibox/OmniboxConstants.ts';

import { LockedFoodModule } from './omnibox/modules/LockedFoodModule.tsx';
import { LockedQuickMealModule } from './omnibox/modules/LockedQuickMealModule.tsx';
import { PlanningModule } from './omnibox/modules/PlanningModule.tsx';
import { ExerciseModule } from './omnibox/modules/ExerciseModule.tsx';
import { MeasurementModule } from './omnibox/modules/MeasurementModule.tsx';
import { VitalsModule } from './omnibox/modules/VitalsModule.tsx';
import { WeightModule } from './omnibox/modules/WeightModule.tsx';
import { UserResultsModule } from './omnibox/modules/UserResultsModule.tsx';
import { EmptyStateModule } from './omnibox/modules/EmptyStateModule.tsx';
import { MixedSearchResultsModule } from './omnibox/modules/MixedSearchResultsModule.tsx';
import { NavSuggestionsModule } from './omnibox/modules/NavSuggestionsModule.tsx';
import { ActionSuggestionsModule } from './omnibox/modules/ActionSuggestionsModule.tsx';
import { LockedRecipeModule } from './omnibox/modules/LockedRecipeModule.tsx';
import { PurchaseModule } from './omnibox/modules/PurchaseModule.tsx';

export interface OmniboxProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenTraining?: (defaults: { type?: ExerciseType; input?: string }) => void;
    onOpenNutrition?: (item: { type: 'recipe' | 'foodItem' | 'estimate'; referenceId: string; servings: number; estimateDetails?: any }) => void;
    onCreatePost?: () => void;
    onOpenEstimate?: () => void;
}

export function Omnibox({ isOpen, onClose, onOpenTraining, onOpenNutrition, onCreatePost, onOpenEstimate }: OmniboxProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [input, setInput] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hoveredResultId, setHoveredResultId] = useState<string | null>(null);
    const [hoveredIngredientIdx, setHoveredIngredientIdx] = useState<number | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const {
        addWeightEntry,
        updateVitals,
        getVitalsForDate,
        foodItems,
        recipes,
        addMealEntry,
        updateMealEntry,
        mealEntries,
        addExercise,
        calculateExerciseCalories,
        users,
        addBodyMeasurement,
        selectedDate,
        quickMeals,
        addQuickMeal,
        calculateRecipeNutrition,
        savePlannedActivities,
        addPurchaseLog
    } = useData();
    const { logEvent, visitStats } = useAnalytics();


    const intent = parseOmniboxInput(input);
    const [showFeedback, setShowFeedback] = useState(false);

    // Draft states for exercise/vitals refinement
    const [draftType, setDraftType] = useState<ExerciseType | null>(null);
    const [draftDuration, setDraftDuration] = useState<number | null>(null);
    const [draftIntensity, setDraftIntensity] = useState<ExerciseIntensity | null>(null);
    const [draftVitalAmount, setDraftVitalAmount] = useState<number | null>(null);
    const [isManual, setIsManual] = useState(false);

    // Locked food state - when a food is matched with high confidence
    // Locked food state - when a food is matched with high confidence
    const [lastLoggedItem, setLastLoggedItem] = useState<{ name: string; brand?: string; id: string; calories: number; quantity: number; date: string; type: 'foodItem' | 'quickMeal' } | null>(null);
    const [lockedFood, setLockedFood] = useState<(FoodItem & { usageStats?: { count: number; lastUsed: string; avgGrams: number } }) | null>(null);
    const [draftFoodQuantity, setDraftFoodQuantity] = useState<number | null>(null);
    const [draftFoodMealType, setDraftFoodMealType] = useState<MealType | null>(null);
    const [draftFoodDate, setDraftFoodDate] = useState<string | null>(null);

    const [lockedQuickMeal, setLockedQuickMeal] = useState<(QuickMeal & { totals?: { calories: number, protein: number, carbs: number, fat: number }, summary?: string, itemType?: 'quickMeal' | 'savedEstimate' }) | null>(null);
    const [lockedRecipe, setLockedRecipe] = useState<(Recipe & { totals?: { calories: number, protein: number, carbs: number, fat: number }, summary?: string }) | null>(null);
    const [draftQuickMealMealType, setDraftQuickMealMealType] = useState<MealType | null>(null);
    const [draftQuickMealDate, setDraftQuickMealDate] = useState<string | null>(null);
    const [draftRecipeMealType, setDraftRecipeMealType] = useState<MealType | null>(null);
    const [draftRecipeDate, setDraftRecipeDate] = useState<string | null>(null);
    const [draftRecipeServings, setDraftRecipeServings] = useState<number>(1);

    // Measurement drafts
    const [draftMeasurementType, setDraftMeasurementType] = useState<BodyMeasurementType | null>(null);
    const [draftMeasurementValue, setDraftMeasurementValue] = useState<number | null>(null);
    const [draftMeasurementDate, setDraftMeasurementDate] = useState<string | null>(null);

    // Cooked toggle state for raw ingredients
    const [draftLogAsCooked, setDraftLogAsCooked] = useState(false);

    // Purchase Specific State
    const [lockedPurchaseFood, setLockedPurchaseFood] = useState<FoodItem | null>(null);

    // UX Friction Tracking: Timestamp when opened
    const [openTimestamp, setOpenTimestamp] = useState<number | null>(null);

    // System Action Usage Tracking
    const [actionUsage, setActionUsage] = useState<Record<string, number>>(() => {
        try {
            const saved = localStorage.getItem('system_action_usage');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const trackActionUsage = (actionId: string) => {
        const newUsage = { ...actionUsage, [actionId]: (actionUsage[actionId] || 0) + 1 };
        setActionUsage(newUsage);
        localStorage.setItem('system_action_usage', JSON.stringify(newUsage));
    };

    // Sync draft from intent
    useEffect(() => {
        if (!isManual && intent.type === 'exercise') {
            setDraftType(intent.data.exerciseType || null);
            setDraftDuration(intent.data.duration || null);
            setDraftIntensity(intent.data.intensity || null);
        }
        if (!isManual && intent.type === 'vitals') {
            setDraftVitalAmount(intent.data.amount || null);
        }
        // Sync food drafts from intent - only sync quantity if explicitly parsed (not default 100g)
        if (intent.type === 'food' && (lockedFood || lockedRecipe || lockedQuickMeal)) {
            const foodData = intent.data;
            const hasExplicitQuantity = !!(foodData.quantity &&
                (foodData.quantity !== 100 || (foodData.unit && foodData.unit !== 'g')));
            if (hasExplicitQuantity && typeof foodData.quantity === 'number') {
                setDraftFoodQuantity(foodData.quantity);
            }
            if (foodData.mealType) setDraftFoodMealType(foodData.mealType as MealType);
            if (intent.date) setDraftFoodDate(intent.date);

            // Sync servings if it's a recipe or quick meal
            if (foodData.quantity && (foodData.unit === 'portion' || foodData.unit === 'st')) {
                setDraftRecipeServings(foodData.quantity);
            }

            // Auto-detect "kokt" in input text
            if (lockedFood && input.toLowerCase().includes('kokt')) {
                const { canCook } = canLogAsCooked(lockedFood);
                if (canCook) {
                    setDraftLogAsCooked(true);
                }
            }
        }


        if (!isManual && intent.type === 'measurement') {
            if (intent.data.measurementType) setDraftMeasurementType(intent.data.measurementType);
            setDraftMeasurementValue(intent.data.value ?? null);
            setDraftMeasurementDate(intent.date || null);
        }
    }, [intent, isManual, lockedFood, lockedRecipe, lockedQuickMeal, input]);

    // Reset drafts when input clears
    // Note: Do NOT reset lockedFood/lockedQuickMeal/lockedRecipe here!
    // The lock functions intentionally clear input after locking, so resetting
    // locked states here would immediately undo the lock.
    useEffect(() => {
        if (!input) {
            setIsManual(false);
            setDraftType(null);
            setDraftDuration(null);
            setDraftIntensity(null);
            setDraftVitalAmount(null);
            setDraftMeasurementType(null);
            setDraftMeasurementValue(null);
            setDraftMeasurementDate(null);
            setDraftLogAsCooked(false);
        }
    }, [input]);

    // Detect modes
    const isSlashMode = input.startsWith('/');
    const isActionMode = input.startsWith('!');
    const slashQuery = isSlashMode ? input.slice(1).toLowerCase() : '';
    const actionQuery = isActionMode ? input.slice(1).toLowerCase().trim() : '';

    // Action suggestions
    const actionSuggestions = useMemo(() => {
        if (!isActionMode) return [];
        
        let filtered = ACTION_COMMANDS;
        if (actionQuery) {
            filtered = ACTION_COMMANDS.filter(action =>
                action.command.toLowerCase().includes(input.toLowerCase()) ||
                action.label.toLowerCase().includes(actionQuery)
            );
        }
        
        // Sort by usage count
        return [...filtered].sort((a, b) => (actionUsage[b.id] || 0) - (actionUsage[a.id] || 0));
    }, [isActionMode, actionQuery, input, actionUsage]);


    // Navigation suggestions for slash mode
    const navSuggestions = useMemo(() => {
        if (!isSlashMode) return [];

        const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
        const text = slashQuery.trim();
        const dateSuggestions: any[] = [];

        if (text) {
            // 1. Check ISO: YYYY-MM-DD or YYYY-MM
            const isoMatch = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
            if (isoMatch) {
                const year = isoMatch[1];
                const monthIdx = parseInt(isoMatch[2], 10) - 1;
                const day = isoMatch[3];
                if (monthIdx >= 0 && monthIdx < 12) {
                    const mName = months[monthIdx];
                    if (day) {
                        dateSuggestions.push({
                            path: `/träning/kalender/${year}/${mName}/${parseInt(day, 10)}`,
                            label: `📅 Gå till ${parseInt(day, 10)} ${mName} ${year}`,
                            aliases: []
                        });
                    } else {
                        dateSuggestions.push({
                            path: `/träning/kalender/${year}/${mName}`,
                            label: `📅 Gå till ${mName.toUpperCase()} ${year}`,
                            aliases: []
                        });
                    }
                }
            }

            // 2. Year Match + Month Name Match
            const yearMatch = text.match(/\b(\d{4})\b/);
            const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

            let matchedMonth: string | undefined;
            let mIndex = -1;
            for (let i = 0; i < months.length; i++) {
                if (text.includes(months[i]) || (text.length >= 3 && text.includes(months[i].slice(0, 3)))) {
                    matchedMonth = months[i];
                    mIndex = i;
                    break;
                }
            }

            const textWithoutYear = text.replace(year, '').trim();
            const dayMatch = textWithoutYear.match(/\b([1-9]|[12]\d|3[01])\b/);
            const day = dayMatch ? dayMatch[1] : undefined;

            if (matchedMonth) {
                if (day) {
                    dateSuggestions.push({
                        path: `/träning/kalender/${year}/${matchedMonth}/${parseInt(day, 10)}`,
                        label: `📅 Gå till ${day} ${matchedMonth} ${year}`,
                        aliases: []
                    });
                } else {
                    dateSuggestions.push({
                        path: `/träning/kalender/${year}/${matchedMonth}`,
                        label: `📅 Gå till ${matchedMonth.toUpperCase()} ${year}`,
                        aliases: []
                    });
                }
            }

            // 3. Just a Year
            if (/^\d{4}$/.test(text)) {
                dateSuggestions.push({
                    path: `/träning/kalender/${text}/januari`,
                    label: `📅 Gå till år ${text}`,
                    aliases: []
                });
            }
        }

        const baseNavs = NAVIGATION_ROUTES.filter(route =>
            route.path.toLowerCase().includes(slashQuery) ||
            route.label.toLowerCase().includes(slashQuery) ||
            route.aliases.some(alias => alias.toLowerCase().includes(slashQuery))
        );

        const base = [...dateSuggestions, ...baseNavs];

        const currentPath = location.pathname;
        const currentContextStats = visitStats.contextualNavs?.[currentPath] || {};

        // Sort by:
        // 1. Contextual visits (from current page via omnibox)
        // 2. Global omnibox usage
        // 3. Global page views
        return base.map(route => {
            const contextCount = currentContextStats[route.path] || 0;
            const globalOmniCount = visitStats.omniboxNavs[route.path] || 0;
            const globalTotalCount = visitStats.paths[route.path] || 0;

            return {
                ...route,
                // Pass down reasoning for UI
                sortReason: contextCount > 0
                    ? `${contextCount} ggr härifrån`
                    : globalOmniCount > 0 
                        ? `${globalOmniCount} besök via omnibox`
                        : null,
                contextCount,
                globalOmniCount,
                globalTotalCount
            };
        }).sort((a, b) => {
            if (b.contextCount !== a.contextCount) return b.contextCount - a.contextCount;
            if (b.globalOmniCount !== a.globalOmniCount) return b.globalOmniCount - a.globalOmniCount;
            return b.globalTotalCount - a.globalTotalCount;
        });
    }, [isSlashMode, slashQuery, visitStats, location.pathname]);

    // Calculate snabbval usage stats from meal entries
    const snabbvalUsageStats = useMemo(() => {
        const stats: Record<string, { count: number; lastUsed: string }> = {};

        mealEntries.forEach(entry => {
            if (entry.snabbvalId) {
                if (!stats[entry.snabbvalId]) {
                    stats[entry.snabbvalId] = { count: 0, lastUsed: entry.date };
                }
                stats[entry.snabbvalId].count += (entry.pieces || 1);
                if (entry.date > stats[entry.snabbvalId].lastUsed) {
                    stats[entry.snabbvalId].lastUsed = entry.date;
                }
            }
        });

        return stats;
    }, [mealEntries]);

    // Calculate recipe usage stats from meal entries
    const recipeUsageStats = useMemo(() => {
        const stats: Record<string, { count: number; lastUsed: string }> = {};

        mealEntries.forEach(entry => {
            entry.items.forEach(item => {
                if (item.type === 'recipe') {
                    if (!stats[item.referenceId]) {
                        stats[item.referenceId] = { count: 0, lastUsed: entry.date };
                    }
                    stats[item.referenceId].count++;
                    if (entry.date > stats[item.referenceId].lastUsed) {
                        stats[item.referenceId].lastUsed = entry.date;
                    }
                }
            });
        });

        return stats;
    }, [mealEntries]);

    // Calculate food usage stats from meal entries
    const foodUsageStats = useMemo(() => {
        const stats: Record<string, { count: number; lastUsed: string; totalGrams: number; avgGrams: number }> = {};

        mealEntries.forEach(entry => {
            entry.items.forEach(item => {
                if (item.type === 'foodItem') {
                    const grams = item.servings || 100; // servings is grams in this app
                    if (!stats[item.referenceId]) {
                        stats[item.referenceId] = { count: 0, lastUsed: entry.date, totalGrams: 0, avgGrams: 100 };
                    }
                    stats[item.referenceId].count++;
                    stats[item.referenceId].totalGrams += grams;
                    stats[item.referenceId].avgGrams = stats[item.referenceId].totalGrams / stats[item.referenceId].count;
                    if (entry.date > stats[item.referenceId].lastUsed) {
                        stats[item.referenceId].lastUsed = entry.date;
                    }
                }
            });
        });

        return stats;
    }, [mealEntries]);

    // Recent foods (from meal entries)
    const recentFoods = useMemo(() => {
        const usedFoodIds = new Set<string>();
        const recents: Array<FoodItem & { usageStats: { count: number; lastUsed: string; avgGrams: number } }> = [];

        const sortedEntries = [...mealEntries].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
            return timeB - timeA;
        });

        for (const entry of sortedEntries) {
            for (const item of entry.items) {
                if (item.type === 'foodItem' && !usedFoodIds.has(item.referenceId)) {
                    const foodItem = foodItems.find(f => f.id === item.referenceId);
                    if (foodItem && foodUsageStats[item.referenceId]) {
                        usedFoodIds.add(item.referenceId);
                        recents.push({
                            ...foodItem,
                            usageStats: {
                                count: foodUsageStats[item.referenceId].count,
                                lastUsed: foodUsageStats[item.referenceId].lastUsed,
                                avgGrams: foodUsageStats[item.referenceId].avgGrams
                            }
                        });
                    }
                }
                if (recents.length >= 5) break;
            }
            if (recents.length >= 5) break;
        }

        return recents;
    }, [mealEntries, foodItems, foodUsageStats]);

    // Popular foods for the current meal type
    const popularFoods = useMemo(() => {
        const lowerInput = input.trim().toLowerCase();
        const MEAL_KEYWORDS: Record<string, MealType> = {
            'frukost': 'breakfast',
            'lunch': 'lunch',
            'middag': 'dinner',
            'mellanmål': 'snack',
            'snack': 'snack'
        };
        
        const hour = new Date().getHours();
        let mealType: MealType = MEAL_KEYWORDS[lowerInput] || 'snack';
        
        if (!MEAL_KEYWORDS[lowerInput]) {
            if (hour >= 5 && hour < 10) mealType = 'breakfast';
            else if (hour >= 10 && hour < 14) mealType = 'lunch';
            else if (hour >= 17 && hour < 21) mealType = 'dinner';
        }

        const counts: Record<string, number> = {};
        const recentIds = new Set(recentFoods.map(f => f.id));
        
        mealEntries.forEach(entry => {
            if (entry.mealType === mealType) {
                entry.items.forEach(item => {
                    if (item.type === 'foodItem') {
                        counts[item.referenceId] = (counts[item.referenceId] || 0) + 1;
                    }
                });
            }
        });

        return Object.entries(counts)
            .filter(([id]) => !recentIds.has(id)) // Deduplicate against recent
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => {
                const foodItem = foodItems.find(f => f.id === id);
                return foodItem ? {
                    ...foodItem,
                    usageStats: foodUsageStats[id]
                } : null;
            })
            .filter(Boolean) as Array<FoodItem & { usageStats: { count: number; lastUsed: string; avgGrams: number } }>;
    }, [mealEntries, foodItems, foodUsageStats, recentFoods]);

    // Food search results with usage stats
    const foodResults = useMemo(() => {
        // Don't search if we have a locked food
        if (lockedFood) return [];
        if (isSlashMode) return [];
        if (!input.trim() || input.length < 2) return [];
        // Don't show food results for exercise/vitals/weight intents
        if (['exercise', 'vitals', 'weight', 'user'].includes(intent.type)) return [];

        // Use parsed query from intent (cleaner) or fall back to raw input
        const searchQuery = intent.type === 'food' && intent.data.query
            ? intent.data.query
            : input;

        return performSmartSearch(searchQuery, foodItems, {
            textFn: (item) => `${item.name} ${item.brand || ''}`,
            categoryFn: (item) => item.category,
            usageCountFn: (item) => foodUsageStats[item.id]?.count || 0,
            limit: 10,
            includeScore: true
        }).map(r => ({
            ...r.item,
            itemType: 'food' as const,
            usageStats: foodUsageStats[r.item.id] || null,
            searchScore: r.score
        }));
    }, [input, foodItems, foodUsageStats, isSlashMode, intent, lockedFood]);

    const purchaseResults = useMemo(() => {
        if (isSlashMode || lockedPurchaseFood) return [];
        if (intent.type !== 'purchase') return [];
        
        return performSmartSearch(intent.data.query, foodItems, {
            textFn: (item) => `${item.name} ${item.brand || ''}`,
            limit: 5,
            includeScore: true
        }).map(r => ({
            ...r.item,
            itemType: 'purchase_match' as const,
            searchScore: r.score
        }));
    }, [intent, foodItems, isSlashMode, lockedPurchaseFood]);

    // Recipe search results
    const recipeResults = useMemo(() => {
        if (isSlashMode) return [];
        if (!input.trim() || input.length < 2) return [];
        if (['exercise', 'vitals', 'weight', 'user'].includes(intent.type)) return [];

        return performSmartSearch(input, recipes, {
            textFn: (item) => item.name,
            limit: 5,
            includeScore: true
        }).map(r => {
            const nutrition = calculateRecipeNutrition(r.item);
            return {
                ...r.item,
                itemType: 'recipe' as const,
                searchScore: r.score,
                usageStats: recipeUsageStats[r.item.id] || null,
                totals: {
                    calories: Math.round(nutrition.calories / r.item.servings),
                    protein: Math.round((nutrition.protein / r.item.servings) * 10) / 10,
                    carbs: Math.round((nutrition.carbs / r.item.servings) * 10) / 10,
                    fat: Math.round((nutrition.fat / r.item.servings) * 10) / 10
                },
                summary: `${r.item.servings} portioner • ~${Math.round(nutrition.calories / r.item.servings)} kcal per portion`
            };
        });
    }, [input, recipes, foodItems, isSlashMode, intent, recipeUsageStats]);

    // User search results
    const userResults = useMemo(() => {
        if (isSlashMode) return [];
        if (!input.trim() || input.length < 2) return [];
        // Only show if query starts with @ or if no specific intent is found
        const isHandleQuery = input.startsWith('@');
        const query = isHandleQuery ? input.slice(1).toLowerCase() : input.toLowerCase();

        if (!isHandleQuery && ['exercise', 'vitals', 'weight', 'food'].includes(intent.type)) return [];

        return users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            (u.handle || u.username).toLowerCase().includes(query)
        ).slice(0, 4);
    }, [input, users, isSlashMode, intent]);

    // Nutrition helpers for Quick Meals in Omnibox
    const getItemName = (item: any) => {
        if (item.type === 'recipe') return recipes.find(r => r.id === item.referenceId)?.name || 'Recept';
        return foodItems.find(f => f.id === item.referenceId)?.name || 'Livsmedel';
    };

    const getItemNutrition = (item: any) => {
        if (item.type === 'recipe') {
            const r = recipes.find(r => r.id === item.referenceId);
            return r ? calculateRecipeNutrition(r) : { calories: 0, protein: 0, carbs: 0, fat: 0 };
        }
        const f = foodItems.find(f => f.id === item.referenceId);
        if (!f) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const ratio = (item.servings || 100) / 100;
        return {
            calories: f.calories * ratio,
            protein: f.protein * ratio,
            carbs: (f.carbs || 0) * ratio,
            fat: (f.fat || 0) * ratio
        };
    };

    const processItem = (qm: any, type: 'quickMeal' | 'savedEstimate') => {
        const totals = qm.items.reduce((acc: any, item: any) => {
            const n = getItemNutrition(item);
            return {
                calories: acc.calories + n.calories,
                protein: acc.protein + n.protein,
                carbs: acc.carbs + (n.carbs || 0),
                fat: acc.fat + (n.fat || 0)
            };
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

        const summary = qm.items.map((item: any) => {
            const name = getItemName(item);
            const servings = item.type === 'recipe' ? `${item.servings}p` : `${item.servings}g`;
            return `${servings} ${name}`;
        }).join(', ');

        return {
            ...qm,
            itemType: type,
            totals,
            summary,
            usageStats: qm.usageStats || (snabbvalUsageStats && snabbvalUsageStats[qm.id]) || null
        };
    };

    // Quick Meal results
    const { standardQuickMeals, savedEstimates } = useMemo(() => {
        if (isSlashMode) return { standardQuickMeals: [], savedEstimates: [] };
        if (!input.trim() || input.length < 2) return { standardQuickMeals: [], savedEstimates: [] };
        if (['exercise', 'vitals', 'weight', 'user'].includes(intent.type)) return { standardQuickMeals: [], savedEstimates: [] };

        const sourceEstimates = quickMeals.filter(qm => isSavedEstimate(qm));
        const sourceQuickMeals = quickMeals.filter(qm => !isSavedEstimate(qm));

        const standardMatches = performSmartSearch(input, sourceQuickMeals, {
            textFn: (item) => item.name,
            usageCountFn: (item) => snabbvalUsageStats[item.id]?.count || 0,
            limit: 5,
            includeScore: true
        });

        const estimateMatches = performSmartSearch(input, sourceEstimates, {
            textFn: (item) => item.name,
            usageCountFn: (item) => snabbvalUsageStats[item.id]?.count || 0,
            limit: 3,
            includeScore: true
        });

        return {
            standardQuickMeals: standardMatches.map(r => ({ ...processItem(r.item, 'quickMeal'), searchScore: r.score })),
            savedEstimates: estimateMatches.map(r => ({ ...processItem(r.item, 'savedEstimate'), searchScore: r.score }))
        };
    }, [input, quickMeals, isSlashMode, intent, foodItems, recipes, snabbvalUsageStats]);

    // Frequent Meal Combinations suggestions
    const frequentCombos = useMemo(() => {
        if (isSlashMode || isActionMode) return [];
        if (intent.type !== 'food' || !intent.data.mealType) return [];
        if (intent.data.query && intent.data.query.trim().length > 0) return []; // Only when just typing the meal category

        const mealType = intent.data.mealType;
        const comboCounts: Record<string, { count: number; items: MealItem[]; lastUsed: string }> = {};

        mealEntries.forEach(entry => {
            if (entry.mealType !== mealType) return;
            const subItems = entry.items.filter(i => i.type === 'foodItem' || i.type === 'recipe');
            if (subItems.length < 2) return; // Combinations of 2+ items

            // Sort to make order-invariant
            const sortedItems = [...subItems].sort((a, b) => a.referenceId.localeCompare(b.referenceId));
            const key = sortedItems.map(i => i.referenceId).join('|');

            if (!comboCounts[key]) {
                comboCounts[key] = { count: 0, items: sortedItems, lastUsed: entry.date };
            }
            comboCounts[key].count++;
            if (entry.date > comboCounts[key].lastUsed) {
                comboCounts[key].lastUsed = entry.date;
            }
        });

        return Object.entries(comboCounts)
            .filter(([_, data]) => data.count >= 3)
            .map(([key, data]) => {
                const names = data.items.map(i => getItemName(i));
                let name = names.join(' med ');
                if (name.length > 40) name = names.slice(0, 2).join(' med ') + '...';

                const virtualCombo = {
                    id: `combo-${key}`,
                    name: `💡 ${name}`,
                    items: data.items,
                    createdAt: new Date().toISOString(),
                    usageStats: { count: data.count, lastUsed: data.lastUsed }
                };

                return processItem(virtualCombo, 'quickMeal');
            })
            .sort((a, b) => (b.usageStats?.count || 0) - (a.usageStats?.count || 0))
            .slice(0, 3);
    }, [intent, mealEntries, isSlashMode, isActionMode, foodItems, recipes, snabbvalUsageStats]);


    // Auto-lock: Only when there's exactly ONE matching result AND explicit intent
    // OR if there's an exact name match.
    // Don't auto-lock if there are multiple items that could match or if query is too generic.
    useEffect(() => {
        if (lockedFood) return; // Already locked
        if (foodResults.length === 0) return;

        const searchQuery = intent.type === 'food' && intent.data.query
            ? intent.data.query.toLowerCase().trim()
            : input.toLowerCase().trim();

        // Only auto-lock if there's EXACTLY one result
        if (foodResults.length === 1) {
            const item = foodResults[0];

            // Criteria for auto-locking:
            // 1. Explicit quantity/meal/date provided in intent
            const hasExplicitIntent = intent.type === 'food' && (
                intent.data.quantity !== undefined ||
                intent.data.mealType !== undefined ||
                intent.date !== undefined
            );

            // 2. Exact name match (case-insensitive)
            const isExactMatch = item.name.toLowerCase() === searchQuery;

            // 3. Strong match on short query (threshold)
            const isStrongMatch = searchQuery.length >= 4 && item.name.toLowerCase().startsWith(searchQuery);

            if (hasExplicitIntent || isExactMatch) {
                setLockedFood({
                    ...item,
                    usageStats: foodUsageStats[item.id] || undefined
                });
                const stats = foodUsageStats[item.id];
                const foodData = intent.type === 'food' ? intent.data : null;

                // If we have a quantity in intent, use it. 
                // Otherwise use default portion or average.
                let initialQty = 100;
                if (foodData?.quantity) {
                    if (foodData.unit === 'portion' || foodData.unit === 'st') {
                        const portionSize = item.defaultPortionGrams || 100;
                        initialQty = foodData.quantity * portionSize;
                    } else {
                        initialQty = foodData.quantity;
                    }
                } else {
                    initialQty = item.defaultPortionGrams || stats?.avgGrams || 100;
                }

                setDraftFoodQuantity(initialQty);
                setDraftFoodMealType(foodData?.mealType || getSavedMealTypePreference() || null);
                setDraftFoodDate(intent.date || selectedDate || new Date().toISOString().split('T')[0]);
                return;
            }
        }
    }, [foodResults, lockedFood, intent, input, foodUsageStats]);

    // Auto-fill from intent when locked quick meal
    useEffect(() => {
        if (lockedQuickMeal && input.length >= 2) {
            if (intent.type === 'food') {
                if (intent.data.mealType) setDraftQuickMealMealType(intent.data.mealType);
                if (intent.date) setDraftQuickMealDate(intent.date);
            }
        }
    }, [input, lockedQuickMeal, intent]);

    // Combined selectable items for keyboard nav
    const selectableItems = useMemo(() => {
        if (lockedFood || lockedQuickMeal || lockedRecipe || lockedPurchaseFood) return []; // No selection when locked
        if (isSlashMode) return navSuggestions.map(r => ({ itemType: 'nav' as const, ...r }));
        if (isActionMode) return actionSuggestions.map(a => ({ itemType: 'action' as const, ...a }));

        if (intent.type === 'purchase') return purchaseResults;

        const isMealKeyword = ['frukost', 'lunch', 'middag', 'mellanmål', 'snack'].includes(input.trim().toLowerCase());
        const is2ColMode = !input || isMealKeyword;

        const items: any[] = [];
        if (frequentCombos.length > 0) items.push(...frequentCombos.map(c => ({ ...c, searchScore: (c as any).searchScore || 50 })));
        
        // Merge food, recipes, quick meals and estimates and sort by search score
        const mergedResults = [
            ...savedEstimates.map(e => ({ ...e, itemType: 'savedEstimate' as const })),
            ...standardQuickMeals.map(q => ({ ...q, itemType: 'quickMeal' as const })),
            ...recipeResults.map(r => ({ ...r, itemType: 'recipe' as const })),
            ...foodResults.map(f => ({ ...f, itemType: 'food' as const }))
        ].sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));

        items.push(...mergedResults);

        if (userResults.length > 0) items.push(...userResults.map(u => ({ itemType: 'user' as const, ...u })));
        
        if (is2ColMode && recentFoods.length > 0) items.push(...recentFoods.map(f => ({ itemType: 'recent' as const, ...f })));
        if (is2ColMode && popularFoods.length > 0) items.push(...popularFoods.map(f => ({ itemType: 'popular' as const, ...f })));

        return items;
    }, [isSlashMode, isActionMode, navSuggestions, actionSuggestions, foodResults, purchaseResults, userResults, standardQuickMeals, savedEstimates, input, recentFoods, popularFoods, lockedFood, lockedQuickMeal, lockedRecipe, lockedPurchaseFood, frequentCombos, intent.type]);


    // Reset selection when results change or input changes
    useEffect(() => {
        const isMealKeyword = ['frukost', 'lunch', 'middag', 'mellanmål', 'snack'].includes(input.trim().toLowerCase());
        if (isMealKeyword && recentFoods.length > 0) {
            // Default select the first item in the popular (right) column
            setSelectedIndex(recentFoods.length);
        } else {
            setSelectedIndex(0);
        }
    }, [selectableItems.length, input]);

    useEffect(() => {
        if (showFeedback) {
            const timer = setTimeout(() => setShowFeedback(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [showFeedback]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setInput('');
            setOpenTimestamp(Date.now());
        } else if (!isOpen) {
            setOpenTimestamp(null);
            setLockedFood(null);
            setLockedRecipe(null);
            setLockedQuickMeal(null);
            setLockedPurchaseFood(null);
            setDraftFoodQuantity(null);
            setDraftRecipeServings(1);
            setDraftRecipeMealType(null);
            setDraftRecipeDate(null);
            setDraftQuickMealMealType(null);
            setDraftQuickMealDate(null);
            setShowFeedback(false);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (selectableItems.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % selectableItems.length);
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + selectableItems.length) % selectableItems.length);
            }

            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const isMealKeyword = ['frukost', 'lunch', 'middag', 'mellanmål', 'snack'].includes(input.trim().toLowerCase());
                const is2ColMode = !input || isMealKeyword;
                
                if (is2ColMode && recentFoods.length > 0) {
                    e.preventDefault();
                    const leftCount = recentFoods.length;
                    
                    if (e.key === 'ArrowRight' && selectedIndex < leftCount) {
                        // Move to popular column (same vertical index if possible)
                        const nextIndex = Math.min(selectedIndex + leftCount, selectableItems.length - 1);
                        setSelectedIndex(nextIndex);
                    } else if (e.key === 'ArrowLeft' && selectedIndex >= leftCount) {
                        // Move to recent column (same vertical index)
                        const nextIndex = selectedIndex - leftCount;
                        setSelectedIndex(nextIndex);
                    }
                }
            }
        };
        globalThis.addEventListener('keydown', handleKeyDown);
        return () => globalThis.removeEventListener('keydown', handleKeyDown);
    }, [onClose, selectableItems.length, selectedIndex, input, recentFoods.length]);

    // Scroll selected item into view
    useEffect(() => {
        if (selectableItems.length > 0 && isOpen) {
            const el = document.getElementById(`omnibox-item-${selectedIndex}`);
            if (el) {
                el.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex, selectableItems.length, isOpen]);

    // Analytics: Track search queries (debounced)
    useEffect(() => {
        if (!input || input.length < 3) return;

        const timer = setTimeout(() => {
            logEvent('omnibox_search', input.substring(0, 50), 'search', {
                query: input.substring(0, 50),
                resultsCount: selectableItems.length
            });
        }, 1500); // Wait 1.5s after stop typing

        return () => clearTimeout(timer);
    }, [input, selectableItems.length, logEvent]);

    const logFoodItem = (item: FoodItem, quantity: number = 100) => {
        // Use draft values (from locked food mode), or parsed intent, or defaults
        const logDate = draftFoodDate || intent.date || selectedDate || new Date().toISOString().split('T')[0];

        // Use draft mealType, or parsed mealType from intent, or calculate from time
        let mealType: MealType = 'snack';
        if (draftFoodMealType) {
            mealType = draftFoodMealType;
            saveMealTypePreference(mealType);
        } else if (intent.type === 'food' && intent.data.mealType) {
            mealType = intent.data.mealType;
            saveMealTypePreference(mealType);
        } else {
            const savedPref = getSavedMealTypePreference();
            if (savedPref) {
                mealType = savedPref;
            } else {
                const hour = new Date().getHours();
                if (hour >= 5 && hour < 10) mealType = 'breakfast';
                else if (hour >= 10 && hour < 14) mealType = 'lunch';
                else if (hour >= 17 && hour < 21) mealType = 'dinner';
            }
        }

        // Check if logging as cooked
        const { canCook, effectiveYieldFactor } = canLogAsCooked(item);
        const isLoggingAsCooked = draftLogAsCooked && canCook;

        addMealEntry({
            date: logDate,
            mealType,
            items: [{
                type: 'foodItem',
                referenceId: item.id,
                servings: quantity, // servings is grams
                ...(isLoggingAsCooked && { loggedAsCooked: true }),
                ...(isLoggingAsCooked && { effectiveYieldFactor }),
            }]
        });
        console.log('[Omnibox] logFoodItem', {
            name: item.name,
            quantity,
            isLoggingAsCooked,
            effectiveYieldFactor
        });

        // Analytics: Track food log
        const durationMs = openTimestamp ? Date.now() - openTimestamp : null;
        logEvent('omnibox_log', item.name, 'food', {
            food: item.name,
            grams: quantity,
            mealType,
            isCooked: isLoggingAsCooked,
            durationMs
        });

        // Calculate displayed calories (adjust for cooked if needed)
        let displayCalories = item.calories * quantity / 100;
        if (isLoggingAsCooked && effectiveYieldFactor > 1) {
            displayCalories = displayCalories / effectiveYieldFactor;
        }

        setLastLoggedItem({
            name: item.name + (isLoggingAsCooked ? ' (kokt)' : ''),
            brand: item.brand,
            id: item.id,
            calories: Math.round(displayCalories),
            quantity,
            date: logDate,
            type: 'foodItem'
        });
        setShowFeedback(true);
        setInput('');
        setLockedFood(null);
        setDraftLogAsCooked(false);
        // Removed onClose() to allow multiple logging as requested
    };

    const lockQuickMeal = (meal: any) => {
        if (meal.itemType === 'recipe') {
            setLockedRecipe(meal);
            
            // Check intent for quantity
            if (intent.type === 'food' && intent.data.quantity) {
                if (intent.data.unit === 'g' || intent.data.unit === 'kg') {
                    const grams = intent.data.unit === 'kg' ? intent.data.quantity * 1000 : intent.data.quantity;
                    if (meal.totalWeight > 0) {
                        const totalS = meal.servings || 1;
                        setDraftRecipeServings((grams / meal.totalWeight) * totalS);
                    }
                } else {
                    // portion, st, or unknown unit
                    setDraftRecipeServings(intent.data.quantity);
                }
            } else {
                setDraftRecipeServings(1); // default
            }
        } else {
            setLockedQuickMeal(meal);
        }
        setDraftQuickMealMealType(intent.type === 'food' && intent.data.mealType ? intent.data.mealType : null);
        setDraftQuickMealDate(intent.date || selectedDate || new Date().toISOString().split('T')[0]);
        setInput(''); // Clear input to prevent accidental NLP redirects
    };


    const handleLockedMealAction = () => {
        if (!lockedQuickMeal && !lockedRecipe) return;

        const logDate = (lockedRecipe ? draftRecipeDate : draftQuickMealDate) || intent.date || selectedDate || new Date().toISOString().split('T')[0];

        // Determine meal type
        let mealType: MealType = 'snack';
        if (lockedRecipe && draftRecipeMealType) {
            mealType = draftRecipeMealType;
        } else if (lockedQuickMeal && draftQuickMealMealType) {
            mealType = draftQuickMealMealType;
        } else if (intent.type === 'food' && intent.data.mealType) {
            mealType = intent.data.mealType;
        } else {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 10) mealType = 'breakfast';
            else if (hour >= 10 && hour < 14) mealType = 'lunch';
            else if (hour >= 17 && hour < 21) mealType = 'dinner';
        }

        if (lockedRecipe) {
            addMealEntry({
                date: logDate,
                mealType,
                items: [{
                    type: 'recipe',
                    referenceId: lockedRecipe.id,
                    servings: draftRecipeServings
                }],
                title: lockedRecipe.name
            });
        } else if (lockedQuickMeal) {
            const meal = lockedQuickMeal; // local ref for TS
            addMealEntry({
                date: logDate,
                mealType,
                items: meal.items,
                title: meal.name,
                snabbvalId: meal.id, // This is important for grouping on the Calories page
                pieces: 1 // Default to 1 so stepper is available
            });
        }

        // Analytics & Tracking
        const durationMs = openTimestamp ? Date.now() - openTimestamp : null;
        const loggedName = lockedRecipe ? lockedRecipe.name : (lockedQuickMeal?.name || '');
        const loggedId = lockedRecipe ? lockedRecipe.id : (lockedQuickMeal?.id || '');
        const loggedType = lockedRecipe ? 'recipe' : 'quickMeal';
        const loggedCalories = lockedRecipe 
            ? Math.round((lockedRecipe.totals?.calories || 0) * draftRecipeServings)
            : Math.round(lockedQuickMeal?.totals?.calories || 0);

        logEvent('omnibox_log', loggedName, 'food', {
            type: loggedType,
            mealId: loggedId,
            itemCount: lockedRecipe ? 1 : (lockedQuickMeal?.items.length || 0),
            logDate,
            mealType,
            durationMs
        });

        setLastLoggedItem({
            name: loggedName,
            id: loggedId,
            calories: loggedCalories,
            quantity: 1,
            date: logDate,
            type: loggedType === 'recipe' ? 'foodItem' as any : 'quickMeal' // Simplified for recent items tracking
        });

        setShowFeedback(true);
        setInput('');
        setLockedQuickMeal(null);
        setLockedRecipe(null);
        setDraftRecipeServings(1);
    };

    const handleSaveComboAsQuickMeal = (meal: any) => {
        const cleanName = meal.name.replace('💡 ', '').trim();
        const saved = addQuickMeal(cleanName, meal.items);
        if (saved) {
            setLockedQuickMeal(processItem(saved, 'quickMeal'));
            setShowFeedback(true);
        }
    };

    const handleMoveToYesterday = () => {
        if (!lastLoggedItem) return;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        const entry = [...mealEntries]
            .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
            .find(e => 
                e.date === today && 
                (lastLoggedItem.type === 'foodItem' 
                    ? e.items.some(i => i.type === 'foodItem' && i.referenceId === lastLoggedItem.id)
                    : e.snabbvalId === lastLoggedItem.id)
            );

        if (entry) {
            updateMealEntry(entry.id, { date: yesterday });
            setLastLoggedItem(prev => prev ? { ...prev, date: yesterday } : null);
        }
    };

    // Lock a food item for detailed editing
    const lockFood = (item: FoodItem & { usageStats?: { count: number; lastUsed: string; avgGrams: number } | null }) => {
        setLockedFood({
            ...item,
            usageStats: item.usageStats || undefined
        });
        const stats = foodUsageStats[item.id];
        // Determine initial quantity
        let initialQty = 100;

        if (intent.type === 'food' && intent.data.quantity) {
            // If user explicitly typed "X port" or "X st", we multiply by default portion size
            if (intent.data.unit === 'portion' || intent.data.unit === 'st') {
                const portionSize = item.defaultPortionGrams || 100;
                initialQty = intent.data.quantity * portionSize;
            } else {
                initialQty = intent.data.quantity;
            }
        } else {
            // Fallback: Default portion > Average logged amount > 100g
            if (item.defaultPortionGrams) {
                initialQty = item.defaultPortionGrams;
            } else if (stats?.avgGrams) {
                initialQty = stats.avgGrams;
            } else {
                initialQty = 100;
            }
        }

        setDraftFoodQuantity(initialQty);
        setDraftFoodMealType(intent.type === 'food' && intent.data.mealType ? intent.data.mealType : null);
        setDraftFoodDate(intent.date || selectedDate || new Date().toISOString().split('T')[0]);
        setInput(''); // Clear input to prevent accidental NLP redirects
    };

    // Handle logging the locked food
    const handleLockedFoodAction = () => {
        if (!lockedFood) return;
        const quantity = draftFoodQuantity || lockedFood.usageStats?.avgGrams || 100;
        console.log('[Omnibox] handleLockedFoodAction', {
            draftFoodQuantity,
            avgGrams: lockedFood.usageStats?.avgGrams,
            resultQuantity: quantity,
            lockedFoodName: lockedFood.name
        });
        logFoodItem(lockedFood, quantity);
    };

    const handleExerciseAction = () => {
        if (intent.type !== 'exercise') return;

        const type = draftType || intent.data.exerciseType || 'other';
        const duration = draftDuration || intent.data.duration || 30;
        const intensity = draftIntensity || intent.data.intensity || 'moderate';
        const date = intent.date || selectedDate || new Date().toISOString().split('T')[0];

        const calories = calculateExerciseCalories(type, duration, intensity);
        addExercise({
            date,
            type,
            durationMinutes: duration,
            intensity,
            caloriesBurned: calories,
            subType: intent.data.subType,
            tonnage: intent.data.tonnage,
            notes: intent.data.notes,
            distance: intent.data.distance,
            heartRateAvg: intent.data.heartRateAvg,
            heartRateMax: intent.data.heartRateMax
        });

        setShowFeedback(true);
        setInput('');
    };

    const handleVitalsAction = () => {
        if (intent.type !== 'vitals') return;

        const date = intent.date || selectedDate || new Date().toISOString().split('T')[0];
        const amount = draftVitalAmount || intent.data.amount || 0;
        const vType = intent.data.vitalType;

        const currentVitals = getVitalsForDate(date);
        const updates: any = { updatedAt: new Date().toISOString() };

        if (vType === 'sleep') updates.sleep = amount;
        else if (vType === 'water') updates.water = (currentVitals.water || 0) + amount;
        else if (vType === 'steps') updates.steps = amount;
        else updates.caffeine = (currentVitals.caffeine || 0) + (intent.data.caffeine || amount * 100);

        updateVitals(date, updates);
        setShowFeedback(true);
        setInput('');
    };

    const handleMeasurementAction = () => {
        if (intent.type !== 'measurement') return;

        const type = draftMeasurementType || intent.data.measurementType;
        const value = draftMeasurementValue || intent.data.value;
        const date = draftMeasurementDate || intent.date || selectedDate || new Date().toISOString().split('T')[0];

        if (!type || !value) return;

        addBodyMeasurement({
            type,
            value,
            date
        });

        setShowFeedback(true);
        setInput('');
    };

    const handleExecuteAction = (action: any) => {
        trackActionUsage(action.id);
        if (action.id === 'post') {
            if (onCreatePost) onCreatePost();
        } else if (action.id === 'estimate') {
            if (onOpenEstimate) onOpenEstimate();
        } else if (action.id === 'add-food') {
            navigate('/database?action=new');
        } else if (action.id === 'backup') {
            fetch('/api/backup').then(r => r.blob()).then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            });
        } else if (action.id === 'recalc') {
            fetch('/api/recalculate-calories', { method: 'POST' });
        } else if (action.id === 'debug') {
            const current = localStorage.getItem('debug_view');
            localStorage.setItem('debug_view', current === 'true' ? 'false' : 'true');
            window.location.reload();
        } else if (action.id === 'clear') {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        }
        onClose();
    };

    const handleExecutePlanning = (activity: Partial<PlannedActivity>) => {
        if (!activity.title || !activity.date) return;
        
        savePlannedActivities([{
            ...activity,
            id: crypto.randomUUID(),
            status: 'PLANNED',
            structure: activity.structure || { warmupKm: 0, mainSet: [], cooldownKm: 0 }
        } as PlannedActivity]);

        setShowFeedback(true);
        setInput('');
    };

    const handleExecute = () => {
        // Handle locked food first
        if (lockedFood) {
            handleLockedFoodAction();
            return;
        }

        // Handle locked quick meal
        if (lockedQuickMeal) {
            handleLockedMealAction();
            return;
        }

        // Handle locked recipe
        if (lockedRecipe) {
            handleLockedMealAction();
            return;
        }

        // Handle navigation selection
        if (isSlashMode && selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'nav') {
            const route = selectableItems[selectedIndex] as any;
            logEvent('omnibox_nav', `Navigated to ${route.label}`, 'omnibox', { path: route.path });
            navigate(route.path);
            onClose();
            return;
        }

        // Handle user selection
        if (selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'user') {
            const selectedUser = selectableItems[selectedIndex] as any;
            const path = `/u/${selectedUser.handle || selectedUser.username}`;
            logEvent('omnibox_nav', `Navigated to user ${selectedUser.name}`, 'omnibox', { path });
            navigate(path);
            onClose();
            return;
        }

        // Handle action selection
        if (isActionMode && selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'action') {
            const action = selectableItems[selectedIndex] as any;
            handleExecuteAction(action);
            return;
        }

        // Handle quick meal selection
        if (selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'quickMeal') {
            const selectedMeal = selectableItems[selectedIndex];
            lockQuickMeal(selectedMeal);
            return;
        }

        // Handle saved estimate selection
        if (selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'savedEstimate') {
            const selectedMeal = selectableItems[selectedIndex];
            lockQuickMeal(selectedMeal);
            return;
        }

        // Handle recipe selection
        if (selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'recipe') {
            const selectedRecipe = selectableItems[selectedIndex];
            lockQuickMeal(selectedRecipe);
            return;
        }

        // Handle purchase match selection
        if (selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'purchase_match') {
            const selectedFood = selectableItems[selectedIndex];
            setLockedPurchaseFood(selectedFood);
            return;
        }

        // Handle food selection - lock it instead of immediately logging
        if (selectableItems.length > 0 && (selectableItems[selectedIndex]?.itemType === 'food' || selectableItems[selectedIndex]?.itemType === 'recent' || selectableItems[selectedIndex]?.itemType === 'popular')) {
            const selectedFood = selectableItems[selectedIndex] as FoodItem & { usageStats?: { avgGrams: number; count: number; lastUsed: string } };
            if (selectedFood) {
                lockFood(selectedFood);
                return;
            }
        }



        if (!input.trim()) return;

        if (intent.type === 'navigate') {
            logEvent('omnibox_nav', `Navigated to ${intent.data.path}`, 'omnibox', { path: intent.data.path });
            navigate(intent.data.path);
            onClose();
        } else if (intent.type === 'weight') {
            const date = intent.date || selectedDate || new Date().toISOString().split('T')[0];
            addWeightEntry(intent.data.weight, date);
            setShowFeedback(true);
            setInput('');
        } else if (intent.type === 'exercise') {
            handleExerciseAction();
        } else if (intent.type === 'vitals') {
            handleVitalsAction();
        } else if (intent.type === 'measurement') {
            handleMeasurementAction();
        } else if (intent.type === 'food' && intent.data.query) {
            navigate(`/calories?search=${encodeURIComponent(intent.data.query)}`);
            onClose();
        } else if (intent.type === 'planera') {
            handleExecutePlanning(intent.data);
        }
        setInput('');
    };

    const formatRelativeDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'idag';
        if (diffDays === 1) return 'igår';
        if (diffDays < 7) return `${diffDays} dagar sedan`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} vecka(or) sedan`;
        return dateStr;
    };

    if (!isOpen) return null;

    const vitalInfo = intent.type === 'vitals' ? VITALS_INFO[intent.data.vitalType || 'water'] : null;
    const VitalIcon = vitalInfo?.icon || Droplets;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center gap-4 border-b border-white/5 relative">
                    <span className="text-xl">{isSlashMode ? '🧭' : '✨'}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-xl font-medium text-white placeholder-slate-500 outline-none"
                        placeholder={isSlashMode ? "Navigera till..." : "Sök mat, logga vikt, / navigera..."}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleExecute()}
                    />
                    {showFeedback && lastLoggedItem && (
                        <div className="absolute top-full left-0 right-0 z-50 p-4 bg-slate-800 border-b border-white/5 shadow-xl animate-in slide-in-from-top-2 duration-300 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center text-xl">✅</div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white text-sm">{lastLoggedItem.name}</span>
                                        {lastLoggedItem.brand && (
                                            <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-medium uppercase tracking-wide">
                                                {lastLoggedItem.brand}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-emerald-400 font-bold">
                                        {lastLoggedItem.calories} kcal <span className="text-slate-500 font-normal">({Math.round(lastLoggedItem.quantity)}g) loggat</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {lastLoggedItem.date === new Date().toISOString().split('T')[0] && (
                                    <button
                                        onClick={handleMoveToYesterday}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-xs font-bold text-amber-400 border border-amber-500/20 transition-colors"
                                    >
                                        ⏪ Igår
                                    </button>
                                )}
                                <button
                                onClick={() => {
                                    if (onOpenNutrition && lastLoggedItem) {
                                        onOpenNutrition({
                                            type: 'foodItem', // Assuming food item for now as logging recipes isn't fully integrated here yet
                                            referenceId: lastLoggedItem.id,
                                            servings: lastLoggedItem.quantity
                                        });
                                        onClose();
                                    } else {
                                        navigate(`/calories?date=${new Date().toISOString().split('T')[0]}&breakdown=${lastLoggedItem.id}`);
                                        onClose();
                                    }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white transition-colors"
                            >
                                <Info size={14} />
                                <span>Mer info</span>
                                <ArrowRight size={14} className="opacity-50" />
                            </button>
                            </div>
                        </div>
                    )}
                    {showFeedback && !lastLoggedItem && (
                        <div className="absolute right-16 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full animate-in fade-in zoom-in duration-300">
                            Loggat!
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-500 bg-white/5 rounded border border-white/10">esc</kbd>
                    </div>
                </div>

                {/* Preview / Results Area */}
                <div className="bg-slate-950/50 max-h-[60vh] overflow-y-auto">
                    {/* Slash Navigation Mode */}
                    {isSlashMode && (
                        <NavSuggestionsModule
                            navSuggestions={navSuggestions}
                            selectedIndex={selectedIndex}
                            navigate={navigate}
                            onClose={onClose}
                            logEvent={logEvent}
                        />
                    )}

                    {/* Action Mode */}
                    {isActionMode && (
                        <ActionSuggestionsModule
                            actionSuggestions={actionSuggestions}
                            actionUsage={actionUsage}
                            selectedIndex={selectedIndex}
                            setSelectedIndex={setSelectedIndex}
                            handleExecuteAction={handleExecuteAction}
                        />
                    )}

                    {/* LOCKED FOOD MODULE - Shows when a food is matched/locked */}
                    {!isSlashMode && lockedFood && (
                        <LockedFoodModule
                            lockedFood={lockedFood}
                            draftFoodQuantity={draftFoodQuantity}
                            draftFoodMealType={draftFoodMealType}
                            draftFoodDate={draftFoodDate}
                            draftLogAsCooked={draftLogAsCooked}
                            setDraftFoodQuantity={setDraftFoodQuantity}
                            setDraftFoodMealType={setDraftFoodMealType}
                            setDraftFoodDate={setDraftFoodDate}
                            setDraftLogAsCooked={setDraftLogAsCooked}
                            setLockedFood={setLockedFood}
                            handleLockedFoodAction={handleLockedFoodAction}
                            onOpenNutrition={onOpenNutrition}
                            onClose={onClose}
                            navigate={navigate}
                        />
                    )}

                    {/* LOCKED QUICK MEAL MODULE - Shows when a quick meal is selected */}
                    {!isSlashMode && !lockedFood && lockedQuickMeal && (
                        <LockedQuickMealModule
                            lockedQuickMeal={lockedQuickMeal}
                            draftQuickMealMealType={draftQuickMealMealType}
                            draftQuickMealDate={draftQuickMealDate}
                            setDraftQuickMealMealType={setDraftQuickMealMealType}
                            setDraftQuickMealDate={setDraftQuickMealDate}
                            setLockedQuickMeal={setLockedQuickMeal}
                            handleSaveComboAsQuickMeal={handleSaveComboAsQuickMeal}
                            handleLockedQuickMealAction={handleLockedMealAction}
                        />
                    )}

                    {/* LOCKED RECIPE MODULE - Shows when a recipe is selected */}
                    {!isSlashMode && !lockedFood && !lockedQuickMeal && lockedRecipe && (
                        <LockedRecipeModule
                            lockedRecipe={{
                                ...lockedRecipe,
                                usageStats: recipeUsageStats[lockedRecipe.id] || null
                            }}
                            draftRecipeMealType={draftRecipeMealType}
                            draftRecipeDate={draftRecipeDate}
                            draftRecipeServings={draftRecipeServings}
                            setDraftRecipeMealType={setDraftRecipeMealType}
                            setDraftRecipeDate={setDraftRecipeDate}
                            setDraftRecipeServings={setDraftRecipeServings}
                            setLockedRecipe={setLockedRecipe}
                            handleLockedRecipeAction={handleLockedMealAction}
                        />
                    )}

                    {/* PLANNING MODULE */}
                    {!isSlashMode && !lockedFood && !lockedQuickMeal && intent.type === 'planera' && (
                        <PlanningModule
                            intent={intent}
                            handleExecutePlanning={handleExecutePlanning}
                        />
                    )}

                    {/* EXERCISE MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'exercise' && (
                        <ExerciseModule
                            intent={intent}
                            draftType={draftType}
                            draftDuration={draftDuration}
                            draftIntensity={draftIntensity}
                            isManual={isManual}
                            setDraftType={setDraftType}
                            setDraftDuration={setDraftDuration}
                            setDraftIntensity={setDraftIntensity}
                            setIsManual={setIsManual}
                            handleExerciseAction={handleExerciseAction}
                        />
                    )}

                    {/* MEASUREMENT MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'measurement' && (
                        <MeasurementModule
                            intent={intent}
                            draftMeasurementType={draftMeasurementType}
                            draftMeasurementValue={draftMeasurementValue}
                            draftMeasurementDate={draftMeasurementDate}
                            isManual={isManual}
                            setDraftMeasurementType={setDraftMeasurementType}
                            setDraftMeasurementValue={setDraftMeasurementValue}
                            setIsManual={setIsManual}
                            handleMeasurementAction={handleMeasurementAction}
                        />
                    )}

                    {/* VITALS MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'vitals' && vitalInfo && (
                        <VitalsModule
                            intent={intent}
                            vitalInfo={vitalInfo}
                            draftVitalAmount={draftVitalAmount}
                            setDraftVitalAmount={setDraftVitalAmount}
                            setIsManual={setIsManual}
                            handleVitalsAction={handleVitalsAction}
                        />
                    )}

                    {/* PURCHASE MODULE */}
                    {!isSlashMode && intent.type === 'purchase' && (
                        <PurchaseModule
                            intent={intent}
                            lockedFood={lockedPurchaseFood}
                            results={purchaseResults}
                            selectedIndex={selectedIndex}
                            selectableItems={selectableItems}
                            onSelectFood={(f) => {
                                setLockedPurchaseFood(f);
                                inputRef.current?.focus();
                            }}
                            onLogPurchase={(data) => {
                                addPurchaseLog(data);
                                setInput('');
                                setLockedPurchaseFood(null);
                                onClose();
                            }}
                        />
                    )}

                    {/* WEIGHT MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'weight' && (
                        <WeightModule
                            intent={intent}
                            handleExecute={handleExecute}
                        />
                    )}

                    {/* User Results */}
                    {!isSlashMode && !lockedFood && userResults.length > 0 && (
                        <UserResultsModule
                            userResults={userResults}
                            selectableItems={selectableItems}
                            selectedIndex={selectedIndex}
                            visitStats={visitStats}
                            navigate={navigate}
                            onClose={onClose}
                            logEvent={logEvent}
                        />
                    )}

                    {/* Mixed Search Results */}
                    {!isSlashMode && !lockedFood && !lockedQuickMeal && !lockedRecipe && (foodResults.length > 0 || standardQuickMeals.length > 0 || savedEstimates.length > 0 || recipeResults.length > 0) && (
                        <MixedSearchResultsModule
                            intent={intent}
                            foodResults={foodResults}
                            standardQuickMeals={standardQuickMeals}
                            savedEstimates={savedEstimates}
                            recipeResults={recipeResults}
                            selectableItems={selectableItems}
                            selectedIndex={selectedIndex}
                            logFoodItem={logFoodItem}
                            lockQuickMeal={lockQuickMeal}
                        />
                    )}

                    {/* No results for search */}
                    {!isSlashMode && intent.type === 'search' && foodResults.length === 0 && input.length >= 2 && (
                        <div className="text-slate-500 italic text-sm px-4 py-4">
                            Inga träffar. Prova ett annat sökord eller skriv kommando...
                        </div>
                    )}

                    {/* Empty state or Meal Keyword - show recents + popular/specific meal */}
                    {!lockedFood && !lockedQuickMeal && !lockedRecipe && (!input || ['frukost', 'lunch', 'middag', 'mellanmål', 'snack'].includes(input.trim().toLowerCase())) && (
                        <EmptyStateModule
                            input={input}
                            recentFoods={recentFoods}
                            popularFoods={popularFoods}
                            selectableItems={selectableItems}
                            selectedIndex={selectedIndex}
                            lockFood={lockFood}
                        />
                    )}
                </div>
            </div >
        </div >
    );
}
