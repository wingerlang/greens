import React, { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useCooking } from '../context/CookingModeProvider.tsx';
import { type FoodItem, type Recipe, type MealType, type PriceCategory, type Season, MEAL_TYPE_LABELS } from '../models/types.ts';
import { calculateRecipeEstimate, getIngredientSuggestions } from '../utils/ingredientParser.ts';
import './RecipesPage.css';
import { RecipeNutritionPreview } from '../components/shared/RecipeNutritionPreview.tsx';

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
};

interface RecipeCardProps {
    recipe: Recipe;
    foodItems: FoodItem[];
    nutritionViewMode: 'portion' | '100g';
    onOpen: (recipe: Recipe) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onCook: (recipe: Recipe) => void;
}

const RecipeCard = memo(({ recipe, foodItems, nutritionViewMode, onOpen, onDelete, onCook }: RecipeCardProps) => {
    const estimate = useMemo(() => {
        if (recipe.ingredientsText) {
            return calculateRecipeEstimate(recipe.ingredientsText, foodItems);
        }
        return null;
    }, [recipe.ingredientsText, foodItems]);

    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

    const nutritionValues = useMemo(() => {
        if (!estimate) return null;
        const factor = nutritionViewMode === '100g' 
            ? (estimate.totalWeight > 0 ? 100 / estimate.totalWeight : 1 / recipe.servings)
            : (1 / recipe.servings);
            
        return {
            kcal: Math.round(estimate.calories * factor),
            protein: Math.round(estimate.protein * factor),
            price: Math.round(estimate.price * (nutritionViewMode === '100g' ? factor : (1 / recipe.servings)))
        };
    }, [estimate, nutritionViewMode, recipe.servings]);

    return (
        <div
            className="recipe-card"
            onClick={() => onOpen(recipe)}
        >
            <div className="card-top">
                <div className="card-info">
                    <h3>{recipe.name}</h3>
                    <div className="card-meta-row">
                        {totalTime > 0 && <span className="time">⏱️ {totalTime}m</span>}
                        <span className="servings">🍽️ {recipe.servings}p</span>
                        <span className="meal-type">{MEAL_TYPE_LABELS[recipe.mealType || 'dinner']}</span>
                    </div>
                </div>
                <button
                    className="card-delete-btn"
                    onClick={(e) => onDelete(e, recipe.id)}
                >
                    ×
                </button>
            </div>

            {nutritionValues && (
                <div className="card-nutrition-row">
                    <div className="nut-chip kcal">
                        <span className="v">{nutritionValues.kcal}</span>
                        <span className="l">kcal</span>
                    </div>
                    <div className="nut-chip protein">
                        <span className="v">{nutritionValues.protein}g</span>
                        <span className="l">P</span>
                    </div>
                    <div className="nut-chip price">
                        <span className="v">{nutritionValues.price} kr</span>
                        <span className="l">{nutritionViewMode === '100g' ? '/100g' : '/port'}</span>
                    </div>
                </div>
            )}
        </div>
    );
});

interface RecipeViewModalProps {
    recipe: Recipe;
    foodItems: FoodItem[];
    onClose: () => void;
    onEdit: () => void;
    onCook: () => void;
}

