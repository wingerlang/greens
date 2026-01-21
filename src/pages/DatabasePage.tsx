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
import { AnimatePresence, motion } from 'framer-motion';
import './DatabasePage.css';

const STORAGE_TYPE_LABELS: Record<FoodStorageType, string> = {
    fresh: '🥬 Färsk',
    pantry: '🏪 Skafferi',
    frozen: '❄️ Fryst',
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

export function DatabasePage({ headless = false }: { headless?: boolean }) {
    const { foodItems, recipes, mealEntries, addFoodItem, updateFoodItem, deleteFoodItem, foodAliases, updateFoodAlias } = useData();
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

    const filteredItems = useMemo(() => {
        const query = normalizeText(searchQuery);
        const matchesCategory = (item: FoodItem) => selectedCategory === 'all' || item.category === selectedCategory;

        if (!query) {
            return foodItems.filter(matchesCategory).slice(0, 100);
        }

        const exactMatches: FoodItem[] = [];
        const startsWithMatches: FoodItem[] = [];
        const containsMatches: FoodItem[] = [];

        for (const item of foodItems) {
            if (!matchesCategory(item)) continue;

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

        return [...exactMatches, ...startsWithMatches, ...containsMatches].slice(0, 100);
    }, [foodItems, searchQuery, selectedCategory]);

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

    const stats = useMemo(() => ({
        totalFoods: foodItems.length,
        totalRecipes: recipes.length,
        incompleteFoods: foodItems.filter(f => f.calories === 0 || !f.category || f.category === 'other').length,
        missingMicros: foodItems.filter(f => !f.iron && !f.zinc && !f.vitaminB12).length
    }), [foodItems, recipes]);

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
        const brand = parsed.brand || extractBrand(parsed.text || '', knownBrands);
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
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
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
                    <div className="grid grid-cols-[auto,1fr,auto,auto,auto,auto,auto,auto,auto,auto,auto] gap-4 p-4 border-b border-slate-800 bg-slate-900/80 text-xs font-bold text-slate-500 uppercase tracking-wider items-center">
                        <div className="w-10">Bild</div>
                        <div>Råvara</div>
                        <div className="hidden md:block">Kategori</div>
                        <div className="text-right">Kcal</div>
                        <div className="text-right hidden sm:block">Prot</div>
                        <div className="text-right hidden sm:block">Kolh</div>
                        <div className="text-right hidden sm:block">Fett</div>
                        <div className="text-center hidden lg:block">Pris</div>
                        <div className="text-center hidden lg:block">Enhet</div>
                        <div className="text-center hidden xl:block">Klimat</div>
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
                                    className="grid grid-cols-[auto,1fr,auto,auto,auto,auto,auto,auto,auto,auto,auto] gap-4 p-4 hover:bg-slate-800/50 transition-colors items-center group"
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
                                        <span className="text-xs text-slate-500 font-medium">
                                            Per 100{item.unit === 'pcs' ? ' st' : item.unit}
                                        </span>
                                        <div className="flex gap-1">
                                            <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" onClick={() => setDetailItem(item)}>📋</button>
                                            <button className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors" onClick={() => handleOpenForm(item)}>✏️</button>
                                            <button
                                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                onClick={(e) => handleDeleteClick(e, item)}
                                                title="Ta bort"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
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
                                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
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
                <div className="modal-overlay" onClick={() => setDetailItem(null)}>
                    <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{detailItem.name}</h2>
                            <button className="btn-close" onClick={() => setDetailItem(null)}>×</button>
                        </div>
                        {detailItem.imageUrl && (
                            <div className="w-full h-48 bg-slate-900 overflow-hidden relative">
                                <img
                                    src={getImgSrc(detailItem.imageUrl)}
                                    alt={detailItem.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}
                        <div className="detail-grid">
                            <div className="detail-section">
                                <h3 className="detail-title text-emerald-400">📊 Näringsvärde (100g)</h3>
                                <div className="food-stats-row">
                                    <div className="food-stat-card">
                                        <span className="food-stat-label">Protein</span>
                                        <span className="food-stat-value">{detailItem.protein}g</span>
                                    </div>
                                    <div className="food-stat-card">
                                        <span className="food-stat-label">Kolh.</span>
                                        <span className="food-stat-value">{detailItem.carbs}g</span>
                                    </div>
                                    <div className="food-stat-card">
                                        <span className="food-stat-label">Fett</span>
                                        <span className="food-stat-value">{detailItem.fat}g</span>
                                    </div>
                                    <div className="food-stat-card">
                                        <span className="food-stat-label">Kalorier</span>
                                        <span className="food-stat-value text-emerald-400">{detailItem.calories}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
