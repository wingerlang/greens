import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSearchParams } from 'react-router-dom';
import {
    type FoodItem,
    type FoodItemFormData,
    type Unit,
    type FoodCategory,
    type FoodStorageType,
    type Season,
    type QuickMeal,
    CATEGORY_LABELS,
    UNIT_LABELS,
} from '../models/types.ts';
import { normalizeText } from '../utils/formatters.ts';
import { parseNutritionText, extractFromJSONLD, cleanProductName, extractBrand, extractPackagingWeight } from '../utils/nutrition/index.ts';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { FoodItemDetailModal } from '../components/database/FoodItemDetailModal.tsx';
import { FoodItemFormModal } from '../components/database/FoodItemFormModal.tsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { QuickMealEditModal } from '../components/database/QuickMealEditModal.tsx';
import './DatabasePage.css';


const STORAGE_TYPE_LABELS: Record<FoodStorageType, string> = {
    fresh: '🥬 Färsk',
    pantry: '🏪 Skafferi',
    frozen: '❄️ Fryst',
};

const CATEGORY_GROUPS: Record<string, FoodCategory[]> = {
    'Grönt & Frukt': ['vegetables', 'fruits'],
    'Protein & Baljväxter': ['protein', 'legumes', 'dairy-alt', 'nuts-seeds', 'supplements', 'meal-replacement', 'protein-bar'],
    'Skafferi & Bas': ['grains', 'cereals', 'baking', 'spices', 'condiments', 'sauces', 'sweeteners', 'fats'],
    'Dryck': ['beverages'],
    'Godis & Snacks': ['candy'],
    'Övrigt': ['other']
};

const EMPTY_FORM: FoodItemFormData = {
    name: '',
    brand: '',
    imageUrl: '',
    packageWeight: 0,
    defaultPortionGrams: 0,
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    unit: 'g',
    category: 'other',
    storageType: 'pantry',
    pricePerUnit: 0,
    co2PerUnit: 0,
    containsGluten: false,
    iron: 0,
    calcium: 0,
    zinc: 0,
    vitaminB12: 0,
    isCompleteProtein: false,
    missingAminoAcids: [],
    complementaryCategories: [],
    proteinCategory: undefined,
    seasons: [],
    ingredients: '',
};

type ViewMode = 'grid' | 'list';
type DatabaseTab = 'items' | 'my-content' | 'activity-log' | 'stats' | 'brands' | 'purchases';

