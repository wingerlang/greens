import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext.tsx';
import { type FoodItem, type Recipe, type MealType, type PriceCategory, type Season, MEAL_TYPE_LABELS } from '../../models/types.ts';
import { calculateRecipeEstimate, getIngredientSuggestions } from '../../utils/ingredientParser.ts';
import { RecipeNutritionPreview } from '../shared/RecipeNutritionPreview.tsx';
import { X, Clock, Users, Utensils, Zap, Check, AlertCircle, Trash2, Edit3, Save } from 'lucide-react';
import './RecipeFormModal.css';

interface RecipeFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingRecipe: Recipe | null;
}

interface RecipeFormState {
    name: string;
    description: string;
    servings: number;
    prepTime: number;
    cookTime: number;
    mealType: MealType;
    ingredientsText: string;
    instructionsText: string;
    totalWeight: number;
    priceCategory: PriceCategory;
    seasons: Season[];
    cookingLoss: number;
}

const EMPTY_FORM: RecipeFormState = {
    name: '',
    description: '',
    servings: 4,
    prepTime: 10,
    cookTime: 20,
    mealType: 'dinner',
    ingredientsText: '',
    instructionsText: '',
    totalWeight: 0,
    priceCategory: 'medium',
    seasons: [],
    cookingLoss: 0,
};

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({ isOpen, onClose, editingRecipe }) => {
    const { addRecipe, updateRecipe, foodItems } = useData();
    const [formData, setFormData] = useState<RecipeFormState>(EMPTY_FORM);
    const [suggestions, setSuggestions] = useState<FoodItem[]>([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
    const [debouncedIngredients, setDebouncedIngredients] = useState('');
    const [isCalculating, setIsCalculating] = useState(false);
    const [tab, setTab] = useState<'basics' | 'ingredients' | 'instructions'>('basics');
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Initialize form when editingRecipe changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (editingRecipe) {
                setFormData({
                    name: editingRecipe.name,
                    description: editingRecipe.description || '',
                    servings: editingRecipe.servings,
                    prepTime: editingRecipe.prepTime || 0,
                    cookTime: editingRecipe.cookTime || 0,
                    mealType: editingRecipe.mealType || 'dinner',
                    ingredientsText: editingRecipe.ingredientsText || '',
                    instructionsText: editingRecipe.instructionsText || (editingRecipe.instructions || []).join('\n'),
                    totalWeight: editingRecipe.totalWeight || 0,
                    priceCategory: editingRecipe.priceCategory || 'medium',
                    seasons: editingRecipe.seasons || [],
                    cookingLoss: editingRecipe.cookingLoss || 0,
                });
                setManualMatches((editingRecipe as any).manualMatches || {});
            } else {
                setFormData(EMPTY_FORM);
                setManualMatches({});
            }
            setTab('basics');
        }
    }, [isOpen, editingRecipe]);

    // Debounce ingredients text
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            setDebouncedIngredients(formData.ingredientsText);
            setIsCalculating(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [formData.ingredientsText]);

    const liveEstimate = useMemo(() => {
        if (!debouncedIngredients.trim()) {
            return { 
                calories: 0, protein: 0, carbs: 0, fat: 0, matchedCount: 0, totalCount: 0, totalWeight: 0, rawWeight: 0, price: 0,
                matchedIngredients: [], activeTime: 0, passiveTime: 0 
            };
        }
        return calculateRecipeEstimate(debouncedIngredients, foodItems, manualMatches, formData.instructionsText, formData.name, formData.cookingLoss);
    }, [debouncedIngredients, foodItems, manualMatches, formData.instructionsText, formData.name, formData.cookingLoss]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFormData({ ...formData, ingredientsText: value });

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1].trim();

        const queryMatch = currentLine.match(/^(?:\d+(?:[.,]\d+)?\s*[a-zåäö]*\s+)?(.*)$/i);
        const query = queryMatch?.[1]?.trim() || '';

        if (query.length >= 2) {
            const matches = getIngredientSuggestions(query, foodItems);
            setSuggestions(matches);
            setActiveSuggestionIndex(0);
        } else {
            setSuggestions([]);
        }
    };

    const applySuggestion = (suggestion: FoodItem) => {
        if (!textareaRef.current) return;

        const value = formData.ingredientsText;
        const cursorPosition = textareaRef.current.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const textAfterCursor = value.substring(cursorPosition);
        
        const linesBefore = textBeforeCursor.split('\n');
        const currentLine = linesBefore[linesBefore.length - 1];
        
        const quantityMatch = currentLine.match(/^(\d+(?:[.,]\d+)?\s*[a-zåäö]*\s+)/i);
        const prefix = quantityMatch ? quantityMatch[1] : '';
        
        const newLine = `${prefix}${suggestion.name}`;
        linesBefore[linesBefore.length - 1] = newLine;
        
        const newValue = linesBefore.join('\n') + textAfterCursor;
        setFormData({ ...formData, ingredientsText: newValue });
        setSuggestions([]);

        const matchKey = suggestion.name.toLowerCase();
        setManualMatches(prev => ({ ...prev, [matchKey]: suggestion.id }));
        
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                applySuggestion(suggestions[activeSuggestionIndex]);
            } else if (e.key === 'Escape') {
                setSuggestions([]);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const recipeData = {
            ...formData,
            totalWeight: liveEstimate.totalWeight, // Persist the calculated weight!
            instructions: formData.instructionsText.split('\n').filter(line => line.trim()),
            manualMatches,
            cookingLoss: formData.cookingLoss,
        };

        if (editingRecipe) {
            updateRecipe(editingRecipe.id, recipeData);
        } else {
            addRecipe(recipeData);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="recipe-form-overlay" onClick={onClose}>
            <div className="recipe-form-modal animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="rf-header">
                    <div className="rf-title-stack">
                        <div className="rf-tag">RECEPT-EDITOR</div>
                        <h2>{editingRecipe ? 'Uppdatera Recept' : 'Skapa Nytt Recept'}</h2>
                    </div>
                    <button className="rf-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="rf-main">
                    {/* Left Column: Editor */}
                    <div className="rf-editor-side">
                        <div className="rf-tabs">
                            <button className={tab === 'basics' ? 'active' : ''} onClick={() => setTab('basics')}>Basik</button>
                            <button className={tab === 'ingredients' ? 'active' : ''} onClick={() => setTab('ingredients')}>Ingredienser</button>
                            <button className={tab === 'instructions' ? 'active' : ''} onClick={() => setTab('instructions')}>Instruktioner</button>
                        </div>

                        <form id="recipe-form" onSubmit={handleSubmit} className="rf-form-body">
                            {tab === 'basics' && (
                                <div className="rf-section animate-in fade-in slide-in-from-left-4">
                                    <div className="rf-field">
                                        <label>Namn på rätten</label>
                                        <input 
                                            type="text" 
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            placeholder="t.ex. Lyxig Linsgryta med Kokos"
                                            required
                                        />
                                    </div>
                                    <div className="rf-field">
                                        <label>Beskrivning</label>
                                        <textarea 
                                            value={formData.description}
                                            onChange={e => setFormData({...formData, description: e.target.value})}
                                            placeholder="Kort pitch om receptet..."
                                            rows={2}
                                        />
                                    </div>

                                    <div className="rf-grid-3">
                                        <div className="rf-field">
                                            <label><Clock size={12} /> Tid (min)</label>
                                            <div className="rf-time-inputs">
                                                <input 
                                                    type="number" 
                                                    value={formData.prepTime}
                                                    onChange={e => setFormData({...formData, prepTime: Number(e.target.value)})}
                                                    placeholder="Prep"
                                                />
                                                <input 
                                                    type="number" 
                                                    value={formData.cookTime}
                                                    onChange={e => setFormData({...formData, cookTime: Number(e.target.value)})}
                                                    placeholder="Tillag."
                                                />
                                            </div>
                                        </div>
                                        <div className="rf-field">
                                            <label><Users size={12} /> Portioner</label>
                                            <input 
                                                type="number" 
                                                value={formData.servings}
                                                onChange={e => setFormData({...formData, servings: Number(e.target.value)})}
                                            />
                                        </div>
                                        <div className="rf-field">
                                            <label>💧 Vattenförlust (%)</label>
                                            <input 
                                                type="number" 
                                                value={formData.cookingLoss}
                                                onChange={e => setFormData({...formData, cookingLoss: Number(e.target.value)})}
                                                placeholder="t.ex. 15"
                                            />
                                        </div>
                                    </div>

                                    <div className="rf-field">
                                        <label>Måltidstyp</label>
                                        <div className="rf-chip-grid">
                                            {(['breakfast', 'lunch', 'dinner', 'snack', 'evening_meal'] as MealType[]).map(t => (
                                                <button 
                                                    key={t}
                                                    type="button"
                                                    className={`rf-chip ${formData.mealType === t ? 'active' : ''}`}
                                                    onClick={() => setFormData({...formData, mealType: t})}
                                                >
                                                    {MEAL_TYPE_LABELS[t]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rf-field">
                                        <label>Säsong</label>
                                        <div className="rf-chip-grid">
                                            {(['winter', 'spring', 'summer', 'autumn'] as Season[]).map(s => (
                                                <button 
                                                    key={s}
                                                    type="button"
                                                    className={`rf-chip ${formData.seasons.includes(s) ? 'active' : ''}`}
                                                    onClick={() => {
                                                        const next = formData.seasons.includes(s)
                                                            ? formData.seasons.filter(x => x !== s)
                                                            : [...formData.seasons, s];
                                                        setFormData({...formData, seasons: next});
                                                    }}
                                                >
                                                    {s === 'winter' ? '❄️ Vinter' : s === 'spring' ? '🌱 Vår' : s === 'summer' ? '☀️ Sommar' : '🍂 Höst'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tab === 'ingredients' && (
                                <div className="rf-section animate-in fade-in slide-in-from-left-4">
                                    <div className="rf-field rf-field-full">
                                        <div className="rf-label-row">
                                            <label>Ingredienser</label>
                                            <span className="rf-hint">En per rad, t.ex. "400g tofu"</span>
                                        </div>
                                        <div className="rf-textarea-wrapper">
                                            <textarea 
                                                ref={textareaRef}
                                                value={formData.ingredientsText}
                                                onChange={handleTextareaChange}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Ladda upp din inköpslista här..."
                                                rows={12}
                                            />
                                            {suggestions.length > 0 && (
                                                <div className="rf-suggestions">
                                                    {suggestions.map((s, idx) => (
                                                        <div 
                                                            key={s.id} 
                                                            className={`rf-suggestion ${idx === activeSuggestionIndex ? 'active' : ''}`}
                                                            onClick={() => applySuggestion(s)}
                                                        >
                                                            <div className="s-info">
                                                                <span className="s-name">{s.name}</span>
                                                                <span className="s-meta">{s.calories} kcal | {s.protein}g P</span>
                                                            </div>
                                                            <Zap size={14} className="s-icon" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {tab === 'instructions' && (
                                <div className="rf-section animate-in fade-in slide-in-from-left-4">
                                    <div className="rf-field rf-field-full">
                                        <label>Steg-för-steg instruktioner</label>
                                        <textarea 
                                            value={formData.instructionsText}
                                            onChange={e => setFormData({...formData, instructionsText: e.target.value})}
                                            placeholder="1. Hacka lök...&#10;2. Fräs i olja..."
                                            rows={12}
                                        />
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Right Column: Analysis Preview */}
                    <div className="rf-preview-side">
                        <div className="rf-preview-card">
                            <div className="rf-preview-header">
                                <Zap size={18} className="text-emerald-400" />
                                <h3>LIVE-ANALYS</h3>
                                <div className={`rf-status ${liveEstimate.matchedCount === liveEstimate.totalCount ? 'perfect' : 'warning'}`}>
                                    {liveEstimate.matchedCount}/{liveEstimate.totalCount} Matchade
                                </div>
                            </div>

                            <div className="rf-nutrition-wrap">
                                <RecipeNutritionPreview 
                                    servings={formData.servings}
                                    totalCalories={liveEstimate.calories}
                                    totalProtein={liveEstimate.protein}
                                    totalCarbs={liveEstimate.carbs}
                                    totalFat={liveEstimate.fat}
                                    totalWeight={liveEstimate.totalWeight}
                                    recipeServings={formData.servings}
                                />
                                {formData.cookingLoss > 0 && (
                                    <div className="flex justify-between items-center mt-2 px-2">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Råvikt: {liveEstimate.rawWeight}g</div>
                                        <div className="text-[10px] font-bold text-amber-500 uppercase tracking-tight">Tillagad: {liveEstimate.totalWeight}g</div>
                                    </div>
                                )}
                            </div>

                            <div className="rf-ingredients-analysis">
                                <h4>Ingrediens-status</h4>
                                <div className="rf-analysis-list">
                                    {liveEstimate.matchedIngredients.length === 0 ? (
                                        <div className="rf-empty-analysis">
                                            <AlertCircle size={24} />
                                            <p>Börja skriva ingredienser för att se analysen</p>
                                        </div>
                                    ) : (
                                        liveEstimate.matchedIngredients.map((mi, idx) => (
                                            <div key={idx} className={`rf-analysis-item ${mi.foodItem ? 'matched' : 'missing'}`}>
                                                <div className="rf-ai-status">
                                                    {mi.foodItem ? <Check size={12} /> : <AlertCircle size={12} />}
                                                </div>
                                                <div className="rf-ai-content">
                                                    <div className="rf-ai-row">
                                                        <span className="rf-ai-name">{mi.name}</span>
                                                        <span className="rf-ai-qty">{mi.quantity}{mi.unit}</span>
                                                    </div>
                                                    {mi.foodItem ? (
                                                        <span className="rf-ai-match">Match: {mi.foodItem.name}</span>
                                                    ) : (
                                                        <span className="rf-ai-missing">Hittades ej - lägg till i databasen</span>
                                                    )}
                                                </div>
                                                <div className="rf-ai-price">{mi.price} kr</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="rf-cost-summary">
                                <div className="rf-cost-main">
                                    <span className="label">Total kostnad</span>
                                    <span className="value">{liveEstimate.price} kr</span>
                                </div>
                                <div className="rf-cost-sub">
                                    <span>{(liveEstimate.price / formData.servings).toFixed(1)} kr / portion</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="rf-footer">
                    <button className="rf-btn-secondary" onClick={onClose}>Avbryt</button>
                    <button 
                        type="submit" 
                        form="recipe-form" 
                        className="rf-btn-primary"
                        disabled={!formData.name || liveEstimate.totalCount === 0}
                    >
                        <Save size={18} />
                        {editingRecipe ? 'Uppdatera Recept' : 'Spara Recept'}
                    </button>
                </div>
            </div>
        </div>
    );
};
