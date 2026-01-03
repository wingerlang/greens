
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { parseOmniboxInput } from '../utils/nlpParser.ts';
import { performSmartSearch } from '../utils/searchUtils.ts';
import {
    ExerciseType,
    ExerciseIntensity,
    FoodItem,
    MealType,
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
    Heart
} from 'lucide-react';

interface OmniboxProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenTraining?: (defaults: { type?: ExerciseType; input?: string }) => void;
}

// Navigation routes for slash commands
const NAVIGATION_ROUTES = [
    { path: '/calories', label: 'Kalorier', aliases: ['kalorier', 'kcal', 'cal', 'calories'], icon: '🔥' },
    { path: '/recipes', label: 'Recept', aliases: ['recept', 'recipes', 'recipe'], icon: '📖' },
    { path: '/planera', label: 'Veckoplanering', aliases: ['planera', 'plan', 'vecka', 'weekly'], icon: '📅' },
    { path: '/training', label: 'Träning', aliases: ['träning', 'training', 'gym', 'workout'], icon: '💪' },
    { path: '/health', label: 'Hälsa', aliases: ['hälsa', 'health', 'halsa'], icon: '❤️' },
    { path: '/pantry', label: 'Skafferi', aliases: ['skafferi', 'pantry', 'förråd'], icon: '🗄️' },
    { path: '/database', label: 'Databas', aliases: ['databas', 'database', 'db', 'livsmedel'], icon: '📊' },
    { path: '/', label: 'Dashboard', aliases: ['hem', 'home', 'start', 'dashboard'], icon: '🏠' },
];

// Exercise types
const EXERCISE_TYPES: { type: ExerciseType; icon: string; label: string }[] = [
    { type: 'running', icon: '🏃', label: 'Löpning' },
    { type: 'cycling', icon: '🚴', label: 'Cykling' },
    { type: 'strength', icon: '🏋️', label: 'Styrka' },
    { type: 'walking', icon: '🚶', label: 'Promenad' },
    { type: 'swimming', icon: '🏊', label: 'Simning' },
    { type: 'yoga', icon: '🧘', label: 'Yoga' },
    { type: 'other', icon: '✨', label: 'Annat' },
];

const INTENSITIES: { value: ExerciseIntensity; label: string }[] = [
    { value: 'low', label: 'Låg' },
    { value: 'moderate', label: 'Medel' },
    { value: 'high', label: 'Hög' },
    { value: 'ultra', label: 'Max' },
];

