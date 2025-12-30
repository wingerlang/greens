import React, { useState, useEffect } from 'react';
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
import './DatabasePage.css';

const STORAGE_TYPE_LABELS: Record<FoodStorageType, string> = {
    fresh: '🥬 Färsk',
    pantry: '🏪 Skafferi',
    frozen: '❄️ Fryst',
};

const EMPTY_FORM: FoodItemFormData = {
    name: '',
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    unit: 'kg',
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
};

type ViewMode = 'grid' | 'list';

export function DatabasePage({ headless = false }: { headless?: boolean }) {
    const { foodItems, mealEntries, addFoodItem, updateFoodItem, deleteFoodItem } = useData();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<FoodItem | null>(null);
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [formData, setFormData] = useState<FoodItemFormData>(EMPTY_FORM);
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

    // Smart search with relevance ranking and robust Swedish character handling
    const filteredItems = React.useMemo(() => {
        // Normalize text: NFC normalize, lowercase, trim, and strip any zero-width chars
        const normalizeText = (text: string) =>
            text.normalize('NFC').toLowerCase().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

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
            const descLower = item.description ? normalizeText(item.description) : '';

            if (nameLower === query) {
                exactMatches.push(item);
            } else if (nameLower.startsWith(query)) {
                startsWithMatches.push(item);
            } else if (nameLower.includes(query) || descLower.includes(query)) {
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

    const handleOpenForm = (item?: FoodItem) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
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

    const handleDelete = (id: string) => {
        if (confirm('Är du säker på att du vill ta bort denna råvara?')) {
            deleteFoodItem(id);
        }
    };

    // Handle inline cell edit
    const handleCellBlur = (item: FoodItem, field: keyof FoodItemFormData, value: string | number | boolean) => {
        updateFoodItem(item.id, { [field]: value });
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
                                <th className="th-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map(item => (
                                <tr key={item.id}>
                                    <td className="td-name">
                                        <strong>{item.name}</strong>
                                        {item.description && (
                                            <span className="item-desc">{item.description}</span>
                                        )}
                                    </td>
                                    <td className="td-type">
                                        <span className={`storage-badge ${item.storageType || 'pantry'}`}>
                                            {STORAGE_TYPE_LABELS[item.storageType || 'pantry']}
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
                                            onChange={(e) => handleCellBlur(item, 'containsGluten', e.target.checked)}
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
                    {filteredItems.map(item => (
                        <div key={item.id} className="food-card">
                            <div className="food-card-header">
                                <h3>{item.name}</h3>
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

            {/* Modal Form */}
            {isFormOpen && (
                <div className="modal-overlay" onClick={handleCloseForm}>
                    <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                        <h2>{editingItem ? 'Redigera Råvara' : 'Lägg till Råvara'}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="name">Namn</label>
                                <input
                                    type="text"
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="description">Beskrivning (t.ex. varianter)</label>
                                <input
                                    type="text"
                                    id="description"
                                    placeholder="t.ex. jasminris, basmatiris"
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div className="form-row form-row-3">
                                <div className="form-group">
                                    <label htmlFor="category">Kategori</label>
                                    <select
                                        id="category"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value as FoodCategory })}
                                    >
                                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="storageType">Förvaringstyp</label>
                                    <select
                                        id="storageType"
                                        value={formData.storageType || 'pantry'}
                                        onChange={(e) => setFormData({ ...formData, storageType: e.target.value as FoodStorageType })}
                                    >
                                        {Object.entries(STORAGE_TYPE_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="unit">Enhet</label>
                                    <select
                                        id="unit"
                                        value={formData.unit}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value as Unit })}
                                    >
                                        {Object.entries(UNIT_LABELS).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <h3 className="form-section-title">Näringsvärden (per 100g)</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="calories">Kalorier (kcal)</label>
                                    <input
                                        type="number"
                                        id="calories"
                                        min="0"
                                        value={formData.calories}
                                        onChange={(e) => setFormData({ ...formData, calories: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="protein">Protein (g)</label>
                                    <input
                                        type="number"
                                        id="protein"
                                        min="0"
                                        step="0.1"
                                        value={formData.protein}
                                        onChange={(e) => setFormData({ ...formData, protein: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="form-row form-row-3">
                                <div className="form-group">
                                    <label htmlFor="carbs">Kolhydrater (g)</label>
                                    <input
                                        type="number"
                                        id="carbs"
                                        min="0"
                                        step="0.1"
                                        value={formData.carbs}
                                        onChange={(e) => setFormData({ ...formData, carbs: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="fat">Fett (g)</label>
                                    <input
                                        type="number"
                                        id="fat"
                                        min="0"
                                        step="0.1"
                                        value={formData.fat}
                                        onChange={(e) => setFormData({ ...formData, fat: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="fiber">Fiber (g)</label>
                                    <input
                                        type="number"
                                        id="fiber"
                                        min="0"
                                        step="0.1"
                                        value={formData.fiber}
                                        onChange={(e) => setFormData({ ...formData, fiber: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <h3 className="form-section-title">Vitaminer & Mineraler (per 100g)</h3>
                            <div className="form-row form-row-4">
                                <div className="form-group">
                                    <label htmlFor="iron">Järn (mg)</label>
                                    <input
                                        type="number"
                                        id="iron"
                                        min="0"
                                        step="0.1"
                                        value={formData.iron || 0}
                                        onChange={(e) => setFormData({ ...formData, iron: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="calcium">Kalcium (mg)</label>
                                    <input
                                        type="number"
                                        id="calcium"
                                        min="0"
                                        value={formData.calcium || 0}
                                        onChange={(e) => setFormData({ ...formData, calcium: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="zinc">Zink (mg)</label>
                                    <input
                                        type="number"
                                        id="zinc"
                                        min="0"
                                        step="0.1"
                                        value={formData.zinc || 0}
                                        onChange={(e) => setFormData({ ...formData, zinc: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="vitaminB12">B12 (µg)</label>
                                    <input
                                        type="number"
                                        id="vitaminB12"
                                        min="0"
                                        step="0.1"
                                        value={formData.vitaminB12 || 0}
                                        onChange={(e) => setFormData({ ...formData, vitaminB12: Number(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <h3 className="form-section-title">Proteinkvalitet</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="checkbox-inline">
                                        <input
                                            type="checkbox"
                                            checked={formData.isCompleteProtein || false}
                                            onChange={(e) => setFormData({ ...formData, isCompleteProtein: e.target.checked })}
                                        />
                                        Fullvärdigt protein (innehåller alla essentiella aminosyror)
                                    </label>
                                </div>
                            </div>
                            {!formData.isCompleteProtein && (
                                <div className="form-group">
                                    <label>Kompletterande kategorier (behövs för fullvärdigt protein)</label>
                                    <div className="checkbox-grid">
                                        {['grains', 'legumes', 'nuts', 'seeds'].map(cat => (
                                            <label key={cat} className="checkbox-inline">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.complementaryCategories?.includes(cat as FoodCategory)}
                                                    onChange={(e) => {
                                                        const cats = formData.complementaryCategories || [];
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, complementaryCategories: [...cats, cat as FoodCategory] });
                                                        } else {
                                                            setFormData({ ...formData, complementaryCategories: cats.filter(c => c !== cat) });
                                                        }
                                                    }}
                                                />
                                                {CATEGORY_LABELS[cat as FoodCategory] || cat}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <h3 className="form-section-title">Smart Plan Data</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="proteinCategory">Proteinkategori (för aminosyra-balans)</label>
                                    <select
                                        id="proteinCategory"
                                        value={formData.proteinCategory || ''}
                                        onChange={(e) => setFormData({ ...formData, proteinCategory: e.target.value as any || undefined })}
                                    >
                                        <option value="">Ingen (ej proteinfokus)</option>
                                        <option value="legume">Baljväxt (Bönor/Linser)</option>
                                        <option value="grain">Spannmål (Ris/Vete)</option>
                                        <option value="soy_quinoa">Fullvärdig (Sojaprodukter/Quinoa)</option>
                                        <option value="seed">Frö (Solros/Pumpa)</option>
                                        <option value="nut">Nöt (Mandel/Valnöt)</option>
                                        <option value="vegetable">Grönsak (Broccoli/Spenat)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Säsonger (när är den bäst?)</label>
                                <div className="checkbox-grid">
                                    {[
                                        { id: 'winter', label: 'Vinter ❄️' },
                                        { id: 'spring', label: 'Vår 🌱' },
                                        { id: 'summer', label: 'Sommar ☀️' },
                                        { id: 'autumn', label: 'Höst 🍂' }
                                    ].map(s => (
                                        <label key={s.id} className="checkbox-inline">
                                            <input
                                                type="checkbox"
                                                checked={formData.seasons?.includes(s.id as any)}
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
                                    ))}
                                </div>
                            </div>

                            <h3 className="form-section-title">Extra Information</h3>
                            <div className="form-row form-row-3">
                                <div className="form-group">
                                    <label htmlFor="pricePerUnit">Pris (kr/enhet)</label>
                                    <input
                                        type="number"
                                        id="pricePerUnit"
                                        min="0"
                                        step="1"
                                        value={formData.pricePerUnit || 0}
                                        onChange={(e) => setFormData({ ...formData, pricePerUnit: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="co2PerUnit">CO₂ (kg/enhet)</label>
                                    <input
                                        type="number"
                                        id="co2PerUnit"
                                        min="0"
                                        step="0.1"
                                        value={formData.co2PerUnit || 0}
                                        onChange={(e) => setFormData({ ...formData, co2PerUnit: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="checkbox-inline">
                                        <input
                                            type="checkbox"
                                            checked={formData.containsGluten || false}
                                            onChange={(e) => setFormData({ ...formData, containsGluten: e.target.checked })}
                                        />
                                        Innehåller gluten
                                    </label>
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseForm}>
                                    Avbryt
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingItem ? 'Spara ändringar' : 'Lägg till'}
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
