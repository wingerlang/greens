import React, { useState } from 'react';
import { useData } from '../context/DataContext.tsx';
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
};

type ViewMode = 'grid' | 'list';

export function DatabasePage() {
    const { foodItems, addFoodItem, updateFoodItem, deleteFoodItem } = useData();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
    const [formData, setFormData] = useState<FoodItemFormData>(EMPTY_FORM);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const filteredItems = foodItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

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
            </div>

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
                                            onClick={() => handleOpenForm(item)}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-ghost btn-sm btn-danger"
                                            onClick={() => handleDelete(item.id)}
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
                                    <button className="btn btn-ghost" onClick={() => handleOpenForm(item)}>Redigera</button>
                                    <button className="btn btn-ghost btn-danger" onClick={() => handleDelete(item.id)}>Ta bort</button>
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
        </div>
    );
}

// Helper to get CO2 color class
function getCO2Class(value: number): string {
    if (value <= 0.5) return 'co2-low';
    if (value <= 1.0) return 'co2-medium';
    return 'co2-high';
}
