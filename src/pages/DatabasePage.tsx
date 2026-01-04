import React, { useState, useEffect, useMemo } from 'react';
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
import { parseNutritionText, extractFromJSONLD, cleanProductName, extractBrand, extractPackagingWeight } from '../utils/nutritionParser.ts';
import './DatabasePage.css';

const STORAGE_TYPE_LABELS: Record<FoodStorageType, string> = {
    fresh: '🥬 Färsk',
    pantry: '🏪 Skafferi',
    frozen: '❄️ Fryst',
};

const EMPTY_FORM: FoodItemFormData = {
    name: '',
    brand: '',
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
    const { foodItems, recipes, mealEntries, addFoodItem, updateFoodItem, deleteFoodItem } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<FoodItem | null>(null);
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [formData, setFormData] = useState<FoodItemFormData>(EMPTY_FORM);
    const [isParsingUrl, setIsParsingUrl] = useState(false);
    const [urlParseError, setUrlParseError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');

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

    const lastLoggedMap = useMemo(() => {
        const map: Record<string, string> = {};
        mealEntries.forEach(entry => {
            entry.items.forEach((item) => {
                if (item.type === 'foodItem') {
                    const current = map[item.referenceId];
                    if (!current || entry.date > current) {
                        map[item.referenceId] = entry.date;
                    }
                }
            });
        });
        return map;
    }, [mealEntries]);

    const filteredItems = useMemo(() => {
        // normalizeText imported from utils/formatters.ts
        const query = normalizeText(searchQuery);
        const matchesCategory = (item: FoodItem) => selectedCategory === 'all' || item.category === selectedCategory;

        if (!query) {
            // No search query - just filter by category and limit
            return foodItems.filter(matchesCategory).slice(0, 100);
        }

        // Categorize matches by relevance
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

        // Combine in priority order, limit total results for performance
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
            setFormData({
                name: item.name,
                brand: item.brand || '',
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
            });
        } else {
            setEditingItem(null);
            setFormData(EMPTY_FORM);
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingItem(null);
        setFormData(EMPTY_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            updateFoodItem(editingItem.id, formData);
        } else {
            addFoodItem(formData);
        }
        handleCloseForm();
    };

    const handleSmartPaste = async (text: string) => {
        if (!text) return;
        setUrlParseError(null);

        // Calculate known brands for smart fuzzy matching
        const knownBrands = Array.from(new Set(foodItems.map(f => f.brand).filter(Boolean))) as string[];

        // URL Detection
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch) {
            const url = urlMatch[1];
            setIsParsingUrl(true);
            try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch('http://localhost:8000/api/parse-url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ url })
                });

                if (!res.ok) throw new Error('Kunde inte hämta sidan. Kontrollera URL:en.');

                const data = await res.json();

                // 1. Try JSON-LD first (most reliable)
                let results = extractFromJSONLD(data.jsonLds || []);

                // 2. Supplement with text parsing
                const textResults = parseNutritionText(data.text);

                // 3. Extract Metadata
                const brand = results.brand || extractBrand(data.text, knownBrands);
                const packageWeight = extractPackagingWeight(data.text);
                const name = cleanProductName(data.title, data.h1) || results.name || textResults.name;

                // 4. Combine results
                const finalResults = {
                    name,
                    brand,
                    packageWeight,
                    calories: results.calories ?? textResults.calories,
                    protein: results.protein ?? textResults.protein,
                    carbs: results.carbs ?? textResults.carbs,
                    fat: results.fat ?? textResults.fat,
                    fiber: results.fiber ?? textResults.fiber,
                    ingredients: results.ingredients || textResults.ingredients,
                    defaultPortionGrams: results.defaultPortionGrams || textResults.defaultPortionGrams
                };

                setFormData(prev => ({
                    ...prev,
                    name: finalResults.name || prev.name,
                    brand: finalResults.brand || prev.brand,
                    packageWeight: finalResults.packageWeight || prev.packageWeight,
                    calories: finalResults.calories !== undefined ? finalResults.calories : prev.calories,
                    protein: finalResults.protein !== undefined ? finalResults.protein : prev.protein,
                    carbs: finalResults.carbs !== undefined ? finalResults.carbs : prev.carbs,
                    fat: finalResults.fat !== undefined ? finalResults.fat : prev.fat,
                    fiber: finalResults.fiber !== undefined ? finalResults.fiber : prev.fiber,
                    ingredients: finalResults.ingredients || prev.ingredients,
                    defaultPortionGrams: finalResults.defaultPortionGrams !== undefined ? finalResults.defaultPortionGrams : prev.defaultPortionGrams,
                }));

            } catch (err) {
                setUrlParseError(err instanceof Error ? err.message : 'Ett fel uppstod vid hämtning.');
            } finally {
                setIsParsingUrl(false);
            }
            return;
        }

        // Standard Text Parsing
        const parsed = parseNutritionText(text);
        const brand = extractBrand(text, knownBrands);
        const packageWeight = extractPackagingWeight(text);

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
            defaultPortionGrams: parsed.defaultPortionGrams || prev.defaultPortionGrams,
        }));
    };

    const handleDelete = (id: string) => {
        if (confirm('Är du säker på att du vill ta bort denna råvara?')) {
            deleteFoodItem(id);
        }
    };

    // Handle inline cell edit
    const handleCellBlur = (item: FoodItem, field: keyof FoodItemFormData, value: string | number | boolean) => {
        updateFoodItem(item.id, { [field]: value });
    };

    // Helper to determine CO2 class for styling
    const getCO2Class = (co2: number) => {
        if (co2 >= 5) return 'co2-high';
        if (co2 >= 2) return 'co2-medium';
        if (co2 > 0) return 'co2-low';
        return 'co2-none';
    };

    return (
        <div className="database-page">
            {!headless && (
                <header className="page-header">
                    <div>
                        <h1>Matdatabas</h1>
                        <p className="page-subtitle">Hantera råvaror och näringsvärden</p>
                    </div>
                    <div className="header-actions">
                        <div className="view-toggle">
                            <button
                                className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Rutnät"
                            >
                                ⊞
                            </button>
                            <button
                                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="Lista"
                            >
                                ☰
                            </button>
                        </div>
                        <button className="btn btn-primary" onClick={() => handleOpenForm()}>
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

            <div className="filters">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Sök efter råvara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as FoodCategory | 'all')}
                >
                    <option value="all">Alla kategorier</option>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                {headless && (
                    <button className="btn btn-primary" onClick={() => handleOpenForm()}>
                        + Ny
                    </button>
                )}
            </div>

            {searchQuery && (
                <div className="search-results-hint" style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span>🔍</span>
                    <span>
                        {filteredItems.length === 0
                            ? 'Inga träffar'
                            : filteredItems.length === 100
                                ? '100+ träffar (visar topp 100)'
                                : `${filteredItems.length} träffar`
                        }
                        {' för "'}
                        <strong>{searchQuery}</strong>
                        {'"'}
                    </span>
                </div>
            )}

            {filteredItems.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">📦</span>
                    <p>Inga råvaror hittades</p>
                    <button className="btn btn-secondary" onClick={() => handleOpenForm()}>
                        Lägg till din första råvara
                    </button>
                </div>
            ) : viewMode === 'list' ? (
                /* LIST VIEW - Table style like POC */
                <div className="food-table-wrapper">
                    <table className="food-table">
                        <thead>
                            <tr>
                                <th className="th-name">Råvara</th>
                                <th className="th-type">Typ</th>
                                <th className="th-cooked">Tillagad</th>
                                <th className="th-price">Pris (kr)</th>
                                <th className="th-unit">Enhet</th>
                                <th className="th-num">Kcal</th>
                                <th className="th-num">Prot.</th>
                                <th className="th-num">Fett</th>
                                <th className="th-num">Kolh.</th>
                                <th className="th-gluten">Gluten</th>
                                <th className="th-co2">Klimat</th>
                                {headless && (
                                    <>
                                        <th className="th-date">Skapad</th>
                                        <th className="th-date">Senast loggad</th>
                                    </>
                                )}
                                <th className="th-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item: FoodItem) => (
                                <tr key={item.id}>
                                    <td className="td-name">
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>
                                                <strong>{item.name}</strong>
                                                {item.brand && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em', marginLeft: '0.4rem' }}>{item.brand}</span>}
                                            </span>
                                            {item.description && (
                                                <span className="item-desc">{item.description}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="td-type">
                                        <span className={`storage-badge ${item.storageType || 'pantry'}`}>
                                            {STORAGE_TYPE_LABELS[(item.storageType || 'pantry') as FoodStorageType]}
                                        </span>
                                    </td>
                                    <td className="td-cooked">
                                        <input
                                            type="checkbox"
                                            className="cooked-checkbox"
                                            checked={item.isCooked || false}
                                            onChange={(e) => handleCellBlur(item, 'isCooked', e.target.checked)}
                                            title="Tillagad"
                                        />
                                    </td>
                                    <td className="td-price">
                                        <input
                                            type="number"
                                            className="inline-input"
                                            value={item.pricePerUnit || 0}
                                            onChange={(e) => handleCellBlur(item, 'pricePerUnit', Number(e.target.value))}
                                            min="0"
                                        />
                                    </td>
                                    <td className="td-unit">
                                        <select
                                            className="inline-select"
                                            value={item.unit}
                                            onChange={(e) => handleCellBlur(item, 'unit', e.target.value)}
                                        >
                                            {Object.entries(UNIT_LABELS).map(([key, label]) => (
                                                <option key={key} value={key}>{key.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="td-num">{item.calories}</td>
                                    <td className="td-num">{item.protein}</td>
                                    <td className="td-num">{item.fat}</td>
                                    <td className="td-num">{item.carbs}</td>
                                    <td className="td-gluten">
                                        <input
                                            type="checkbox"
                                            className="gluten-checkbox"
                                            checked={item.containsGluten || false}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCellBlur(item, 'containsGluten', e.target.checked)}
                                        />
                                    </td>
                                    <td className="td-co2">
                                        <span className={`co2-badge ${getCO2Class(item.co2PerUnit || 0)}`}>
                                            {item.co2PerUnit || 0}
                                        </span>
                                    </td>
                                    <td className="td-actions">
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => setDetailItem(item)}
                                            title="Detaljer & historik"
                                        >
                                            📋
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleOpenForm(item)}
                                            title="Redigera"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm btn-danger"
                                            onClick={() => handleDelete(item.id)}
                                            title="Ta bort"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="table-hint">💡 Ändringar sparas automatiskt när du redigerar fälten</p>
                </div>
            ) : (
                /* GRID VIEW - Card layout */
                <div className="food-grid">
                    {filteredItems.map((item: FoodItem) => (
                        <div key={item.id} className="food-card">
                            <div className="food-card-header">
                                <div>
                                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
                                        {item.name}
                                        {item.brand && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7em', fontWeight: 'normal' }}>{item.brand}</span>}
                                    </h3>
                                </div>
                                <span className="category-badge">{CATEGORY_LABELS[item.category]}</span>
                            </div>
                            <div className="nutrition-grid">
                                <div className="nutrition-item">
                                    <span className="nutrition-value">{item.calories}</span>
                                    <span className="nutrition-label">kcal</span>
                                </div>
                                <div className="nutrition-item">
                                    <span className="nutrition-value">{item.protein}g</span>
                                    <span className="nutrition-label">protein</span>
                                </div>
                                <div className="nutrition-item">
                                    <span className="nutrition-value">{item.carbs}g</span>
                                    <span className="nutrition-label">kolh</span>
                                </div>
                                <div className="nutrition-item">
                                    <span className="nutrition-value">{item.fat}g</span>
                                    <span className="nutrition-label">fett</span>
                                </div>
                            </div>
                            {(item.pricePerUnit || item.co2PerUnit) && (
                                <div className="extra-stats">
                                    {item.pricePerUnit ? <span>{item.pricePerUnit} kr</span> : null}
                                    {item.co2PerUnit ? <span className={`co2-badge ${getCO2Class(item.co2PerUnit)}`}>{item.co2PerUnit} CO₂</span> : null}
                                    {item.containsGluten ? <span className="gluten-badge">Gluten</span> : null}
                                </div>
                            )}
                            <div className="food-card-footer">
                                <span className="unit-label">per 100{item.unit === 'pcs' ? ' st' : item.unit}</span>
                                <div className="card-actions">
                                    <button className="btn btn-ghost" onClick={() => setDetailItem(item)} title="Detaljer & historik">📋</button>
                                    <button className="btn btn-ghost" onClick={() => handleOpenForm(item)}>✏️</button>
                                    <button className="btn btn-ghost btn-danger" onClick={() => handleDelete(item.id)}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
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

                                            // Auto-suggest category based on name
                                            const nameLower = name.toLowerCase();
                                            if (nameLower.includes('pulver')) {
                                                setFormData(prev => ({ ...prev, name, category: 'supplements' as FoodCategory }));
                                            } else if (nameLower.includes('bön') || nameLower.includes('lins') || nameLower.includes('kikärt')) {
                                                setFormData(prev => ({ ...prev, name, category: 'legumes' as FoodCategory }));
                                            } else if (nameLower.includes('ris') || nameLower.includes('pasta') || nameLower.includes('bröd') || nameLower.includes('havre')) {
                                                setFormData(prev => ({ ...prev, name, category: 'grains' as FoodCategory }));
                                            } else if (nameLower.includes('mjölk') || nameLower.includes('ost') || nameLower.includes('yoghurt')) {
                                                setFormData(prev => ({ ...prev, name, category: 'dairy-alt' as FoodCategory }));
                                            } else if (nameLower.includes('tofu') || nameLower.includes('tempeh') || nameLower.includes('seitan')) {
                                                setFormData(prev => ({ ...prev, name, category: 'protein' as FoodCategory }));
                                            } else if (nameLower.includes('äpple') || nameLower.includes('banan') || nameLower.includes('apelsin') || nameLower.includes('bär')) {
                                                setFormData(prev => ({ ...prev, name, category: 'fruits' as FoodCategory }));
                                            } else if (nameLower.includes('spenat') || nameLower.includes('broccoli') || nameLower.includes('morot') || nameLower.includes('tomat')) {
                                                setFormData(prev => ({ ...prev, name, category: 'vegetables' as FoodCategory }));
                                            } else if (nameLower.includes('mandel') || nameLower.includes('nöt') || nameLower.includes('cashew') || nameLower.includes('frö') || nameLower.includes('chia')) {
                                                setFormData(prev => ({ ...prev, name, category: 'nuts-seeds' as FoodCategory }));
                                            } else if (nameLower.includes('olja') || nameLower.includes('smör')) {
                                                setFormData(prev => ({ ...prev, name, category: 'fats' as FoodCategory }));
                                            }
                                        }}
                                        placeholder="t.ex. Kikärtor, Havregryn..."
                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                                        required
                                    />
                                </div>
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
                                <p className="text-[10px] text-slate-500 mt-1 italic">
                                    Tips: Klistra in innehållsförteckningen här.
                                </p>
                            </div>

                            <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 relative overflow-hidden">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500/70 mb-2 flex items-center gap-2">
                                    <span>✨</span> Smart Närings-tolkare
                                    {isParsingUrl && (
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            <span className="text-[9px] normal-case font-medium text-emerald-500/80">Läser webbsida...</span>
                                        </div>
                                    )}
                                </label>
                                <textarea
                                    className={`w-full bg-slate-900/50 border ${urlParseError ? 'border-red-500/30' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 min-h-[80px] resize-none transition-all`}
                                    placeholder="Klistra in näringstabell ELLER en URL här..."
                                    disabled={isParsingUrl}
                                    onChange={(e) => handleSmartPaste(e.target.value)}
                                />
                                {urlParseError && (
                                    <p className="text-[9px] text-red-400 mt-2 flex items-center gap-1">
                                        <span>⚠️</span> {urlParseError}
                                    </p>
                                )}
                                <p className="text-[9px] text-slate-500 mt-2 italic">
                                    Parserar protein, kolhydrater, fett, fiber och kcal automatiskt. Funkar även med URL:er!
                                </p>
                                {isParsingUrl && (
                                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Primary: Macros */}
                            <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                                <h3 className="text-sm font-bold text-emerald-400 mb-4 flex items-center gap-2">
                                    <span>📊</span> Näringsvärden (per 100g)
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Protein</label>
                                        <div className="relative">
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
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.currentTarget.closest('div')?.parentElement?.nextElementSibling?.querySelector('input')?.focus();
                                                    }
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">g</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kolhydrater</label>
                                        <div className="relative">
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
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.currentTarget.closest('div')?.parentElement?.nextElementSibling?.querySelector('input')?.focus();
                                                    }
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">g</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fett</label>
                                        <div className="relative">
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
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.currentTarget.closest('div')?.parentElement?.nextElementSibling?.querySelector('input')?.focus();
                                                    }
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">g</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kalorier</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.calories}
                                                onChange={(e) => setFormData({ ...formData, calories: Number(e.target.value) })}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSubmit(e as any);
                                                    }
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">kcal</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expandable: Advanced Fields */}
                            <details className="group">
                                <summary className="cursor-pointer list-none flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-800/50 rounded-2xl border border-slate-700/30 transition-colors">
                                    <span className="text-sm font-bold text-slate-400 flex items-center gap-2">
                                        <span>⚙️</span> Avancerade inställningar
                                    </span>
                                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                                </summary>

                                <div className="mt-4 space-y-6 pl-2">
                                    {/* Fiber */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Fiber (g)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={formData.fiber}
                                                onChange={(e) => setFormData({ ...formData, fiber: Number(e.target.value) })}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Pris (kr)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.pricePerUnit || 0}
                                                onChange={(e) => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">CO₂ (kg)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={formData.co2PerUnit || 0}
                                                onChange={(e) => setFormData({ ...formData, co2PerUnit: Number(e.target.value) })}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                            />
                                        </div>
                                    </div>

                                    {/* Vitamins & Minerals */}
                                    <div>
                                        <h4 className="text-xs font-bold text-indigo-400 mb-3 flex items-center gap-2">
                                            <span>🧬</span> Vitaminer & Mineraler
                                        </h4>
                                        <div className="grid grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Järn (mg)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={formData.iron || 0}
                                                    onChange={(e) => setFormData({ ...formData, iron: Number(e.target.value) })}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Kalcium (mg)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.calcium || 0}
                                                    onChange={(e) => setFormData({ ...formData, calcium: Number(e.target.value) })}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Zink (mg)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={formData.zinc || 0}
                                                    onChange={(e) => setFormData({ ...formData, zinc: Number(e.target.value) })}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">B12 (µg)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={formData.vitaminB12 || 0}
                                                    onChange={(e) => setFormData({ ...formData, vitaminB12: Number(e.target.value) })}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Protein Quality - Custom Checkboxes */}
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-2">
                                            <span>🌱</span> Proteinkvalitet
                                        </h4>

                                        {/* Custom Checkbox */}
                                        <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${formData.isCompleteProtein
                                                ? 'bg-emerald-500 border-emerald-500'
                                                : 'border-slate-600 group-hover:border-slate-500'
                                                }`}>
                                                {formData.isCompleteProtein && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={formData.isCompleteProtein || false}
                                                onChange={(e) => setFormData({ ...formData, isCompleteProtein: e.target.checked })}
                                            />
                                            <span className="text-sm text-slate-300">Fullvärdigt protein (alla aminosyror)</span>
                                        </label>

                                        {/* Gluten Checkbox */}
                                        <label className="flex items-center gap-3 cursor-pointer group">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${formData.containsGluten
                                                ? 'bg-rose-500 border-rose-500'
                                                : 'border-slate-600 group-hover:border-slate-500'
                                                }`}>
                                                {formData.containsGluten && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={formData.containsGluten || false}
                                                onChange={(e) => setFormData({ ...formData, containsGluten: e.target.checked })}
                                            />
                                            <span className="text-sm text-slate-300">Innehåller gluten</span>
                                        </label>
                                    </div>

                                    {/* Seasons - Custom Checkboxes */}
                                    <div>
                                        <h4 className="text-xs font-bold text-sky-400 mb-3 flex items-center gap-2">
                                            <span>📅</span> Säsonger
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'winter', label: '❄️ Vinter', color: 'sky' },
                                                { id: 'spring', label: '🌱 Vår', color: 'emerald' },
                                                { id: 'summer', label: '☀️ Sommar', color: 'amber' },
                                                { id: 'autumn', label: '🍂 Höst', color: 'orange' }
                                            ].map(s => {
                                                const isChecked = formData.seasons?.includes(s.id as any);
                                                return (
                                                    <label
                                                        key={s.id}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-all text-sm ${isChecked
                                                            ? `bg-${s.color}-500/20 border border-${s.color}-500/50 text-${s.color}-400`
                                                            : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600'
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only"
                                                            checked={isChecked || false}
                                                            onChange={(e) => {
                                                                const current = formData.seasons || [];
                                                                if (e.target.checked) {
                                                                    setFormData({ ...formData, seasons: [...current, s.id as any] });
                                                                } else {
                                                                    setFormData({ ...formData, seasons: current.filter(c => c !== s.id) });
                                                                }
                                                            }}
                                                        />
                                                        {s.label}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </details>

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
                                    <kbd className="hidden md:inline px-1.5 py-0.5 bg-emerald-700/50 rounded text-[10px] font-mono">Ctrl+S</kbd>
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

                            <div className="detail-section">
                                <h3 className="detail-title text-indigo-400">🧬 Mikronäringsämnen</h3>
                                <div className="micro-grid">
                                    <div className="micro-item">
                                        <span>Järn:</span>
                                        <strong>{detailItem.iron || 0} mg</strong>
                                    </div>
                                    <div className="micro-item">
                                        <span>Kalcium:</span>
                                        <strong>{detailItem.calcium || 0} mg</strong>
                                    </div>
                                    <div className="micro-item">
                                        <span>Zink:</span>
                                        <strong>{detailItem.zinc || 0} mg</strong>
                                    </div>
                                    <div className="micro-item">
                                        <span>B12:</span>
                                        <strong>{detailItem.vitaminB12 || 0} µg</strong>
                                    </div>
                                    <div className="micro-item">
                                        <span>Vitamin C:</span>
                                        <strong>{detailItem.vitaminC || 0} mg</strong>
                                    </div>
                                    <div className="micro-item">
                                        <span>Fiber:</span>
                                        <strong>{detailItem.fiber || 0} g</strong>
                                    </div>
                                </div>
                            </div>

                            {detailItem.ingredients && (
                                <div className="detail-section full-width">
                                    <h3 className="detail-title text-amber-200">🥗 Ingredienser</h3>
                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                        {detailItem.ingredients}
                                    </div>
                                </div>
                            )}

                            <div className="detail-section full-width">
                                <h3 className="detail-title text-amber-400">📜 Logghistorik</h3>
                                <div className="history-list">
                                    {mealEntries
                                        .filter(e => e.items.some(it => it.referenceId === detailItem.id))
                                        .sort((a, b) => b.date.localeCompare(a.date))
                                        .map(entry => {
                                            const item = entry.items.find(it => it.referenceId === detailItem.id);
                                            return (
                                                <div key={entry.id} className="history-item">
                                                    <span className="history-date">{entry.date}</span>
                                                    <span className="history-type uppercase tracking-widest">{entry.mealType}</span>
                                                    <span className="history-amount">{Math.round(item?.servings || 0)}g</span>
                                                </div>
                                            );
                                        })
                                    }
                                    {mealEntries.filter(e => e.items.some(it => it.referenceId === detailItem.id)).length === 0 && (
                                        <p className="no-history text-slate-500 italic text-sm">Ingen logghistorik hittades för denna råvara.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to get CO2 color class
function getCO2Class(value: number): string {
    if (value <= 0.5) return 'co2-low';
    if (value <= 1.0) return 'co2-medium';
    return 'co2-high';
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
