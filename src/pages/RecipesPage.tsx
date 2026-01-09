import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useCooking } from '../context/CookingModeProvider.tsx';
import { type Recipe, type MealType, type PriceCategory, type Season, MEAL_TYPE_LABELS } from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import './RecipesPage.css';

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

export function RecipesPage() {
    const { recipes, addRecipe, updateRecipe, deleteRecipe, foodItems } = useData();
    const { openRecipe } = useCooking();
    const [searchParams] = useSearchParams();
    const hasAutoOpened = useRef(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [formData, setFormData] = useState<RecipeFormState>(EMPTY_FORM);

    // Handle ?action=new
    useEffect(() => {
        if (searchParams.get('action') === 'new' && !hasAutoOpened.current) {
            hasAutoOpened.current = true;
            setTimeout(() => {
                handleOpenForm();
            }, 100);
        }
    }, [searchParams]);

    // Live nutrition estimate
    const liveEstimate = useMemo(() => {
        return calculateRecipeEstimate(formData.ingredientsText, foodItems);
    }, [formData.ingredientsText, foodItems]);

    const perServing = useMemo(() => ({
        calories: Math.round(liveEstimate.calories / formData.servings),
        protein: Math.round(liveEstimate.protein / formData.servings),
        price: Math.round(liveEstimate.price / formData.servings),
        co2: Math.round((liveEstimate.co2 / formData.servings) * 100) / 100,
    }), [liveEstimate, formData.servings]);

    const handleOpenForm = (recipe?: Recipe) => {
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
        } else {
            setEditingRecipe(null);
            setFormData(EMPTY_FORM);
        }
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingRecipe(null);
        setFormData(EMPTY_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const recipeData = {
            name: formData.name,
            description: formData.description,
            servings: formData.servings,
            prepTime: formData.prepTime,
            cookTime: formData.cookTime,
            mealType: formData.mealType,
            ingredientsText: formData.ingredientsText,
            instructionsText: formData.instructionsText,
            totalWeight: formData.totalWeight || liveEstimate.calories * 2,
            priceCategory: formData.priceCategory,
            seasons: formData.seasons,
            ingredients: [],
            instructions: formData.instructionsText.split('\n').filter(line => line.trim()),
        };

        if (editingRecipe) {
            updateRecipe(editingRecipe.id, recipeData);
        } else {
            addRecipe(recipeData);
        }
        handleCloseForm();
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Är du säker på att du vill ta bort detta recept?')) {
            deleteRecipe(id);
        }
    };

    // Calculate estimate for a recipe
    const getRecipeEstimate = (recipe: Recipe) => {
        if (recipe.ingredientsText) {
            return calculateRecipeEstimate(recipe.ingredientsText, foodItems);
        }
        return null;
    };

    return (
        <div className="recipes-page">
            <header className="page-header">
                <div>
                    <h1>Recept</h1>
                    <p className="page-subtitle">{recipes.length} veganska recept</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenForm()}>
                    + Nytt recept
                </button>
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
                <div className="recipes-grid">
                    {recipes.map(recipe => {
                        const estimate = getRecipeEstimate(recipe);
                        const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

                        return (
                            <div
                                key={recipe.id}
                                className="recipe-card"
                                onClick={() => handleOpenForm(recipe)}
                            >
                                <div className="recipe-card-header">
                                    <h3>{recipe.name}</h3>
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => handleDelete(e, recipe.id)}
                                        title="Ta bort"
                                    >
                                        ×
                                    </button>
                                </div>

                                <p className="recipe-description">{recipe.description}</p>

                                <div className="recipe-meta">
                                    {totalTime > 0 && <span>⏱️ {totalTime} min</span>}
                                    <span>🍽️ {recipe.servings} port</span>
                                    {recipe.mealType && (
                                        <span className="meal-badge">{MEAL_TYPE_LABELS[recipe.mealType]}</span>
                                    )}
                                </div>

                                {estimate && (
                                    <div className="recipe-nutrition">
                                        <div className="nutrition-item calories">
                                            <span className="value">{Math.round(estimate.calories / recipe.servings)}</span>
                                            <span className="label">kcal</span>
                                        </div>
                                        <div className="nutrition-item">
                                            <span className="value">{Math.round(estimate.protein / recipe.servings)}g</span>
                                            <span className="label">protein</span>
                                        </div>
                                        <div className="nutrition-item">
                                            <span className="value">{Math.round(estimate.price / recipe.servings)} kr</span>
                                            <span className="label">pris</span>
                                        </div>
                                        <div className="nutrition-item co2">
                                            <span className="value">{(estimate.co2 / recipe.servings).toFixed(1)}</span>
                                            <span className="label">kg CO₂</span>
                                        </div>
                                    </div>
                                )}

                                <div className="recipe-actions">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openRecipe(recipe);
                                        }}
                                    >
                                        🍳 Laga
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Recipe Form Modal */}
            {isFormOpen && (
                <div className="modal-overlay" onClick={handleCloseForm}>
                    <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>✨ {editingRecipe ? 'Redigera Recept' : 'Skapa Recept'}</h2>
                            <button className="close-btn" onClick={handleCloseForm}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>NAMN PÅ RÄTTEN</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="t.ex. Stekt Ris med Tofu"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>BESKRIVNING</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Kort beskrivning"
                                    />
                                </div>
                            </div>

                            <div className="form-row form-row-4">
                                <div className="form-group">
                                    <label>TID (MIN)</label>
                                    <input
                                        type="number"
                                        value={formData.prepTime + formData.cookTime}
                                        onChange={(e) => setFormData({ ...formData, cookTime: Number(e.target.value) })}
                                        min="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>TYP</label>
                                    <div className="meal-type-buttons">
                                        {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`type-btn ${formData.mealType === type ? 'active' : ''}`}
                                                onClick={() => setFormData({ ...formData, mealType: type })}
                                            >
                                                {MEAL_TYPE_LABELS[type]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>PORTIONER</label>
                                    <input
                                        type="number"
                                        value={formData.servings}
                                        onChange={(e) => setFormData({ ...formData, servings: Number(e.target.value) || 4 })}
                                        min="1"
                                        max="20"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <div className="label-row">
                                    <label>INGREDIENSER (EN PER RAD)</label>
                                    <div className="live-estimate">
                                        <span className="estimate-item">🔥 {liveEstimate.calories} kcal</span>
                                        <span className="estimate-item">💪 {Math.round(liveEstimate.protein)}g</span>
                                        <span className="estimate-item price">💰 {liveEstimate.price} kr</span>
                                        <span className="estimate-item co2">♻️ {liveEstimate.co2.toFixed(1)} kg</span>
                                    </div>
                                </div>
                                <textarea
                                    className="ingredients-textarea"
                                    value={formData.ingredientsText}
                                    onChange={(e) => setFormData({ ...formData, ingredientsText: e.target.value })}
                                    placeholder={`4 port ris (gärna kallt)
400g fast tofu
1 påse wokgrönsaker
Soja
Sesamolja
1 vitlöksklyfta`}
                                    rows={6}
                                />
                                <p className="form-hint">
                                    {liveEstimate.matchedCount}/{liveEstimate.totalCount} ingredienser matchade •
                                    ~{perServing.calories} kcal/portion
                                </p>
                            </div>

                            <div className="form-group">
                                <label>INSTRUKTIONER (EN PER RAD)</label>
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

                            <h3 className="form-section-title">Smart Plan Data</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>PRISNIVÅ</label>
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
                                <label>PASSAR I SÄSONG</label>
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