const RecipeViewModal = ({ recipe, foodItems, onClose, onEdit, onCook }: RecipeViewModalProps) => {
    const estimate = useMemo(() => {
        return calculateRecipeEstimate(recipe.ingredientsText || '', foodItems, {}, recipe.instructionsText, recipe.name);
    }, [recipe, foodItems]);

    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal recipe-view-modal shadow-2xl wider" onClick={e => e.stopPropagation()}>
                <div className="view-modal-header">
                    <div className="title-area">
                        <span className="category-tag">{MEAL_TYPE_LABELS[recipe.mealType || 'dinner']}</span>
                        <h2>{recipe.name}</h2>
                        <p className="description">{recipe.description}</p>
                    </div>
                    <div className="header-actions">
                        <button className="icon-btn" onClick={onEdit} title="Redigera">✍️</button>
                        <button className="close-btn" onClick={onClose}>×</button>
                    </div>
                </div>


                <div className="view-modal-body">
                    <RecipeNutritionPreview
                        servings={recipe.servings}
                        totalCalories={estimate.calories}
                        totalProtein={estimate.protein}
                        totalCarbs={estimate.carbs}
                        totalFat={estimate.fat}
                        totalWeight={estimate.totalWeight}
                        recipeServings={recipe.servings}
                    />

                    <div className="view-details-grid">
                        <section className="detail-section ingredients-section">
                            <div className="section-card-header">
                                <span className="icon">🛒</span>
                                <h3>Ingredienser</h3>
                            </div>
                            <div className="ingredients-list-premium">
                                {estimate.matchedIngredients.map((mi, idx) => (
                                    <div key={idx} className="ing-item-premium">
                                        <div className="qty-badge">{mi.quantity}{mi.unit}</div>
                                        <div className="name-wrapper">
                                            {mi.foodItem ? (
                                                <a href={`/database?id=${mi.foodItem.id}`} target="_blank" className="ing-link-premium">
                                                    {mi.name}
                                                </a>
                                            ) : (
                                                <span className="unmatched">{mi.name}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="price-footer-premium">
                                <span className="label">Totalkostnad:</span>
                                <span className="val">{estimate.price} kr</span>
                            </div>
                        </section>

                        <section className="detail-section instructions-section">
                            <div className="section-card-header">
                                <span className="icon">👨‍🍳</span>
                                <h3>Instruktioner</h3>
                            </div>
                            <div className="instructions-list-premium">
                                {recipe.instructions.map((step, idx) => (
                                    <div key={idx} className="step-item-premium">
                                        <div className="step-count">{idx + 1}</div>
                                        <div className="step-text">{step}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>

                <div className="view-modal-footer-premium">
                    <button className="btn btn-secondary-outline" onClick={onClose}>Stäng</button>
                    <button className="btn btn-primary-glow btn-wide" onClick={onCook}>Börja Laga</button>
                </div>
            </div>
        </div>
    );
};

export function RecipesPage() {
    const { recipes, addRecipe, updateRecipe, deleteRecipe, foodItems } = useData();
    const { openRecipe } = useCooking();
    const [searchParams] = useSearchParams();
    const hasAutoOpened = useRef(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [formData, setFormData] = useState<RecipeFormState>(EMPTY_FORM);
    const [suggestions, setSuggestions] = useState<FoodItem[]>([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Handle ?action=new
    useEffect(() => {
        if (searchParams.get('action') === 'new' && !hasAutoOpened.current) {
            hasAutoOpened.current = true;
            setTimeout(() => {
                handleOpenForm();
            }, 100);
        }
    }, [searchParams]);

    const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
    const [nutritionViewMode, setNutritionViewMode] = useState<'portion' | '100g'>('portion');
    const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
    const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
    const [debouncedIngredients, setDebouncedIngredients] = useState(formData.ingredientsText);
    const [isCalculating, setIsCalculating] = useState(false);

    // Debounce ingredients text
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            setDebouncedIngredients(formData.ingredientsText);
            setIsCalculating(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [formData.ingredientsText]);

    const liveEstimate = useMemo(() => {
        try {
            if (!debouncedIngredients.trim()) {
                return { 
                    calories: 0, protein: 0, carbs: 0, fat: 0, matchedCount: 0, totalCount: 0, totalWeight: 0, price: 0, co2: 0,
                    matchedIngredients: [], activeTime: 0, passiveTime: 0 
                };
            }
            return calculateRecipeEstimate(debouncedIngredients, foodItems, manualMatches, formData.instructionsText, formData.name);
        } catch (error) {
            console.error("Failed to calculate recipe estimate:", error);
            return { 
                calories: 0, protein: 0, carbs: 0, fat: 0, matchedCount: 0, totalCount: 0, totalWeight: 0, price: 0, co2: 0,
                matchedIngredients: [], activeTime: 0, passiveTime: 0 
            };
        }
    }, [debouncedIngredients, foodItems, formData.instructionsText, formData.name]);

    // Auto-update time based on instructions
    useEffect(() => {
        if (liveEstimate.activeTime > 0 || liveEstimate.passiveTime > 0) {
            setFormData(prev => ({
                ...prev,
                prepTime: liveEstimate.activeTime,
                cookTime: liveEstimate.passiveTime
            }));
        }
    }, [liveEstimate.activeTime, liveEstimate.passiveTime]);



    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFormData({ ...formData, ingredientsText: value });

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = value.substring(0, cursorPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1].trim();

        // Extract query: ignore quantity/unit patterns
        // e.g. "400g tofu" -> query "tofu"
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
        
        // Keep the quantity part if it exists
        const quantityMatch = currentLine.match(/^(\d+(?:[.,]\d+)?\s*[a-zåäö]*\s+)/i);
        const prefix = quantityMatch ? quantityMatch[1] : '';
        
        const newLine = `${prefix}${suggestion.name}`;
        linesBefore[linesBefore.length - 1] = newLine;
        
        const newValue = linesBefore.join('\n') + textAfterCursor;
        setFormData({ ...formData, ingredientsText: newValue });
        setSuggestions([]);

        // Record the manual match to make it "sticky"
        // We use the suggestion name (lowercase) as the key
        const matchKey = suggestion.name.toLowerCase();
        setManualMatches(prev => ({ ...prev, [matchKey]: suggestion.id }));
        
        // Focus back on textarea after some time
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

    const handleOpenForm = useCallback((recipe?: Recipe) => {
        if (recipe) {
            setEditingRecipe(recipe);
            setFormData({
                name: recipe.name,
                description: recipe.description || '',
                servings: recipe.servings,
                prepTime: recipe.prepTime || 0,
                cookTime: recipe.cookTime || 0,
                mealType: recipe.mealType || 'dinner',
                ingredientsText: recipe.ingredientsText || '',
                instructionsText: recipe.instructionsText || recipe.instructions.join('\n'),
                totalWeight: recipe.totalWeight || 0,
                priceCategory: recipe.priceCategory || 'medium',
                seasons: recipe.seasons || [],
            });
            // Try to recover any previous matches if they were stored in the recipe
            // (Requires future-proofing the Recipe type, but we can pre-set it here)
            setManualMatches((recipe as any).manualMatches || {});
        } else {
            setEditingRecipe(null);
            setFormData(EMPTY_FORM);
            setManualMatches({});
        }
        setIsFormOpen(true);
    }, []);

    const handleCloseForm = useCallback(() => {
        setIsFormOpen(false);
        setEditingRecipe(null);
        setFormData(EMPTY_FORM);
        setManualMatches({});
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const recipeData = {
            ...formData,
            ingredients: [],
            instructions: formData.instructionsText.split('\n').filter(line => line.trim()),
            manualMatches, // Save the sticky matches
        };

        if (editingRecipe) {
            updateRecipe(editingRecipe.id, recipeData);
        } else {
            addRecipe(recipeData);
        }
        handleCloseForm();
    };

    const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Är du säker på att du vill ta bort detta recept?')) {
            deleteRecipe(id);
        }
    }, [deleteRecipe]);


    return (
        <div className="recipes-page">
            <header className="page-header">
                <div>
                    <h1>Recept</h1>
                    <p className="page-subtitle">{recipes.length} veganska recept</p>
                </div>
                <div className="header-actions">
                    <div className="view-controls">
                        <div className="control-group">
                            <button 
                                className={`control-btn ${displayMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setDisplayMode('grid')}
                            >
                                ⊞
                            </button>
                            <button 
                                className={`control-btn ${displayMode === 'list' ? 'active' : ''}`}
                                onClick={() => setDisplayMode('list')}
                            >
                                ☰
                            </button>
                        </div>
                        <div className="control-group">
                            <button 
                                className={`control-btn ${nutritionViewMode === 'portion' ? 'active' : ''}`}
                                onClick={() => setNutritionViewMode('portion')}
                            >
                                Port
                            </button>
                            <button 
                                className={`control-btn ${nutritionViewMode === '100g' ? 'active' : ''}`}
                                onClick={() => setNutritionViewMode('100g')}
                            >
                                100g
                            </button>
                        </div>
                    </div>
                    <button className="btn btn-primary" onClick={() => handleOpenForm()}>
                        + Nytt recept
                    </button>
                </div>
            </header>

            {recipes.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">📖</span>
                    <p>Inga recept ännu</p>
                    <button className="btn btn-secondary" onClick={() => handleOpenForm()}>
                        Skapa ditt första recept
                    </button>
                </div>
            ) : (
                <div className={`recipes-${displayMode}`}>
                    {recipes.map(recipe => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            foodItems={foodItems}
                            nutritionViewMode={nutritionViewMode}
                            onOpen={() => setViewingRecipe(recipe)}
                            onDelete={handleDelete}
                            onCook={openRecipe}
                        />
                    ))}
                </div>
            )}

            {/* Recipe Details View Modal */}
            {viewingRecipe && (
                <RecipeViewModal 
                    recipe={viewingRecipe}
                    foodItems={foodItems}
                    onClose={() => setViewingRecipe(null)}
                    onEdit={() => {
                        handleOpenForm(viewingRecipe);
                        setViewingRecipe(null);
                    }}
                    onCook={() => {
                        openRecipe(viewingRecipe);
                        setViewingRecipe(null);
                    }}
                />
            )}

            {/* Recipe Form Modal */}
            {isFormOpen && (
                <div className="modal-overlay" onClick={handleCloseForm}>
                    <div className="modal modal-compact" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header compact">
                            <h2>✨ {editingRecipe ? 'Redigera Recept' : 'Skapa Recept'}</h2>
                            <button className="close-btn" onClick={handleCloseForm}>×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="compact-form">
                            <div className="section-group compact">
                                <div className="form-grid-compact">
                                    <div className="form-group">
                                        <label>Namn</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Namn..."
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Kort beskrivning</label>
                                        <input
                                            type="text"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Beskrivning..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-grid-3 compact-margin">
                                <div className="form-group">
                                    <label>Aktiv (m)</label>
                                    <input
                                        type="number"
                                        value={formData.prepTime}
                                        onChange={(e) => setFormData({ ...formData, prepTime: Number(e.target.value) })}
                                        className="compact-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Passiv (m)</label>
                                    <input
                                        type="number"
                                        value={formData.cookTime}
                                        onChange={(e) => setFormData({ ...formData, cookTime: Number(e.target.value) })}
                                        className="compact-input"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Portioner</label>
                                    <input
                                        type="number"
                                        value={formData.servings}
                                        onChange={(e) => setFormData({ ...formData, servings: Number(e.target.value) || 4 })}
                                        className="compact-input"
                                    />
                                </div>
                            </div>

                            <div className="section-group compact">
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label>Måltid</label>
                                        <div className="meal-type-grid compact">
                                            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    className={`type-chip mini ${formData.mealType === type ? 'active' : ''}`}
                                                    onClick={() => setFormData({ ...formData, mealType: type })}
                                                >
                                                    {MEAL_TYPE_LABELS[type].charAt(0)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Prisnivå</label>
                                        <select
                                            value={formData.priceCategory}
                                            onChange={(e) => setFormData({ ...formData, priceCategory: e.target.value as PriceCategory })}
                                            className="compact-input"
                                        >
                                            <option value="budget">💰 Budget</option>
                                            <option value="medium">⚖️ Medium</option>
                                            <option value="premium">💎 Premium</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="section-group compact content-section">
                                <div className="label-row compact">
                                    <label>Ingredienser</label>
                                    <div className="live-stats-mini">
                                        <span>🔥 {liveEstimate.calories}</span>
                                        <span>💪 {Math.round(liveEstimate.protein)}g</span>
                                        <span>💰 {liveEstimate.price}kr</span>
                                    </div>
                                </div>
                                <div className="textarea-container">
                                    <textarea
                                        ref={textareaRef}
                                        className="ingredients-textarea compact"
                                        value={formData.ingredientsText}
                                        onChange={handleTextareaChange}
                                        onKeyDown={handleKeyDown}
                                        placeholder="400g tofu..."
                                        rows={4}
                                    />
                                    {suggestions.length > 0 && (
                                        <div className="ingredient-suggestions">
                                            {suggestions.map((s, index) => (
                                                <div
                                                    key={s.id}
                                                    className={`suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                                                    onClick={() => applySuggestion(s)}
                                                >
                                                    <span className="suggestion-name">{s.name}</span>
                                                    {s.brand && <span className="suggestion-brand">{s.brand}</span>}
                                                    <div className="suggestion-macros">
                                                        <span>🔥 {s.calories}kcal</span>
                                                        <span>💪 {s.protein}g P</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <p className="form-hint">
                                    {isCalculating ? '⏳ Beräknar...' : `${liveEstimate.matchedCount}/${liveEstimate.totalCount} matchade`}
                                </p>

                                {/* Matched Ingredients Overview */}
                                {liveEstimate.matchedIngredients.length > 0 && (
                                    <div className="matched-ingredients-overview">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Matchade Råvaror</label>
                                        <div className="matched-list">
                                            {liveEstimate.matchedIngredients.map((mi, idx) => (
                                                <div key={`${mi.name}-${idx}`} className="matched-item">
                                                    <div className="matched-item-info">
                                                        <span className={`status-dot ${mi.foodItem ? 'matched' : 'unmatched'}`}></span>
                                                        <span className="mi-name">{mi.originalText}</span>
                                                        {mi.foodItem && (
                                                            <div className="mi-details">
                                                                <span className="mi-food-name">→ {mi.foodItem.name}</span>
                                                                {mi.foodItem.aliases && mi.foodItem.aliases.length > 0 && (
                                                                    <button 
                                                                        type="button"
                                                                        className="alias-btn"
                                                                        title="Ersätt med alias"
                                                                        onClick={() => {
                                                                            const alias = mi.foodItem!.aliases![0];
                                                                            const updated = formData.ingredientsText.replace(mi.name, alias);
                                                                            setFormData({ ...formData, ingredientsText: updated });
                                                                        }}
                                                                    >
                                                                        🏷️ Använd "{mi.foodItem.aliases[0]}"
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {mi.foodItem && (
                                                        <div className="mi-actions">
                                                            <span className="mi-price">{mi.price} kr</span>
                                                            <a 
                                                                href={`/database?id=${mi.foodItem.id}`}
                                                                className="mi-edit-link"
                                                                target="_blank"
                                                                onClick={(e) => {
                                                                    // If we are in the same app, maybe we want to do something smarter
                                                                    // but for now, simple link works
                                                                }}
                                                            >
                                                                ⚙️
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <textarea
                                    className="instructions-textarea compact"
                                    value={formData.instructionsText}
                                    onChange={(e) => setFormData({ ...formData, instructionsText: e.target.value })}
                                    placeholder="Instruktioner..."
                                    rows={3}
                                />
                            </div>

                            <RecipeNutritionPreview
                                servings={formData.servings}
                                totalCalories={liveEstimate.calories}
                                totalProtein={liveEstimate.protein}
                                totalCarbs={liveEstimate.carbs}
                                totalFat={liveEstimate.fat}
                                totalWeight={liveEstimate.totalWeight}
                                recipeServings={formData.servings}
                                onViewModeChange={(mode) => {
                                    if (mode === 'recipe' || mode === 'portion') {
                                        const form = document.querySelector('form');
                                        if (form) form.requestSubmit();
                                    }
                                }}
                            />

                            <div className="section-group">
                                <textarea
                                    className="instructions-textarea"
                                    value={formData.instructionsText}
                                    onChange={(e) => setFormData({ ...formData, instructionsText: e.target.value })}
                                    placeholder={`Pressa vätskan ur tofun med hushållspapper. Tärna den.
Stek tofun gyllene i olja på hög värme. Lägg åt sidan.
I samma panna: tillsätt grönsaker och pressad vitlök.`}
                                    rows={5}
                                />
                            </div>

                            <div className="section-group">
                                <h4 className="section-subtitle">Smarta Planeringsdata</h4>
                                <div className="form-group">
                                    <label>Prisnivå</label>
                                    <select
                                        value={formData.priceCategory}
                                        onChange={(e) => setFormData({ ...formData, priceCategory: e.target.value as PriceCategory })}
                                        className="price-select"
                                    >
                                        <option value="budget">💰 Budget (Billig)</option>
                                        <option value="medium">⚖️ Medium (Normal)</option>
                                        <option value="premium">💎 Premium (Dyr)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Passar i säsong</label>
                                <div className="checkbox-grid">
                                    {([
                                        { id: 'winter', label: 'Vinter ❄️' },
                                        { id: 'spring', label: 'Vår 🌱' },
                                        { id: 'summer', label: 'Sommar ☀️' },
                                        { id: 'autumn', label: 'Höst 🍂' }
                                    ] as const).map(s => (
                                        <label key={s.id} className="checkbox-inline">
                                            <input
                                                type="checkbox"
                                                checked={formData.seasons.includes(s.id)}
                                                onChange={(e) => {
                                                    const current = formData.seasons;
                                                    if (e.target.checked) {
                                                        setFormData({ ...formData, seasons: [...current, s.id as Season] });
                                                    } else {
                                                        setFormData({ ...formData, seasons: current.filter(c => c !== s.id) as Season[] });
                                                    }
                                                }}
                                            />
                                            {s.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={handleCloseForm}>
                                    Avbryt
                                </button>
                                <button type="submit" className="btn btn-primary btn-wide">
                                    💾 Spara ändringar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RecipesPage;