// Vitals category info
const VITALS_INFO: Record<string, { icon: any; label: string; unit: string; bg: string; text: string }> = {
    sleep: { icon: Moon, label: 'Sömn', unit: 'timmar', bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
    water: { icon: Droplets, label: 'Vatten', unit: 'glas', bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    coffee: { icon: Coffee, label: 'Kaffe', unit: 'st', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    nocco: { icon: Zap, label: 'Nocco', unit: 'st', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    energy: { icon: Zap, label: 'Energidryck', unit: 'st', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    steps: { icon: Search, label: 'Steg', unit: 'steg', bg: 'bg-green-500/20', text: 'text-green-400' },
};

// Category emoji mapping
const getCategoryEmoji = (category?: string): string => {
    switch (category) {
        case 'protein': return '🌱';
        case 'vegetables': return '🥦';
        case 'fruits': return '🍎';
        case 'dairy-alt': return '🥛';
        case 'grains': return '🌾';
        case 'fats': return '🥑';
        case 'legumes': return '🫘';
        case 'nuts-seeds': return '🥜';
        case 'beverages': return '🍵';
        case 'spices': return '🌿';
        case 'condiments': return '🫙';
        case 'sauces': return '🥫';
        case 'sweeteners': return '🍯';
        case 'baking': return '🥧';
        default: return '🍽️';
    }
};

export function Omnibox({ isOpen, onClose, onOpenTraining }: OmniboxProps) {
    const navigate = useNavigate();
    const [input, setInput] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const {
        addWeightEntry,
        updateVitals,
        getVitalsForDate,
        foodItems,
        addMealEntry,
        mealEntries,
        addExercise,
        calculateExerciseCalories,
        users
    } = useData();


    const intent = parseOmniboxInput(input);
    const [showFeedback, setShowFeedback] = useState(false);

    // Draft states for exercise/vitals refinement
    const [draftType, setDraftType] = useState<ExerciseType | null>(null);
    const [draftDuration, setDraftDuration] = useState<number | null>(null);
    const [draftIntensity, setDraftIntensity] = useState<ExerciseIntensity | null>(null);
    const [draftVitalAmount, setDraftVitalAmount] = useState<number | null>(null);
    const [isManual, setIsManual] = useState(false);

    // Locked food state - when a food is matched with high confidence
    const [lockedFood, setLockedFood] = useState<(FoodItem & { usageStats?: { count: number; lastUsed: string; avgGrams: number } }) | null>(null);
    const [draftFoodQuantity, setDraftFoodQuantity] = useState<number | null>(null);
    const [draftFoodMealType, setDraftFoodMealType] = useState<MealType | null>(null);
    const [draftFoodDate, setDraftFoodDate] = useState<string | null>(null);

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
        // Sync food drafts from intent
        if (intent.type === 'food' && lockedFood) {
            if (intent.data.quantity) setDraftFoodQuantity(intent.data.quantity);
            if (intent.data.mealType) setDraftFoodMealType(intent.data.mealType);
            if (intent.date) setDraftFoodDate(intent.date);
        }
    }, [intent, isManual, lockedFood]);

    // Reset drafts when input clears
    useEffect(() => {
        if (!input) {
            setIsManual(false);
            setDraftType(null);
            setDraftDuration(null);
            setDraftIntensity(null);
            setDraftVitalAmount(null);
            setLockedFood(null);
            setDraftFoodQuantity(null);
            setDraftFoodMealType(null);
            setDraftFoodDate(null);
        }
    }, [input]);

    // Detect slash navigation mode
    const isSlashMode = input.startsWith('/');
    const slashQuery = isSlashMode ? input.slice(1).toLowerCase() : '';

    // Navigation suggestions for slash mode
    const navSuggestions = useMemo(() => {
        if (!isSlashMode) return [];
        if (!slashQuery) return NAVIGATION_ROUTES;

        return NAVIGATION_ROUTES.filter(route =>
            route.aliases.some(alias => alias.includes(slashQuery)) ||
            route.label.toLowerCase().includes(slashQuery)
        );
    }, [isSlashMode, slashQuery]);

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

        const sortedEntries = [...mealEntries].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

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
            textFn: (item) => item.name,
            categoryFn: (item) => item.category,
            usageCountFn: (item) => foodUsageStats[item.id]?.count || 0,
            limit: 6
        }).map(item => ({
            ...item,
            type: 'food' as const,
            usageStats: foodUsageStats[item.id] || null
        }));
    }, [input, foodItems, foodUsageStats, isSlashMode, intent, lockedFood]);

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



    // Auto-lock: When there's exactly one exact match, auto-lock it
    useEffect(() => {
        if (lockedFood) return; // Already locked
        if (foodResults.length === 0) return;

        // Check for exact name match
        const searchQuery = intent.type === 'food' && intent.data.query
            ? intent.data.query.toLowerCase().trim()
            : input.toLowerCase().trim();

        const exactMatch = foodResults.find(
            item => item.name.toLowerCase() === searchQuery
        );

        if (exactMatch) {
            setLockedFood({
                ...exactMatch,
                usageStats: foodUsageStats[exactMatch.id] || undefined
            });
            // Set initial drafts
            const stats = foodUsageStats[exactMatch.id];
            const foodData = intent.type === 'food' ? intent.data : null;
            setDraftFoodQuantity(foodData?.quantity || stats?.avgGrams || 100);
            setDraftFoodMealType(foodData?.mealType || null);
            setDraftFoodDate(intent.date || null);
        }
    }, [foodResults, lockedFood, intent, input, foodUsageStats]);

    // Combined selectable items for keyboard nav
    const selectableItems = useMemo(() => {
        if (lockedFood) return []; // No selection when locked
        if (isSlashMode) return navSuggestions.map(r => ({ itemType: 'nav' as const, ...r }));

        const items: any[] = [];
        if (userResults.length > 0) items.push(...userResults.map(u => ({ itemType: 'user' as const, ...u })));
        if (foodResults.length > 0) items.push(...foodResults.map(f => ({ itemType: 'food' as const, ...f })));
        if (!input && recentFoods.length > 0) items.push(...recentFoods.map(f => ({ itemType: 'recent' as const, ...f })));

        return items;
    }, [isSlashMode, navSuggestions, foodResults, userResults, input, recentFoods, lockedFood]);


    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [selectableItems.length]);

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
        }
    }, [isOpen]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, selectableItems.length - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, selectableItems.length]);

    const logFoodItem = (item: FoodItem, quantity: number = 100) => {
        // Use draft values (from locked food mode), or parsed intent, or defaults
        const logDate = draftFoodDate || intent.date || new Date().toISOString().split('T')[0];

        // Use draft mealType, or parsed mealType from intent, or calculate from time
        let mealType: MealType = 'snack';
        if (draftFoodMealType) {
            mealType = draftFoodMealType;
        } else if (intent.type === 'food' && intent.data.mealType) {
            mealType = intent.data.mealType;
        } else {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 10) mealType = 'breakfast';
            else if (hour >= 10 && hour < 14) mealType = 'lunch';
            else if (hour >= 17 && hour < 21) mealType = 'dinner';
        }

        addMealEntry({
            date: logDate,
            mealType,
            items: [{
                type: 'foodItem',
                referenceId: item.id,
                servings: quantity // servings is grams
            }]
        });

        setShowFeedback(true);
        setInput('');
        setLockedFood(null);
        setTimeout(() => onClose(), 800);
    };

    // Lock a food item for detailed editing
    const lockFood = (item: FoodItem & { usageStats?: { count: number; lastUsed: string; avgGrams: number } | null }) => {
        setLockedFood({
            ...item,
            usageStats: item.usageStats || undefined
        });
        const stats = foodUsageStats[item.id];
        setDraftFoodQuantity(intent.type === 'food' && intent.data.quantity ? intent.data.quantity : (stats?.avgGrams || 100));
        setDraftFoodMealType(intent.type === 'food' && intent.data.mealType ? intent.data.mealType : null);
        setDraftFoodDate(intent.date || null);
    };

    // Handle logging the locked food
    const handleLockedFoodAction = () => {
        if (!lockedFood) return;
        const quantity = draftFoodQuantity || lockedFood.usageStats?.avgGrams || 100;
        logFoodItem(lockedFood, quantity);
    };

    const handleExerciseAction = () => {
        if (intent.type !== 'exercise') return;

        const type = draftType || intent.data.exerciseType || 'other';
        const duration = draftDuration || intent.data.duration || 30;
        const intensity = draftIntensity || intent.data.intensity || 'moderate';
        const date = intent.date || new Date().toISOString().split('T')[0];

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
        setTimeout(() => onClose(), 800);
    };

    const handleVitalsAction = () => {
        if (intent.type !== 'vitals') return;

        const date = intent.date || new Date().toISOString().split('T')[0];
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
        setTimeout(() => onClose(), 800);
    };

    const handleExecute = () => {
        // Handle locked food first
        if (lockedFood) {
            handleLockedFoodAction();
            return;
        }

        // Handle slash navigation
        if (isSlashMode && selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'nav') {
            const navItem = selectableItems[selectedIndex] as { itemType: 'nav'; path: string };
            navigate(navItem.path);
            onClose();
            return;
        }

        // Handle user selection
        if (selectableItems.length > 0 && selectableItems[selectedIndex]?.itemType === 'user') {
            const selectedUser = selectableItems[selectedIndex];
            navigate(`/u/${selectedUser.handle || selectedUser.username}`);
            onClose();
            return;
        }

        // Handle food selection - lock it instead of immediately logging
        if (selectableItems.length > 0 && (selectableItems[selectedIndex]?.itemType === 'food' || selectableItems[selectedIndex]?.itemType === 'recent')) {
            const selectedFood = selectableItems[selectedIndex] as FoodItem & { usageStats?: { avgGrams: number; count: number; lastUsed: string } };
            if (selectedFood) {
                lockFood(selectedFood);
                return;
            }
        }


        if (!input.trim()) return;

        if (intent.type === 'navigate') {
            navigate(intent.data.path);
            onClose();
        } else if (intent.type === 'weight') {
            const date = intent.date || new Date().toISOString().split('T')[0];
            addWeightEntry(intent.data.weight, date);
            setShowFeedback(true);
            setInput('');
            setTimeout(() => onClose(), 800);
        } else if (intent.type === 'exercise') {
            handleExerciseAction();
        } else if (intent.type === 'vitals') {
            handleVitalsAction();
        } else if (intent.type === 'food' && intent.data.query) {
            navigate(`/calories?search=${encodeURIComponent(intent.data.query)}`);
            onClose();
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
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex items-center gap-4 border-b border-white/5">
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
                    {showFeedback && (
                        <div className="absolute right-16 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full animate-in fade-in zoom-in duration-300">
                            ✨ Sparat!
                        </div>
                    )}
                    <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-white/5 px-2 font-mono text-[10px] font-medium text-slate-400">
                        ESC
                    </kbd>
                </div>

                {/* Preview / Results Area */}
                <div className="bg-slate-950/50 max-h-[60vh] overflow-y-auto">
                    {/* Slash Navigation Mode */}
                    {isSlashMode && (
                        <div className="px-2 py-2">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span>🧭</span> Navigera ({navSuggestions.length})
                            </div>
                            {navSuggestions.map((route, idx) => (
                                <div
                                    key={route.path}
                                    onClick={() => { navigate(route.path); onClose(); }}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${idx === selectedIndex
                                        ? 'bg-cyan-500/20 text-cyan-400'
                                        : 'hover:bg-white/5 text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                                            {route.icon}
                                        </div>
                                        <div>
                                            <div className="font-medium">{route.label}</div>
                                            <div className="text-[10px] text-slate-500">{route.path}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div className="px-2 py-1 text-[10px] text-slate-600 text-center">
                                ↑↓ navigera • Enter för att öppna
                            </div>
                        </div>
                    )}

                    {/* LOCKED FOOD MODULE - Shows when a food is matched/locked */}
                    {!isSlashMode && lockedFood && (
                        <div className="p-4 space-y-4">
                            <div className="px-3 py-2 bg-emerald-500/10 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-2">
                                <span className="text-lg">{getCategoryEmoji(lockedFood.category)}</span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Logga Mat</span>
                                <button
                                    onClick={() => { setLockedFood(null); setDraftFoodQuantity(null); setDraftFoodMealType(null); setDraftFoodDate(null); }}
                                    className="ml-auto text-[10px] uppercase font-bold text-slate-400 hover:text-white bg-white/10 px-2 py-0.5 rounded-full"
                                >
                                    ✕ Ångra
                                </button>
                            </div>

                            {/* Food Item Display */}
                            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                                <div className="w-16 h-16 rounded-xl bg-emerald-500/20 flex items-center justify-center text-3xl">
                                    {getCategoryEmoji(lockedFood.category)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white">{lockedFood.name}</h3>
                                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                        <span className="uppercase">{lockedFood.category || 'Livsmedel'}</span>
                                        {lockedFood.usageStats && (
                                            <>
                                                <span className="text-slate-600">•</span>
                                                <span className="text-emerald-500/70">{lockedFood.usageStats.count}x loggad</span>
                                                <span className="text-slate-600">•</span>
                                                <span>snitt {Math.round(lockedFood.usageStats.avgGrams)}g</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Editable Fields Row */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* Quantity */}
                                <div className="bg-slate-800/50 rounded-xl p-3">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Mängd</label>
                                    <div className="flex items-baseline gap-1">
                                        <input
                                            type="number"
                                            value={draftFoodQuantity || ''}
                                            onChange={(e) => setDraftFoodQuantity(parseFloat(e.target.value) || 0)}
                                            className="w-full text-2xl font-black bg-transparent border-b-2 border-slate-600 focus:border-emerald-500 outline-none text-white"
                                            placeholder={String(lockedFood.usageStats?.avgGrams || 100)}
                                        />
                                        <span className="text-sm font-bold text-slate-400">g</span>
                                    </div>
                                </div>

                                {/* Meal Type */}
                                <div className="bg-slate-800/50 rounded-xl p-3">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Måltid</label>
                                    <select
                                        value={draftFoodMealType || ''}
                                        onChange={(e) => setDraftFoodMealType(e.target.value as MealType)}
                                        className="w-full text-lg font-bold bg-transparent text-white outline-none cursor-pointer"
                                    >
                                        <option value="">Auto</option>
                                        <option value="breakfast">🌅 Frukost</option>
                                        <option value="lunch">☀️ Lunch</option>
                                        <option value="dinner">🌙 Middag</option>
                                        <option value="snack">🍎 Mellanmål</option>
                                        <option value="beverage">🥤 Dryck</option>
                                    </select>
                                </div>

                                {/* Date */}
                                <div className="bg-slate-800/50 rounded-xl p-3">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Datum</label>
                                    <select
                                        value={draftFoodDate || ''}
                                        onChange={(e) => setDraftFoodDate(e.target.value || null)}
                                        className="w-full text-lg font-bold bg-transparent text-white outline-none cursor-pointer"
                                    >
                                        <option value="">📅 Idag</option>
                                        <option value={new Date(Date.now() - 86400000).toISOString().split('T')[0]}>⏪ Igår</option>
                                        <option value={new Date(Date.now() + 86400000).toISOString().split('T')[0]}>⏩ Imorgon</option>
                                    </select>
                                </div>
                            </div>

                            {/* Calculated Nutrients Preview */}
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 rounded-xl">
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-slate-400">
                                        🔥 <span className="font-bold text-white">{Math.round(lockedFood.calories * (draftFoodQuantity || 100) / 100)}</span> kcal
                                    </span>
                                    <span className="text-slate-400">
                                        🥩 <span className="font-bold text-white">{Math.round(lockedFood.protein * (draftFoodQuantity || 100) / 100)}</span>g prot
                                    </span>
                                    <span className="text-slate-400">
                                        🍞 <span className="font-bold text-white">{Math.round((lockedFood.carbs || 0) * (draftFoodQuantity || 100) / 100)}</span>g kolh
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    för {draftFoodQuantity || 100}g
                                </div>
                            </div>

                            {/* Action Button */}
                            <button
                                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                onClick={handleLockedFoodAction}
                            >
                                <span>Logga {lockedFood.name}</span>
                                <ArrowRight size={16} />
                            </button>

                            {/* View Details & History Link */}
                            <button
                                onClick={() => {
                                    navigate(`/database?id=${lockedFood.id}`);
                                    onClose();
                                }}
                                className="w-full py-2 text-center text-slate-400 hover:text-white text-xs underline underline-offset-4"
                            >
                                📋 Visa alla detaljer & logghistorik →
                            </button>

                            {/* Hint for continuing to type */}
                            <div className="text-center text-[10px] text-slate-500">
                                💡 Fortsätt skriva för att ändra mängd, måltid eller datum (t.ex. "120g mellanmål igår")
                            </div>
                        </div>
                    )}

                    {/* EXERCISE MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'exercise' && (
                        <div className="p-4 space-y-4">
                            <div className="px-3 py-2 bg-orange-500/10 border-l-4 border-orange-500 rounded-r-lg flex items-center gap-2">
                                <Dumbbell size={16} className="text-orange-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Träning</span>
                                {isManual && <span className="ml-auto text-[10px] uppercase font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-full">Manuellt ändrad</span>}
                            </div>

                            {/* Exercise Type Selector */}
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                {EXERCISE_TYPES.map(t => (
                                    <button
                                        key={t.type}
                                        onClick={() => { setDraftType(t.type); setIsManual(true); }}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[70px] ${(draftType || intent.data.exerciseType) === t.type
                                            ? 'border-orange-500 bg-orange-500/20'
                                            : 'border-transparent hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="text-2xl">{t.icon}</span>
                                        <span className="text-[10px] font-bold text-slate-400">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Duration & Intensity */}
                            <div className="flex items-center gap-6 p-4 bg-slate-800/50 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                    <Flame size={64} />
                                </div>

                                <div className="flex-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Tid (min)</label>
                                    <input
                                        type="number"
                                        value={draftDuration || intent.data.duration || ''}
                                        onChange={(e) => { setDraftDuration(parseFloat(e.target.value)); setIsManual(true); }}
                                        className="w-full text-3xl font-black bg-transparent border-b-2 border-slate-600 focus:border-orange-500 outline-none text-white"
                                        placeholder="30"
                                    />

                                    {/* Extra Details Row */}
                                    <div className="flex flex-wrap gap-3 mt-3">
                                        {intent.data.distance && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded-lg text-blue-300">
                                                <MapPin size={12} />
                                                <span className="text-xs font-bold">{intent.data.distance} km</span>
                                            </div>
                                        )}
                                        {intent.data.tonnage && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/20 rounded-lg text-purple-300">
                                                <Dumbbell size={12} />
                                                <span className="text-xs font-bold">{Math.round(intent.data.tonnage / 1000)} ton</span>
                                            </div>
                                        )}
                                        {intent.data.heartRateAvg && (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500/20 rounded-lg text-rose-300">
                                                <Heart size={12} />
                                                <span className="text-xs font-bold">{intent.data.heartRateAvg} bpm</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 border-l border-slate-700 pl-6">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Intensitet</label>
                                    <div className="flex flex-col gap-1">
                                        {INTENSITIES.map(i => (
                                            <button
                                                key={i.value}
                                                onClick={() => { setDraftIntensity(i.value); setIsManual(true); }}
                                                className={`text-xs font-bold text-left px-2 py-1 rounded ${(draftIntensity || intent.data.intensity) === i.value
                                                    ? 'bg-orange-500/30 text-orange-400'
                                                    : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                            >
                                                {i.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                                onClick={handleExerciseAction}
                            >
                                <span>Logga Träning</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    )}

                    {/* VITALS MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'vitals' && vitalInfo && (
                        <div className="p-4 space-y-4">
                            <div className={`px-3 py-2 ${vitalInfo.bg} border-l-4 ${vitalInfo.text.replace('text-', 'border-')} rounded-r-lg flex items-center gap-2`}>
                                <VitalIcon size={16} className={vitalInfo.text} />
                                <span className={`text-xs font-bold uppercase tracking-wider ${vitalInfo.text}`}>{vitalInfo.label}</span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${vitalInfo.bg} ${vitalInfo.text} text-3xl`}>
                                    <VitalIcon size={32} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="number"
                                            value={draftVitalAmount || intent.data.amount || ''}
                                            onChange={(e) => { setDraftVitalAmount(parseFloat(e.target.value)); setIsManual(true); }}
                                            className="w-24 text-3xl font-black bg-transparent border-b-2 border-slate-600 focus:border-indigo-500 outline-none text-white text-center"
                                            placeholder="0"
                                        />
                                        <span className="text-sm font-bold text-slate-400 uppercase">
                                            {vitalInfo.unit}
                                        </span>
                                    </div>
                                    <button
                                        className={`text-white ${vitalInfo.bg.replace('/20', '')} hover:opacity-80 px-4 py-1.5 rounded-full text-xs font-bold`}
                                        onClick={handleVitalsAction}
                                    >
                                        Spara
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WEIGHT MODULE */}
                    {!isSlashMode && !lockedFood && intent.type === 'weight' && (
                        <div className="flex items-center gap-3 text-emerald-400 px-4 py-4">
                            <span className="text-2xl">⚖️</span>
                            <span className="text-lg">Logga vikt: <span className="font-bold">{intent.data.weight} kg</span></span>
                            {intent.date && <span className="ml-2 text-slate-500 font-normal">({intent.date})</span>}
                            <button
                                className="ml-auto bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
                                onClick={handleExecute}
                            >
                                Spara
                            </button>
                        </div>
                    )}

                    {/* User Results */}
                    {!isSlashMode && !lockedFood && userResults.length > 0 && (
                        <div className="px-2 py-2">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span>👥</span> Personer ({userResults.length})
                            </div>
                            {userResults.map((user, idx) => {
                                const globalIdx = selectableItems.findIndex(i => i.itemType === 'user' && i.id === user.id);
                                return (
                                    <div
                                        key={user.id}
                                        onClick={() => { navigate(`/u/${user.handle || user.username}`); onClose(); }}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${globalIdx === selectedIndex
                                            ? 'bg-indigo-500/20 text-indigo-400'
                                            : 'hover:bg-white/5 text-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400">
                                                {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover rounded-lg" /> : user.name[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium">{user.name}</div>
                                                <div className="text-[10px] text-slate-500">@{user.handle || user.username}</div>
                                            </div>
                                        </div>
                                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Food Search Results */}

                    {!isSlashMode && foodResults.length > 0 && (
                        <div className="px-2 py-2">
                            {/* Parsed Intent Preview */}
                            {intent.type === 'food' && (intent.data.quantity !== 100 || intent.data.mealType || intent.date) && (
                                <div className="px-3 py-2 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                                        <span>🎯</span>
                                        <span>Loggar:</span>
                                        {intent.data.quantity && intent.data.quantity !== 100 && (
                                            <span className="font-bold">{Math.round(intent.data.quantity)}{intent.data.unit || 'g'}</span>
                                        )}
                                        {intent.data.mealType && (
                                            <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-[10px] font-bold uppercase">
                                                {intent.data.mealType === 'breakfast' ? 'frukost' :
                                                    intent.data.mealType === 'lunch' ? 'lunch' :
                                                        intent.data.mealType === 'dinner' ? 'middag' :
                                                            intent.data.mealType === 'snack' ? 'mellanmål' : intent.data.mealType}
                                            </span>
                                        )}
                                        {intent.date && (
                                            <span className="text-slate-400 text-xs">→ {intent.date}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <span>🍎</span> Råvaror ({foodResults.length})
                            </div>
                            {foodResults.map((item, idx) => {
                                // Use parsed quantity from intent, or user's typical amount, or 100g
                                const logQuantity = (intent.type === 'food' && intent.data.quantity)
                                    ? intent.data.quantity
                                    : (item.usageStats?.avgGrams || 100);
                                const displayKcal = Math.round(item.calories * logQuantity / 100);

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => logFoodItem(item, logQuantity)}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${idx === selectedIndex
                                            ? 'bg-emerald-500/20 text-emerald-400'
                                            : 'hover:bg-white/5 text-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                                                {getCategoryEmoji(item.category)}
                                            </div>
                                            <div>
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                    <span className="uppercase tracking-wide">{item.category || 'Övrigt'}</span>
                                                    {item.usageStats && (
                                                        <>
                                                            <span className="text-slate-600">•</span>
                                                            <span className="text-emerald-500/70">{item.usageStats.count}x loggad</span>
                                                            <span className="text-slate-600">•</span>
                                                            <span>snitt {Math.round(item.usageStats.avgGrams)}g</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-sm">{displayKcal} kcal</div>
                                            <div className="text-[10px] text-slate-500">
                                                {Math.round(logQuantity)}g • {Math.round(item.protein)}g prot/100g
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="px-2 py-1 text-[10px] text-slate-600 text-center">
                                ↑↓ navigera • Enter för att logga
                            </div>
                        </div>
                    )}

                    {/* No results for search */}
                    {!isSlashMode && intent.type === 'search' && foodResults.length === 0 && input.length >= 2 && (
                        <div className="text-slate-500 italic text-sm px-4 py-4">
                            Inga träffar. Prova ett annat sökord eller skriv kommando...
                        </div>
                    )}

                    {/* Empty state - show recents + tips */}
                    {!input && (
                        <div className="px-2 py-2">
                            {recentFoods.length > 0 && (
                                <div className="mb-4">
                                    <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <span>🕐</span> Senast loggade
                                    </div>
                                    {recentFoods.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            onClick={() => logFoodItem(item, item.usageStats.avgGrams)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all ${idx === selectedIndex
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'hover:bg-white/5 text-white'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm">
                                                    {getCategoryEmoji(item.category)}
                                                </div>
                                                <div>
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                        <span className="text-emerald-500/70">{item.usageStats.count}x loggad</span>
                                                        <span className="text-slate-600">•</span>
                                                        <span>{formatRelativeDate(item.usageStats.lastUsed)}</span>
                                                        <span className="text-slate-600">•</span>
                                                        <span>~{Math.round(item.usageStats.avgGrams)}g</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-sm">{Math.round(item.calories * item.usageStats.avgGrams / 100)} kcal</div>
                                                <div className="text-[10px] text-slate-500">för {Math.round(item.usageStats.avgGrams)}g</div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="px-2 py-1 text-[10px] text-slate-600 text-center">
                                        ↑↓ navigera • Enter för att logga • eller börja skriva
                                    </div>
                                </div>
                            )}

                            <div className="p-4 text-center text-slate-500 text-xs space-y-1 border-t border-white/5">
                                <p>🍎 Sök råvaror: "kyckling", "havregryn", "ägg"</p>
                                <p>⚖️ Logga vikt: "82.5kg"</p>
                                <p>😴 Sömn: "7h sömn"</p>
                                <p>🏋️ Träning: "löpning 30 min"</p>
                                <p className="text-cyan-500/70">🧭 Navigera: skriv "/" för snabbnavigering</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