export function DatabasePage({ headless = false }: { headless?: boolean }) {
    const { foodItems, recipes, mealEntries, quickMeals, addFoodItem, updateFoodItem, deleteFoodItem, foodAliases, updateFoodAlias, users, currentUser, databaseActions, updateQuickMeal, purchaseLogs } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const hasAutoOpened = useRef(false);

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<FoodItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<FoodItem | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Form State
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);

    // Search/Filter State
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [activeTab, setActiveTab] = useState<DatabaseTab>('items');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'user'>('all');

    const [editingQuickMeal, setEditingQuickMeal] = useState<QuickMeal | null>(null);
    const [isQuickMealEditOpen, setIsQuickMealEditOpen] = useState(false);
    const [showArchivedQuickMeals, setShowArchivedQuickMeals] = useState(false);

    // Toast Timer
    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // Update URL param when detailItem changes
    useEffect(() => {
        if (detailItem) {
            const newParams = new URLSearchParams(searchParams);
            newParams.set('id', detailItem.id);
            setSearchParams(newParams, { replace: true });
        } else {
            const idParam = searchParams.get('id');
            if (idParam) {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('id');
                setSearchParams(newParams, { replace: true });
            }
        }
    }, [detailItem, setSearchParams, searchParams]);

    // Sync searchQuery with URL search param
    useEffect(() => {
        const urlSearch = searchParams.get('search');
        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [searchParams]);

    const itemFrequencyMap = useMemo(() => {
        const freqMap: Record<string, number> = {};
        mealEntries.forEach(entry => {
            entry.items.forEach(item => {
                const refId = item.referenceId;
                if (refId) {
                    freqMap[refId] = (freqMap[refId] || 0) + 1;
                }
            });
        });
        return freqMap;
    }, [mealEntries]);

    const filteredItems = useMemo(() => {
        const query = normalizeText(searchQuery);
        const matchesCategory = (item: FoodItem) => selectedCategory === 'all' || item.category === selectedCategory;

        const exactMatches: FoodItem[] = [];
        const startsWithMatches: FoodItem[] = [];
        const containsMatches: FoodItem[] = [];

        for (const item of foodItems) {
            if (!matchesCategory(item)) continue;

            // Apply Source Filter
            if (sourceFilter === 'user' && !item.createdBy) continue;

            if (!query) {
                exactMatches.push(item);
                continue;
            }

            const nameLower = normalizeText(item.name);
            const brandLower = item.brand ? normalizeText(item.brand) : '';
            const descLower = item.description ? normalizeText(item.description) : '';
            const aliasesLower = (item.aliases || []).map(a => normalizeText(a));

            if (nameLower === query || brandLower === query || aliasesLower.includes(query)) {
                exactMatches.push(item);
            } else if (nameLower.startsWith(query) || brandLower.startsWith(query) || aliasesLower.some(a => a.startsWith(query))) {
                startsWithMatches.push(item);
            } else if (nameLower.includes(query) || brandLower.includes(query) || descLower.includes(query) || aliasesLower.some(a => a.includes(query))) {
                containsMatches.push(item);
            }
        }

        let results = [...exactMatches, ...startsWithMatches, ...containsMatches];

        // Apply sorting
        if (sortConfig) {
            results.sort((a, b) => {
                let aVal: any;
                let bVal: any;

                if (sortConfig.key === 'creator') {
                    aVal = users.find(u => u.id === a.createdBy)?.name || '';
                    bVal = users.find(u => u.id === b.createdBy)?.name || '';
                } else if (sortConfig.key === 'date') {
                    aVal = a.createdAt || '';
                    bVal = b.createdAt || '';
                } else if (sortConfig.key === 'frequency') {
                    aVal = itemFrequencyMap[a.id] || 0;
                    bVal = itemFrequencyMap[b.id] || 0;
                } else {
                    aVal = a[sortConfig.key as keyof FoodItem];
                    bVal = b[sortConfig.key as keyof FoodItem];
                }

                if (aVal === undefined || aVal === null) aVal = '';
                if (bVal === undefined || bVal === null) bVal = '';

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else if (!query) {
            // Default sort by frequency if no search and no explicit sort, then by updatedAt
            results.sort((a, b) => {
                const freqA = itemFrequencyMap[a.id] || 0;
                const freqB = itemFrequencyMap[b.id] || 0;
                if (freqA !== freqB) return freqB - freqA;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
        }

        return results.slice(0, 100);
    }, [foodItems, searchQuery, selectedCategory, sortConfig, users, itemFrequencyMap]);

    // Auto-open detail if EXACT search match OR ID match from URL
    useEffect(() => {
        const urlId = searchParams.get('id');
        if (urlId) {
            const item = foodItems.find(it => it.id === urlId);
            if (item) {
                setDetailItem(item);
                return;
            }
        }

        const urlSearch = searchParams.get('search');
        if (urlSearch && filteredItems.length === 1 && filteredItems[0].name.toLowerCase() === urlSearch.toLowerCase()) {
            setDetailItem(filteredItems[0]);
        }

        if (searchParams.get('action') === 'new' && !hasAutoOpened.current) {
            hasAutoOpened.current = true;
            const category = searchParams.get('category') as FoodCategory;
            setTimeout(() => {
                handleOpenForm(undefined, category);
            }, 100);
        }
    }, [searchParams, filteredItems.length, foodItems]);

    // Handle ESC key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDetailItem(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                if (prev.direction === 'asc') return { key, direction: 'desc' };
                return null;
            }
            return { key, direction: 'asc' };
        });
    };

    const stats = useMemo(() => ({
        totalFoods: foodItems.length,
        totalRecipes: recipes.length,
        incompleteFoods: foodItems.filter(f => f.calories === 0 || !f.category || f.category === 'other').length,
        missingMicros: foodItems.filter(f => !f.iron && !f.zinc && !f.vitaminB12).length
    }), [foodItems, recipes]);

    const databaseStatistics = useMemo(() => {
        if (activeTab !== 'stats' || !mealEntries.length) return null;

        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // 1. Frequency Counter
        const freqMap: Record<string, { name: string; count: number; calories: number }> = {};
        const catMap: Record<string, { calories: number; protein: number; count: number }> = {};
        const trendMap: Record<string, number> = {};

        // Pre-fill trend map with last 30 days
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const key = d.toISOString().split('T')[0];
            trendMap[key] = 0;
        }

        mealEntries.forEach(entry => {
            const entryDate = new Date(entry.createdAt);
            const dateKey = entry.createdAt.split('T')[0];

            // Counts for trends (last 30 days)
            if (entryDate >= thirtyDaysAgo && trendMap[dateKey] !== undefined) {
                trendMap[dateKey]++;
            }

            // Expand entries by pieces/items
            entry.items.forEach(item => {
                if (item.type !== 'foodItem') return;

                const foodId = item.referenceId;
                if (!foodId) return;

                const food = foodItems.find(f => f.id === foodId);
                if (!food) return;

                // Update Frequency
                if (!freqMap[foodId]) {
                    freqMap[foodId] = { name: food.name, count: 0, calories: 0 };
                }

                // Multiplier: servings * (1 in case of pcs, else weightGrams/100)
                let multiplier = item.servings || 1;
                if (item.weightGrams) {
                    multiplier = item.weightGrams / 100;
                } else if (food.defaultPortionGrams && food.unit !== 'pcs') {
                    multiplier = (multiplier * food.defaultPortionGrams) / 100;
                }

                freqMap[foodId].count += 1;
                freqMap[foodId].calories += Math.round(food.calories * multiplier);

                // Update Category Stats
                const cat = food.category || 'other';
                if (!catMap[cat]) {
                    catMap[cat] = { calories: 0, protein: 0, count: 0 };
                }
                catMap[cat].calories += Math.round(food.calories * multiplier);
                catMap[cat].protein += Math.round(food.protein * multiplier);
                catMap[cat].count += 1;
            });
        });

        const topItems = Object.values(freqMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const categoryStats = Object.entries(catMap)
            .map(([cat, val]) => ({
                name: CATEGORY_LABELS[cat as FoodCategory] || cat,
                value: val.calories,
                protein: val.protein,
                count: val.count
            }))
            .sort((a, b) => b.value - a.value);

        const trends = Object.entries(trendMap)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Derived summary statistics
        const totalLoggedTotal = mealEntries.length;
        const uniqueItemsCount = Object.keys(freqMap).length;
        const mostLoggedItem = topItems[0]?.name || '-';
        const topCategory = categoryStats[0]?.name || '-';

        // Diversity Score: Unique items / total entries (last 30 days approximation)
        const diversityValue = totalLoggedTotal > 0 ? (uniqueItemsCount / totalLoggedTotal).toFixed(2) : '0';

        return {
            topItems,
            categoryStats,
            trends,
            summary: {
                totalLoggedTotal,
                uniqueItemsCount,
                mostLoggedItem,
                topCategory,
                diversityValue
            }
        };
    }, [activeTab, mealEntries, foodItems]);

    const brandStats = useMemo(() => {
        if (activeTab !== 'brands') return null;
        const stats: Record<string, { count: number; products: number; lastUsed: string; topProduct: string; topProductCount: number }> = {};

        // Initialize with products
        foodItems.forEach(item => {
            const brand = item.brand ? item.brand.trim() : 'Okänt märke';
            if (!brand) return;

            if (!stats[brand]) {
                stats[brand] = { count: 0, products: 0, lastUsed: '', topProduct: '', topProductCount: -1 };
            }
            stats[brand].products++;

            const freq = itemFrequencyMap[item.id] || 0;
            stats[brand].count += freq;

            if (freq > stats[brand].topProductCount) {
                stats[brand].topProductCount = freq;
                stats[brand].topProduct = item.name;
            }
        });

        // Usage dates
        mealEntries.forEach(entry => {
            entry.items.forEach(mi => {
                if (mi.type === 'foodItem' && mi.referenceId) {
                    const item = foodItems.find(f => f.id === mi.referenceId);
                    if (item) {
                        const brand = item.brand ? item.brand.trim() : 'Okänt märke';
                        if (stats[brand]) {
                            if (!stats[brand].lastUsed || entry.date > stats[brand].lastUsed) {
                                stats[brand].lastUsed = entry.date;
                            }
                        }
                    }
                }
            });
        });

        return Object.entries(stats)
            .map(([name, data]) => ({ name, ...data }))
            .filter(b => b.products > 0)
            .sort((a, b) => b.count - a.count);
    }, [activeTab, foodItems, mealEntries, itemFrequencyMap]);

    const myContentData = useMemo(() => {
        if (activeTab !== 'my-content') return null;

        // 1. My Food Items
        const myFoods = foodItems.filter(f => f.createdBy);

        // 2. My Quick Meals with Stats
        const qmStats = new Map<string, { count: number; lastUsed: string }>();
        mealEntries.forEach(entry => {
            entry.items.forEach(item => {
                if ((item.type as any) === 'quickMeal' && item.referenceId) {
                    if (!qmStats.has(item.referenceId)) {
                        qmStats.set(item.referenceId, { count: 1, lastUsed: entry.date });
                    } else {
                        const s = qmStats.get(item.referenceId)!;
                        s.count++;
                        if (entry.date > s.lastUsed) s.lastUsed = entry.date;
                    }
                }
            });
        });

        const myQuickMeals = (quickMeals || []).map(qm => ({
            ...qm,
            stats: qmStats.get(qm.id) || { count: 0, lastUsed: '-' }
        })).filter(qm => showArchivedQuickMeals ? qm.isArchived : !qm.isArchived);

        // 3. Estimations from history
        const estimateMap = new Map<string, any>();
        mealEntries.forEach(entry => {
            entry.items.forEach(item => {
                if (item.type === 'estimate' && item.estimateDetails) {
                    const key = `${item.estimateDetails.name}-${item.estimateDetails.caloriesAvg}`;
                    if (!estimateMap.has(key)) {
                        estimateMap.set(key, {
                            ...item.estimateDetails,
                            count: 1,
                            lastUsed: entry.date
                        });
                    } else {
                        const existing = estimateMap.get(key);
                        existing.count++;
                        if (entry.date > existing.lastUsed) {
                            existing.lastUsed = entry.date;
                        }
                    }
                }
            });
        });
        const estimations = Array.from(estimateMap.values()).sort((a, b) => b.count - a.count);

        return { myFoods, myQuickMeals, estimations };
    }, [activeTab, foodItems, quickMeals, mealEntries]);


    const handleOpenForm = (item?: FoodItem, category?: FoodCategory) => {
        if (item) {
            setEditingItem(item);
        } else {
            setEditingItem(null);
        }
        if (category && !item) {
            setSelectedCategory(category);
        }
        setIsFormOpen(true);
    };

    const handleOpenQuickMealEdit = (qm: QuickMeal) => {
        setEditingQuickMeal(qm);
        setIsQuickMealEditOpen(true);
    };

    const handleArchiveQuickMeal = (e: React.MouseEvent, qm: QuickMeal) => {
        e.stopPropagation();
        updateQuickMeal(qm.id, { isArchived: !qm.isArchived });
        setToastMessage(qm.isArchived ? `"${qm.name}" återställd.` : `"${qm.name}" arkiverad.`);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingItem(null);
    };

    // --- DELETION LOGIC ---

    const handleDeleteClick = (e: React.MouseEvent, item: FoodItem) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            // Instant Delete (Quarantine)
            deleteFoodItem(item.id);
            setToastMessage(`"${item.name}" flyttad till karantän (3 mån).`);
        } else {
            // Modal Confirmation
            setDeleteItem(item);
        }
    };

    const handleConfirmDelete = () => {
        if (deleteItem) {
            deleteFoodItem(deleteItem.id);
            setDeleteItem(null);
            setToastMessage(`"${deleteItem.name}" flyttad till karantän.`);
        }
    };

    // Handle inline cell edit
    const handleCellBlur = (item: FoodItem, field: keyof FoodItemFormData, value: string | number | boolean) => {
        updateFoodItem(item.id, { [field]: value });
    };

    const getCO2Class = (co2: number) => {
        if (co2 >= 5) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        if (co2 >= 2) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (co2 > 0) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        return 'text-slate-500 bg-slate-800/50 border-transparent';
    };

    const getImgSrc = (url: string) => {
        if (!url) return '';
        if (url.startsWith('uploads/')) return `/${url}`;
        return url;
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleDateString('sv-SE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getCreatorName = (userId?: string) => {
        if (!userId) return '-';
        return users.find(u => u.id === userId)?.name || 'Anonym';
    };

    return (
        <div className="database-page">
            {editingQuickMeal && (
                <QuickMealEditModal
                    isOpen={isQuickMealEditOpen}
                    onClose={() => setIsQuickMealEditOpen(false)}
                    quickMeal={editingQuickMeal}
                />
            )}

            <ConfirmModal
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={handleConfirmDelete}
                title="Ta bort råvara?"
                message={`Är du säker på att du vill ta bort "${deleteItem?.name}"? Den hamnar i karantän i 3 månader innan den raderas permanent.`}
                confirmLabel="Kasta i papperskorgen"
                isDestructive={true}
            />

            {/* Toast Notification */}
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 20, x: '-50%' }}
                        className="fixed bottom-6 left-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl border border-slate-700 flex items-center gap-3 font-medium"
                    >
                        <span className="text-emerald-400 text-xl">📦</span>
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {!headless && (
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Matdatabas</h1>
                        <p className="text-slate-400">Hantera råvaror och näringsvärden</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                            <button
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-bold ${activeTab === 'items' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setActiveTab('items')}
                            >
                                🥗 Råvaror
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-bold ${activeTab === 'my-content' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setActiveTab('my-content')}
                            >
                                ✨ Mina Tillägg
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-bold ${activeTab === 'activity-log' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setActiveTab('activity-log')}
                            >
                                📋 Aktivitetslogg
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-bold ${activeTab === 'stats' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setActiveTab('stats')}
                            >
                                📈 Statistik
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-bold ${activeTab === 'brands' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setActiveTab('brands')}
                            >
                                🏷️ Märken
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg transition-all text-sm font-bold ${activeTab === 'purchases' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setActiveTab('purchases')}
                            >
                                🛒 Inköp
                            </button>
                        </div>
                        <div className="w-[1px] bg-slate-800 mx-2" />
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                            <button
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setViewMode('grid')}
                                title="Rutnät"
                            >
                                ⊞
                            </button>
                            <button
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                onClick={() => setViewMode('list')}
                                title="Lista"
                            >
                                ☰
                            </button>
                        </div>
                        <button className="btn btn-primary shadow-lg shadow-emerald-900/20" onClick={() => handleOpenForm()}>
                            + Lägg till
                        </button>
                    </div>
                </header>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Totala Råvaror" value={stats.totalFoods} icon="🍎" />
                <StatCard label="Totala Recept" value={stats.totalRecipes} icon="📖" />
                <StatCard label="Ofullständiga" value={stats.incompleteFoods} icon="🔴" color="text-red-400" />
                <StatCard label="Saknar Mikros" value={stats.missingMicros} icon="🟡" color="text-amber-400" />
            </div>

            {activeTab === 'my-content' && myContentData && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header Summary */}
                    <div className="flex flex-wrap gap-4">
                        <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex-1 min-w-[200px]">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Mina Råvaror</div>
                            <div className="text-2xl font-black text-white">{myContentData.myFoods.length}</div>
                        </div>
                        <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex-1 min-w-[200px]">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Quick Meals</div>
                            <div className="text-2xl font-black text-emerald-400">{myContentData.myQuickMeals.length}</div>
                        </div>
                        <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex-1 min-w-[200px]">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Egna Estimeringar</div>
                            <div className="text-2xl font-black text-amber-400">{myContentData.estimations.length}</div>
                        </div>
                    </div>

                    {/* Estimations Section */}
                    {myContentData.estimations.length > 0 && (
                        <section>
                            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                <span>🧠</span> Sparade Estimeringar
                                <span className="text-xs font-medium text-slate-500">(från din historik)</span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myContentData.estimations.map((est, idx) => (
                                    <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl hover:border-slate-600 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">{est.name}</div>
                                            <div className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-black text-slate-500">x{est.count}</div>
                                        </div>
                                        <div className="flex gap-4 text-sm font-mono">
                                            <div className="text-emerald-400">{est.caloriesAvg} kcal</div>
                                            {est.protein && <div className="text-blue-400">{est.protein}g P</div>}
                                            <div className="text-slate-500 text-[10px] self-center ml-auto italic">Senast {est.lastUsed}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Quick Meals Section */}
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <span>⚡</span> Quick Meals
                            </h3>
                            <button
                                onClick={() => setShowArchivedQuickMeals(!showArchivedQuickMeals)}
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${showArchivedQuickMeals ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                            >
                                {showArchivedQuickMeals ? 'Visa Aktiva' : 'Visa Arkiverade'}
                            </button>
                        </div>
                        {myContentData.myQuickMeals.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myContentData.myQuickMeals.map((qm) => (
                                    <div key={qm.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-slate-600 transition-colors group relative overflow-hidden flex flex-col">
                                        <div className="absolute top-0 right-0 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest border-b border-l border-emerald-500/10 rounded-bl-xl">Quick Meal</div>
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors text-lg pr-12">{qm.name}</div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleOpenQuickMealEdit(qm as any)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white" title="Redigera">✏️</button>
                                                <button onClick={(e) => handleArchiveQuickMeal(e, qm as any)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white" title={qm.isArchived ? "Återställ" : "Arkivera"}>
                                                    {qm.isArchived ? '📥' : '📦'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                            <div className="flex items-center gap-1">
                                                <span className="text-emerald-500/50">📊</span>
                                                {(qm as any).stats.count} loggningar
                                            </div>
                                            { (qm as any).stats.lastUsed !== '-' && (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-emerald-500/50">📅</span>
                                                    Senast {(qm as any).stats.lastUsed}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 flex-1">
                                            {qm.items.map((item, i) => (
                                                <div key={i} className="text-[11px] text-slate-400 flex justify-between items-center bg-slate-800/30 px-2 py-1 rounded-lg">
                                                    <span className="truncate pr-2">
                                                        {item.type === 'foodItem' ? foodItems.find(f => f.id === item.referenceId)?.name : item.estimateDetails?.name || 'Okänd'}
                                                    </span>
                                                    <span className="font-mono text-slate-500 shrink-0">{item.servings}{item.type === 'foodItem' ? 'g' : ' port'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-3xl text-slate-600">
                                {showArchivedQuickMeals ? 'Inga arkiverade Quick Meals hittades.' : 'Inga aktiva Quick Meals hittades.'}
                            </div>
                        )}
                    </section>

                    {/* My Food Items Section */}
                    <section>
                        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <span>🥗</span> Mina Råvaror
                        </h3>
                        {myContentData.myFoods.length === 0 ? (
                            <div className="p-8 text-center bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500">
                                Du har inte lagt till några egna råvaror än.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {myContentData.myFoods.map(item => (
                                    <div key={item.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl hover:border-slate-600 transition-colors group" onClick={() => setDetailItem(item)}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate pr-2">{item.name}</div>
                                            <div className="font-mono text-emerald-400 font-bold text-sm whitespace-nowrap">{item.calories}</div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 flex justify-between items-end">
                                            <span>{CATEGORY_LABELS[item.category]}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="text-slate-400 hover:text-white" onClick={(e) => { e.stopPropagation(); handleOpenForm(item); }}>✏️</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'brands' && brandStats && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-white">Varumärken</h3>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                {brandStats.length} st hittades
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-900/80 text-[10px] uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="p-4">Märke</th>
                                        <th className="p-4 text-center">Produkter</th>
                                        <th className="p-4 text-center">Loggningar</th>
                                        <th className="p-4">Populärast</th>
                                        <th className="p-4 text-right">Senast använd</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {brandStats.map((brand) => (
                                        <tr key={brand.name} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 font-bold text-slate-200">
                                                {brand.name === 'Okänt märke' ? <span className="text-slate-600 italic">{brand.name}</span> : brand.name}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="bg-slate-800 px-2 py-1 rounded text-xs font-bold">{brand.products}</span>
                                            </td>
                                            <td className="p-4 text-center font-mono text-emerald-400 font-bold">
                                                {brand.count}
                                            </td>
                                            <td className="p-4">
                                                {brand.topProduct ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate max-w-[150px]">{brand.topProduct}</span>
                                                        <span className="text-[10px] text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded">
                                                            {brand.topProductCount}x
                                                        </span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="p-4 text-right text-xs font-mono">
                                                {brand.lastUsed ? brand.lastUsed : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'activity-log' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Totala Åtgärder</div>
                            <div className="text-2xl font-black text-white">{databaseActions.length}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Skapade</div>
                            <div className="text-2xl font-black text-emerald-400">{databaseActions.filter(a => a.actionType === 'CREATE').length}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Uppdaterade</div>
                            <div className="text-2xl font-black text-blue-400">{databaseActions.filter(a => a.actionType === 'UPDATE').length}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Borttagna</div>
                            <div className="text-2xl font-black text-rose-400">{databaseActions.filter(a => a.actionType === 'DELETE').length}</div>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 text-sm font-black text-slate-400 uppercase tracking-widest">
                            Senaste Aktiviteter
                        </div>
                        <div className="divide-y divide-slate-800/50 max-h-[500px] overflow-y-auto">
                            {databaseActions.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    <span className="text-4xl mb-4 block opacity-50">📋</span>
                                    Inga ändringar loggade ännu. Prova att lägga till eller redigera en råvara!
                                </div>
                            ) : (
                                databaseActions.slice(0, 50).map((action) => (
                                    <div key={action.id} className="p-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${action.actionType === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400' :
                                            action.actionType === 'UPDATE' ? 'bg-blue-500/10 text-blue-400' :
                                                'bg-rose-500/10 text-rose-400'
                                            }`}>
                                            {action.actionType === 'CREATE' ? '➕' : action.actionType === 'UPDATE' ? '✏️' : '🗑️'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-200 truncate">
                                                {action.entityName || action.entityId.slice(0, 8)}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 bg-slate-800 rounded text-[9px] uppercase font-black">{action.entityType.replace('_', ' ')}</span>
                                                <span>•</span>
                                                <span>{action.actionType}</span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-600 whitespace-nowrap">
                                            {new Date(action.timestamp).toLocaleString('sv-SE', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'purchases' && (
                <motion.div
                    key="purchases"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-3">
                            🛒 Inköpshistorik
                            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono uppercase tracking-widest">{purchaseLogs.length} poster</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {purchaseLogs.sort((a, b) => b.date.localeCompare(a.date)).map(log => {
                            const food = foodItems.find(f => f.id === log.foodItemId);
                            const totalQty = log.quantity * log.packageSize;
                            const unitPrice = log.price / totalQty;
                            const displayUnitPrice = log.unit === 'g' || log.unit === 'ml' 
                                ? `${(unitPrice * 1000).toFixed(2)} kr/kg`
                                : `${unitPrice.toFixed(2)} kr/${log.unit}`;

                            return (
                                <div key={log.id} className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 hover:border-blue-500/30 transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-xl">
                                                {food ? (food.category === 'protein' ? '🥩' : food.category === 'vegetables' ? '🥦' : '🥬') : '📦'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white group-hover:text-blue-400 transition-colors">
                                                    {food?.name || 'Okänd råvara'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-widest">
                                                    {log.date} {log.store && `• ${log.store}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-black text-white">{log.price} kr</div>
                                            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">{displayUnitPrice}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-3 border-top border-white/5 text-xs text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-300">
                                                {log.quantity}st à {log.packageSize}{log.unit}
                                            </span>
                                        </div>
                                        {food && (
                                            <button 
                                                onClick={() => setDetailItem(food)}
                                                className="text-slate-500 hover:text-white transition-colors"
                                            >
                                                Visa råvara →
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {purchaseLogs.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-slate-900/30 rounded-3xl border border-dashed border-white/5">
                                <div className="text-4xl mb-4">🛒</div>
                                <h3 className="text-white font-bold mb-1">Inga sparade inköp</h3>
                                <p className="text-slate-500 text-sm">Logga ditt första köp via Omniboxen genom att skriva t.ex. "köp tofu 25kr"</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {activeTab === 'stats' && databaseStatistics ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Summary Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Mest Loggade</div>
                            <div className="text-xl font-black text-white">{databaseStatistics.summary.mostLoggedItem}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Största Kategori</div>
                            <div className="text-xl font-black text-emerald-400">{databaseStatistics.summary.topCategory}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Variations-index</div>
                            <div className="text-xl font-black text-white">{databaseStatistics.summary.diversityValue} <span className="text-xs text-slate-500">unika/totalt</span></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Frequency Bar Chart */}
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl flex flex-col min-h-[400px]">
                            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                <span>🏆</span> Topp 10 Råvaror <span className="text-xs font-medium text-slate-500">(frekvens)</span>
                            </h3>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={databaseStatistics.topItems} layout="vertical" margin={{ left: 20, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={100} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                            itemStyle={{ color: '#10b981' }}
                                        />
                                        <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Category Pie Chart */}
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl flex flex-col min-h-[400px]">
                            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                <span>🥧</span> Kategorifördelning <span className="text-xs font-medium text-slate-500">(kcal)</span>
                            </h3>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={databaseStatistics.categoryStats}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {databaseStatistics.categoryStats.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={[
                                                    '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
                                                    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
                                                ][index % 8]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Trend Area Chart */}
                        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl flex flex-col lg:col-span-2 min-h-[350px]">
                            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                <span>📅</span> Loggningsaktivitet <span className="text-xs font-medium text-slate-500">(senaste 30 dagarna)</span>
                            </h3>
                            <div className="flex-1">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={databaseStatistics.trends}>
                                        <defs>
                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            fontSize={10}
                                            tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')}
                                        />
                                        <YAxis stroke="#64748b" fontSize={10} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#colorCount)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md py-4 -mx-4 px-4 md:mx-0 md:px-0">
                        <div className="relative flex-1 group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors">🔍</span>
                            <input
                                type="text"
                                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                                placeholder="Sök efter råvara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <select
                            className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 md:w-64 cursor-pointer hover:bg-slate-900 transition-colors"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as FoodCategory | 'all')}
                        >
                            <option value="all">Alla kategorier</option>
                            {Object.entries(CATEGORY_GROUPS).map(([group, keys]) => (
                                <optgroup key={group} label={group}>
                                    {keys.map(key => (
                                        <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <select
                            className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 md:w-48 cursor-pointer hover:bg-slate-900 transition-colors"
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'user')}
                        >
                            <option value="all">Alla källor</option>
                            <option value="user">👤 Bara våra egna</option>
                        </select>
                        {headless && (
                            <button className="btn btn-primary whitespace-nowrap" onClick={() => handleOpenForm()}>
                                + Ny Råvara
                            </button>
                        )}
                    </div>

                    {searchQuery && (
                        <div className="mb-6 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg inline-flex items-center gap-2 text-sm text-emerald-300/80">
                            <span>🔍</span>
                            <span>
                                {filteredItems.length === 0
                                    ? 'Inga träffar'
                                    : filteredItems.length === 100
                                        ? '100+ träffar (visar topp 100)'
                                        : `${filteredItems.length} träffar`
                                }
                                {' för "'}
                                <strong className="text-white">{searchQuery}</strong>
                                {'"'}
                            </span>
                        </div>
                    )}

                    {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
                            <span className="text-6xl mb-4 opacity-50">📦</span>
                            <p className="text-lg font-medium mb-4">Inga råvaror hittades</p>
                            <button className="btn btn-secondary" onClick={() => handleOpenForm()}>
                                Lägg till din första råvara
                            </button>
                        </div>
                    ) : viewMode === 'list' ? (
                        /* LIST VIEW - Modern CSS Grid Table */
                        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                            {/* Header */}
                            <div className="flex flex-row gap-4 p-4 border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                                <div className="w-10 shrink-0">Bild</div>
                                <div className="flex-1 min-w-0 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                                    Råvara {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-[7.5rem] shrink-0 hidden md:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('category')}>
                                    Kategori {sortConfig?.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-16 shrink-0 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('calories')}>
                                    Kcal {sortConfig?.key === 'calories' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-12 shrink-0 text-right hidden sm:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('protein')}>
                                    Prot {sortConfig?.key === 'protein' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-12 shrink-0 text-right hidden sm:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('carbs')}>
                                    Kolh {sortConfig?.key === 'carbs' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-12 shrink-0 text-right hidden sm:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('fat')}>
                                    Fett {sortConfig?.key === 'fat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-16 shrink-0 text-center hidden lg:block">Pris</div>
                                <div className="w-16 shrink-0 text-center hidden lg:block">Enhet</div>
                                <div className="w-16 shrink-0 text-center hidden xl:block">Klimat</div>
                                <div className="w-20 shrink-0 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('frequency')}>
                                    Loggningar {sortConfig?.key === 'frequency' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-32 shrink-0 hidden xl:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('creator')}>
                                    Skapad av {sortConfig?.key === 'creator' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-28 shrink-0 hidden 2xl:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                                    Datum {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-24 shrink-0 flex justify-end"></div>
                            </div>

                            <div className="divide-y divide-slate-800/50">
                                <AnimatePresence initial={false}>
                                    {filteredItems.map((item: FoodItem) => (
                                        <motion.div
                                            key={item.id}
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                                            className="flex flex-row gap-4 p-4 hover:bg-slate-800/50 transition-colors items-center group"
                                        >
                                            <div className="w-10 shrink-0 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                                                {item.imageUrl && (
                                                    <img src={getImgSrc(item.imageUrl)} alt="" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div
                                                className="flex-1 min-w-0 cursor-pointer"
                                                onClick={() => handleOpenForm(item)}
                                            >
                                                <div className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">{item.name}</div>
                                                {item.brand && <div className="text-xs text-slate-500 truncate">{item.brand}</div>}
                                            </div>
                                            <div className="w-[7.5rem] shrink-0 hidden md:block">
                                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                                                    {CATEGORY_LABELS[item.category]}
                                                </span>
                                            </div>
                                            <div className="w-16 shrink-0 text-right font-mono text-emerald-400 font-bold">{item.calories}</div>
                                            <div className="w-12 shrink-0 text-right font-mono text-slate-400 hidden sm:block">{item.protein}</div>
                                            <div className="w-12 shrink-0 text-right font-mono text-slate-400 hidden sm:block">{item.carbs}</div>
                                            <div className="w-12 shrink-0 text-right font-mono text-slate-400 hidden sm:block">{item.fat}</div>
                                            <div className="w-16 shrink-0 text-center hidden lg:block">
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent text-right text-sm border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                                                    value={item.pricePerUnit || 0}
                                                    onChange={(e) => handleCellBlur(item, 'pricePerUnit', Number(e.target.value))}
                                                    placeholder="-"
                                                />
                                            </div>
                                            <div className="w-16 shrink-0 text-center hidden lg:block">
                                                <select
                                                    className="w-full bg-transparent text-xs text-slate-500 border-none focus:ring-0 cursor-pointer hover:text-white"
                                                    value={item.unit}
                                                    onChange={(e) => handleCellBlur(item, 'unit', e.target.value)}
                                                >
                                                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                                                        <option key={key} value={key}>{key}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-16 shrink-0 text-center hidden xl:block">
                                                {item.co2PerUnit ? (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCO2Class(item.co2PerUnit)}`}>
                                                        {item.co2PerUnit}
                                                    </span>
                                                ) : <span className="text-slate-700">-</span>}
                                            </div>
                                            <div className="w-20 shrink-0 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-400 border border-slate-700">
                                                    {itemFrequencyMap[item.id] || 0}
                                                </span>
                                            </div>
                                            <div className="w-32 shrink-0 hidden xl:block text-slate-500 text-[10px] font-medium truncate max-w-[100px]">
                                                <span className="text-slate-600 mr-1">Av:</span>
                                                {getCreatorName(item.createdBy)}
                                            </div>
                                            <div className="w-28 shrink-0 hidden 2xl:block text-slate-500 text-[10px] whitespace-nowrap">
                                                {formatDate(item.createdAt)}
                                            </div>
                                            <div className="w-24 shrink-0 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" onClick={() => setDetailItem(item)} title="Detaljer">
                                                    📋
                                                </button>
                                                <button
                                                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                    onClick={(e) => handleDeleteClick(e, item)}
                                                    title="Ta bort (Ctrl+Klick för snabb)"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    ) : (
                        /* GRID VIEW - Enhanced Cards */
                        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <AnimatePresence>
                                {filteredItems.map((item: FoodItem) => (
                                    <motion.div
                                        layout
                                        key={item.id}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-600 transition-all group shadow-lg hover:shadow-xl hover:-translate-y-1"
                                    >
                                        {item.imageUrl && (
                                            <div className="h-40 w-full overflow-hidden bg-slate-950 relative">
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60" />
                                                <img
                                                    src={getImgSrc(item.imageUrl)}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all group-hover:scale-105"
                                                />
                                                <span className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
                                                    {CATEGORY_LABELS[item.category]}
                                                </span>
                                                <div className="absolute bottom-3 left-3 px-2 py-1 bg-emerald-500/80 backdrop-blur rounded text-[10px] font-black text-white shadow-lg border border-white/20">
                                                    {itemFrequencyMap[item.id] || 0} loggningar
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors leading-tight">
                                                        {item.name}
                                                    </h3>
                                                    {item.brand && <p className="text-xs text-slate-500 font-medium">{item.brand}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-emerald-400 font-bold font-mono">{item.calories}</span>
                                                    <span className="text-[10px] text-slate-600 uppercase font-bold">kcal</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                                <div className="text-center">
                                                    <span className="block text-xs text-slate-400 font-mono">{item.protein}g</span>
                                                    <span className="text-[9px] text-slate-600 uppercase font-bold">Prot</span>
                                                </div>
                                                <div className="text-center border-l border-slate-800/50">
                                                    <span className="block text-xs text-slate-400 font-mono">{item.carbs}g</span>
                                                    <span className="text-[9px] text-slate-600 uppercase font-bold">Kolh</span>
                                                </div>
                                                <div className="text-center border-l border-slate-800/50">
                                                    <span className="block text-xs text-slate-400 font-mono">{item.fat}g</span>
                                                    <span className="text-[9px] text-slate-600 uppercase font-bold">Fett</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        <span className="text-[10px] text-slate-300 font-bold truncate">
                                                            {getCreatorName(item.createdBy)}
                                                        </span>
                                                    </div>
                                                    <span className="block text-[9px] text-slate-600">
                                                        {formatDate(item.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setDetailItem(item)} title="Detaljer">📋</button>
                                                    <button className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" onClick={() => handleOpenForm(item)} title="Redigera">✏️</button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </>
            )}

            {/* Modal Form - Redesigned */}
            <FoodItemFormModal
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                editingItem={editingItem}
                initialCategory={(searchParams.get('category') as FoodCategory) || undefined}
            />

            {
                detailItem && (
                    <FoodItemDetailModal
                        item={detailItem}
                        onClose={() => setDetailItem(null)}
                        frequency={itemFrequencyMap[detailItem.id] || 0}
                        categoryLabels={CATEGORY_LABELS}
                        unitLabels={UNIT_LABELS}
                        creatorName={getCreatorName(detailItem.createdBy)}
                    />
                )
            }
        </div>
    );
}

const StatCard: React.FC<{ label: string, value: number, icon: string, color?: string }> = ({ label, value, icon, color = "text-white" }) => (
    <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl flex items-center justify-between shadow-lg">
        <div>
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl md:text-3xl font-black ${color}`}>{value}</div>
        </div>
        <div className="text-2xl md:text-3xl opacity-50">{icon}</div>
    </div>
);

const MacroInput: React.FC<{ label: string, value: number, onChange: (v: number) => void, suffix: string, step?: number }> = ({ label, value, onChange, suffix, step = 1 }) => (
    <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</label>
        <div className="relative">
            <input
                type="number"
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-right pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-600 pointer-events-none uppercase">{suffix}</span>
        </div>
    </div>
);

export default DatabasePage;
