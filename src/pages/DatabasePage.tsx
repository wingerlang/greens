import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext.tsx';
import { useSearchParams } from 'react-router-dom';
import {
    type FoodItem,
    type FoodItemFormData,
    type Unit,
    type FoodCategory,
    type FoodStorageType,
    CATEGORY_LABELS,
    UNIT_LABELS,
} from '../models/types.ts';
import { normalizeText } from '../utils/formatters.ts';
import { parseNutritionText, extractFromJSONLD, cleanProductName, extractBrand, extractPackagingWeight } from '../utils/nutrition/index.ts';
import { ConfirmModal } from '../components/ui/ConfirmModal.tsx';
import { FoodItemDetailModal } from '../components/database/FoodItemDetailModal.tsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import './DatabasePage.css';

const STORAGE_TYPE_LABELS: Record<FoodStorageType, string> = {
    fresh: '🥬 Färsk',
    pantry: '🏪 Skafferi',
    frozen: '❄️ Fryst',
};

const CATEGORY_GROUPS: Record<string, FoodCategory[]> = {
    'Grönt & Frukt': ['vegetables', 'fruits'],
    'Protein & Baljväxter': ['protein', 'legumes', 'dairy-alt', 'nuts-seeds', 'supplements'],
    'Skafferi & Bas': ['grains', 'cereals', 'baking', 'spices', 'condiments', 'sauces', 'sweeteners', 'fats'],
    'Dryck': ['beverages'],
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
type DatabaseTab = 'items' | 'my-content' | 'activity-log' | 'stats' | 'brands';

export function DatabasePage({ headless = false }: { headless?: boolean }) {
    const { foodItems, recipes, mealEntries, quickMeals, addFoodItem, updateFoodItem, deleteFoodItem, foodAliases, updateFoodAlias, users, currentUser, databaseActions } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const hasAutoOpened = useRef(false);

    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<FoodItem | null>(null);
    const [deleteItem, setDeleteItem] = useState<FoodItem | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Form State
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [formData, setFormData] = useState<FoodItemFormData>(EMPTY_FORM);
    const [variants, setVariants] = useState<any[]>([]);
    const [alias, setAlias] = useState('');

    // Search/Filter State
    const [isParsing, setIsParsing] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [activeTab, setActiveTab] = useState<DatabaseTab>('items');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'user'>('all');

    // Drag and drop state
    const [isDragging, setIsDragging] = useState(false);

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

            if (nameLower === query || brandLower === query) {
                exactMatches.push(item);
            } else if (nameLower.startsWith(query) || brandLower.startsWith(query)) {
                startsWithMatches.push(item);
            } else if (nameLower.includes(query) || (brandLower && brandLower.includes(query)) || descLower.includes(query)) {
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
            setTimeout(() => {
                handleOpenForm();
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

        // 2. My Quick Meals
        // quickMeals are already user-owned in context usually, but we check just in case
        const myQuickMeals = quickMeals || [];

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


    const handleOpenForm = (item?: FoodItem) => {
        if (item) {
            setEditingItem(item);
            setAlias(foodAliases[item.id] || '');
            setFormData({
                name: item.name,
                brand: item.brand || '',
                imageUrl: item.imageUrl || '',
                packageWeight: item.packageWeight || 0,
                defaultPortionGrams: item.defaultPortionGrams || 0,
                description: item.description || '',
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                fiber: item.fiber || 0,
                unit: item.unit,
                category: item.category,
                storageType: item.storageType || 'pantry',
                pricePerUnit: item.pricePerUnit || 0,
                co2PerUnit: item.co2PerUnit || 0,
                containsGluten: item.containsGluten || false,
                iron: item.iron || 0,
                calcium: item.calcium || 0,
                zinc: item.zinc || 0,
                vitaminB12: item.vitaminB12 || 0,
                isCompleteProtein: item.isCompleteProtein || false,
                missingAminoAcids: item.missingAminoAcids || [],
                complementaryCategories: item.complementaryCategories || [],
                proteinCategory: item.proteinCategory,
                seasons: item.seasons || [],
                ingredients: item.ingredients || '',
                extendedDetails: {
                    ...item.extendedDetails,
                    caffeine: item.extendedDetails?.caffeine || 0,
                    alcohol: item.extendedDetails?.alcohol || 0
                }
            });
            setVariants(item.variants || []);
        } else {
            setEditingItem(null);
            setAlias('');
            setFormData(EMPTY_FORM);
            setVariants([]);
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingItem(null);
        setAlias('');
        setFormData(EMPTY_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // const submission = { ...formData, variants }; // unused?
        if (editingItem) {
            updateFoodItem(editingItem.id, formData);
            if (alias !== (foodAliases[editingItem.id] || '')) {
                updateFoodAlias(editingItem.id, alias);
            }
        } else {
            addFoodItem(formData);
        }
        handleCloseForm();
    };

    // Variant Helper
    const addVariant = () => {
        const id = Math.random().toString(36).substring(2, 9);
        setVariants([...variants, { id, name: '', nutrition: {} }]);
    };

    const updateVariant = (id: string, updates: any) => {
        setVariants(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    };

    const removeVariant = (id: string) => {
        setVariants(prev => prev.filter(v => v.id !== id));
    };

    // --- SMART PARSING LOGIC ---
    const applyParsedData = (parsed: any) => {
        const knownBrands = Array.from(new Set(foodItems.map(f => f.brand).filter(Boolean))) as string[];
        let brand = parsed.brand || extractBrand(parsed.text || '', knownBrands);

        // Safety cleanup for pricing text
        if (brand) {
            brand = brand.replace(/\b(nuvarande|ordinarie|jmf|kampanj|medlems)\s*pris.*$/i, '').trim();
            brand = brand.replace(/\bpris\s*[:\d].*$/i, '').trim();
        }

        const packageWeight = parsed.packageWeight || extractPackagingWeight(parsed.text || '');

        setFormData(prev => ({
            ...prev,
            name: parsed.name || prev.name,
            brand: brand || prev.brand,
            packageWeight: packageWeight || prev.packageWeight,
            calories: parsed.calories !== undefined ? parsed.calories : prev.calories,
            protein: parsed.protein !== undefined ? parsed.protein : prev.protein,
            carbs: parsed.carbs !== undefined ? parsed.carbs : prev.carbs,
            fat: parsed.fat !== undefined ? parsed.fat : prev.fat,
            fiber: parsed.fiber !== undefined ? parsed.fiber : prev.fiber,
            ingredients: parsed.ingredients || prev.ingredients,
            defaultPortionGrams: parsed.defaultPortionGrams !== undefined ? parsed.defaultPortionGrams : prev.defaultPortionGrams,
        }));
    };

    const handleTextPaste = async (text: string) => {
        if (!text) return;
        setParseError(null);
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch) {
            const url = urlMatch[1];
            setIsParsing(true);
            try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch('/api/parse-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ url })
                });
                if (!res.ok) throw new Error('Kunde inte hämta sidan. Kontrollera URL:en.');
                const data = await res.json();
                let results = extractFromJSONLD(data.jsonLds || []);
                const textResults = parseNutritionText(data.text);
                const finalResults = {
                    ...results,
                    calories: results.calories ?? textResults.calories,
                    protein: results.protein ?? textResults.protein,
                    carbs: results.carbs ?? textResults.carbs,
                    fat: results.fat ?? textResults.fat,
                    fiber: results.fiber ?? textResults.fiber,
                    name: cleanProductName(data.title, data.h1) || results.name || textResults.name,
                    text: data.text
                };
                applyParsedData(finalResults);
            } catch (err) {
                setParseError(err instanceof Error ? err.message : 'Ett fel uppstod vid hämtning.');
            } finally {
                setIsParsing(false);
            }
            return;
        }
        const parsed = parseNutritionText(text);
        applyParsedData({ ...parsed, text });
    };

    const handleImageUpload = async (file: File) => {
        setIsParsing(true);
        setParseError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('auth_token');
            const uploadRes = await fetch('/api/upload-temp', {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData
            });
            if (!uploadRes.ok) throw new Error('Uppladdning misslyckades');
            const { tempUrl } = await uploadRes.json();
            setFormData(prev => ({ ...prev, imageUrl: tempUrl }));
            const parseRes = await fetch('/api/parse-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ tempUrl })
            });
            if (!parseRes.ok) throw new Error('OCR-analys misslyckades');
            const { text, parsed } = await parseRes.json();
            applyParsedData({ ...parsed, text });
        } catch (err) {
            setParseError(err instanceof Error ? err.message : 'Kunde inte läsa bilden.');
        } finally {
            setIsParsing(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            const file = e.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
                e.preventDefault();
                handleImageUpload(file);
                return;
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                handleImageUpload(file);
            }
        }
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
                    {myContentData.myQuickMeals.length > 0 && (
                        <section>
                            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                <span>⚡</span> Quick Meals
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {myContentData.myQuickMeals.map((qm) => (
                                    <div key={qm.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl hover:border-slate-600 transition-colors group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-2 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase tracking-tighter">Quick Meal</div>
                                        <div className="font-bold text-slate-200 mb-3 group-hover:text-emerald-400 transition-colors">{qm.name}</div>
                                        <div className="space-y-1">
                                            {qm.items.map((item, i) => (
                                                <div key={i} className="text-[10px] text-slate-500 flex justify-between">
                                                    <span>{item.type === 'foodItem' ? foodItems.find(f => f.id === item.referenceId)?.name : item.estimateDetails?.name || 'Okänd'}</span>
                                                    <span>{item.servings} x</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

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
                            <div className="grid grid-cols-[auto,1fr,auto,auto,auto,auto,auto,auto,auto,auto,auto,auto,auto,auto] gap-4 p-4 border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider items-center">
                                <div className="w-10">Bild</div>
                                <div className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                                    Råvara {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="hidden md:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('category')}>
                                    Kategori {sortConfig?.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('calories')}>
                                    Kcal {sortConfig?.key === 'calories' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="text-right hidden sm:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('protein')}>
                                    Prot {sortConfig?.key === 'protein' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="text-right hidden sm:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('carbs')}>
                                    Kolh {sortConfig?.key === 'carbs' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="text-right hidden sm:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('fat')}>
                                    Fett {sortConfig?.key === 'fat' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="text-center hidden lg:block">Pris</div>
                                <div className="text-center hidden lg:block">Enhet</div>
                                <div className="text-center hidden xl:block">Klimat</div>
                                <div className="text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('frequency')}>
                                    Loggningar {sortConfig?.key === 'frequency' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="hidden xl:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('creator')}>
                                    Skapad av {sortConfig?.key === 'creator' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="hidden 2xl:block cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date')}>
                                    Datum {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="w-20"></div>
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
                                            className="grid grid-cols-[auto,1fr,auto,auto,auto,auto,auto,auto,auto,auto,auto,auto,auto,auto] gap-4 p-4 hover:bg-slate-800/50 transition-colors items-center group"
                                        >
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
                                                {item.imageUrl && (
                                                    <img src={getImgSrc(item.imageUrl)} alt="" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div
                                                className="cursor-pointer min-w-0"
                                                onClick={() => handleOpenForm(item)}
                                            >
                                                <div className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">{item.name}</div>
                                                {item.brand && <div className="text-xs text-slate-500 truncate">{item.brand}</div>}
                                            </div>
                                            <div className="hidden md:block">
                                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                                                    {CATEGORY_LABELS[item.category]}
                                                </span>
                                            </div>
                                            <div className="text-right font-mono text-emerald-400 font-bold">{item.calories}</div>
                                            <div className="text-right font-mono text-slate-400 hidden sm:block">{item.protein}</div>
                                            <div className="text-right font-mono text-slate-400 hidden sm:block">{item.carbs}</div>
                                            <div className="text-right font-mono text-slate-400 hidden sm:block">{item.fat}</div>
                                            <div className="text-center hidden lg:block">
                                                <input
                                                    type="number"
                                                    className="w-16 bg-transparent text-right text-sm border-b border-transparent hover:border-slate-600 focus:border-emerald-500 focus:outline-none transition-colors"
                                                    value={item.pricePerUnit || 0}
                                                    onChange={(e) => handleCellBlur(item, 'pricePerUnit', Number(e.target.value))}
                                                    placeholder="-"
                                                />
                                            </div>
                                            <div className="text-center hidden lg:block">
                                                <select
                                                    className="bg-transparent text-xs text-slate-500 border-none focus:ring-0 cursor-pointer hover:text-white"
                                                    value={item.unit}
                                                    onChange={(e) => handleCellBlur(item, 'unit', e.target.value)}
                                                >
                                                    {Object.entries(UNIT_LABELS).map(([key, label]) => (
                                                        <option key={key} value={key}>{key}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="text-center hidden xl:block">
                                                {item.co2PerUnit ? (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCO2Class(item.co2PerUnit)}`}>
                                                        {item.co2PerUnit}
                                                    </span>
                                                ) : <span className="text-slate-700">-</span>}
                                            </div>
                                            <div className="text-center">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-400 border border-slate-700">
                                                    {itemFrequencyMap[item.id] || 0}
                                                </span>
                                            </div>
                                            <div className="hidden xl:block text-slate-500 text-[10px] font-medium truncate max-w-[100px]">
                                                <span className="text-slate-600 mr-1">Av:</span>
                                                {getCreatorName(item.createdBy)}
                                            </div>
                                            <div className="hidden 2xl:block text-slate-500 text-[10px] whitespace-nowrap">
                                                {formatDate(item.createdAt)}
                                            </div>
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            {isFormOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={handleCloseForm}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') handleCloseForm();
                        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                            e.preventDefault();
                            handleSubmit(e as any);
                        }
                    }}
                >
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-3xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                            <div>
                                <h2 className="text-xl font-black text-white">
                                    {editingItem ? '✏️ Redigera Råvara' : '➕ Lägg till Råvara'}
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono">ESC</kbd> stäng • <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono">Ctrl+S</kbd> spara
                                </p>
                            </div>
                            <button
                                onClick={handleCloseForm}
                                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">

                            {/* Smart Parser - Now with Image Support */}
                            <div
                                className={`bg-emerald-500/5 rounded-2xl p-4 border relative overflow-hidden transition-all ${isDragging ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-500/10'}`}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                            >
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500/70 mb-2 flex items-center gap-2">
                                    <span>✨</span> Smart Närings-tolkare
                                    {isParsing && (
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            <span className="text-[9px] normal-case font-medium text-emerald-500/80">Analyserar...</span>
                                        </div>
                                    )}
                                </label>

                                <div className="flex gap-4">
                                    <div className="flex-1 relative">
                                        <textarea
                                            className={`w-full bg-slate-900/50 border ${parseError ? 'border-red-500/30' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 min-h-[80px] resize-none transition-all`}
                                            placeholder="Klistra in näringstabell, URL eller BILD..."
                                            disabled={isParsing}
                                            onChange={(e) => handleTextPaste(e.target.value)}
                                            onPaste={handlePaste}
                                        />

                                        {/* Image Upload Button (Hidden input + Label) */}
                                        <div className="absolute right-2 bottom-2">
                                            <input
                                                type="file"
                                                id="img-upload"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                                            />
                                            <label
                                                htmlFor="img-upload"
                                                className="cursor-pointer p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg flex items-center justify-center transition-colors"
                                                title="Ladda upp bild"
                                            >
                                                📷
                                            </label>
                                        </div>
                                    </div>

                                    {/* Image Preview */}
                                    {formData.imageUrl && (
                                        <div className="w-24 h-24 shrink-0 bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden relative group">
                                            <img
                                                src={getImgSrc(formData.imageUrl)}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity"
                                                onClick={() => setFormData(p => ({ ...p, imageUrl: '' }))}
                                            >
                                                Ta bort
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {parseError && (
                                    <p className="text-[9px] text-red-400 mt-2 flex items-center gap-1">
                                        <span>⚠️</span> {parseError}
                                    </p>
                                )}
                                <p className="text-[9px] text-slate-500 mt-2 italic">
                                    Stödjer text, URL och bilder (OCR). Klistra in bild direkt (Ctrl+V) eller dra & släpp!
                                </p>

                                {isDragging && (
                                    <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-sm flex items-center justify-center border-2 border-emerald-500 border-dashed rounded-2xl pointer-events-none">
                                        <span className="text-emerald-300 font-bold animate-bounce">Släpp bilden här!</span>
                                    </div>
                                )}
                            </div>

                            {/* Primary: Name & Category */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Namn *
                                    </label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={formData.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setFormData({ ...formData, name });
                                            // Auto-suggest category logic (same as before)
                                        }}
                                        placeholder="t.ex. Kikärtor, Havregryn..."
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                        required
                                    />
                                </div>

                                {/* Alias Input */}
                                {editingItem && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">
                                            Personligt Alias
                                        </label>
                                        <input
                                            type="text"
                                            value={alias}
                                            onChange={(e) => setAlias(e.target.value)}
                                            placeholder={`t.ex. "Shake" (istället för ${formData.name})`}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-2">
                                            Detta namn visas i din logg och sökning istället för originalnamnet.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Märke (frivilligt)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.brand || ''}
                                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                            placeholder="t.ex. Zeta, Garant..."
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Förp. Vikt (friv.)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.packageWeight || ''}
                                                onChange={(e) => setFormData({ ...formData, packageWeight: Number(e.target.value) })}
                                                placeholder="t.ex. 275"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 pr-12"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">G</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                            Portion (friv.)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.defaultPortionGrams || ''}
                                                onChange={(e) => setFormData({ ...formData, defaultPortionGrams: Number(e.target.value) })}
                                                placeholder="t.ex. 35"
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 pr-12"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold">G</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Kategori
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as FoodCategory })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    >
                                        {Object.entries(CATEGORY_GROUPS).map(([group, keys]) => (
                                            <optgroup key={group} label={group}>
                                                {keys.map(key => (
                                                    <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                        Enhet
                                    </label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value as Unit })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    >
                                        {Object.entries(UNIT_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Ingredient List */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                                    Ingredienslista (frivilligt)
                                </label>
                                <textarea
                                    value={formData.ingredients || ''}
                                    onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                                    placeholder="t.ex. Kikärtor, vatten, salt..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 min-h-[100px] resize-y"
                                />
                            </div>

                            {/* Primary: Macros */}
                            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                                <h3 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                    <span>📊</span> Näringsvärden (per 100g)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Protein</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={formData.protein}
                                            onChange={(e) => {
                                                const protein = Number(e.target.value);
                                                const calories = Math.round(protein * 4 + formData.carbs * 4 + formData.fat * 9);
                                                setFormData({ ...formData, protein, calories });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kolhydrater</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={formData.carbs}
                                            onChange={(e) => {
                                                const carbs = Number(e.target.value);
                                                const calories = Math.round(formData.protein * 4 + carbs * 4 + formData.fat * 9);
                                                setFormData({ ...formData, carbs, calories });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fett</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={formData.fat}
                                            onChange={(e) => {
                                                const fat = Number(e.target.value);
                                                const calories = Math.round(formData.protein * 4 + formData.carbs * 4 + fat * 9);
                                                setFormData({ ...formData, fat, calories });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kalorier</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.calories}
                                            onChange={(e) => setFormData({ ...formData, calories: Number(e.target.value) })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="flex-1 py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {editingItem ? '💾 Spara' : '➕ Lägg till'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {detailItem && (
                <FoodItemDetailModal
                    item={detailItem}
                    onClose={() => setDetailItem(null)}
                    frequency={itemFrequencyMap[detailItem.id] || 0}
                    categoryLabels={CATEGORY_LABELS}
                    unitLabels={UNIT_LABELS}
                    creatorName={getCreatorName(detailItem.createdBy)}
                />
            )}
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
