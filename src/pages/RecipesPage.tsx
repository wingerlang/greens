import React, { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useCooking } from '../context/CookingModeProvider.tsx';
import { type FoodItem, type Recipe, MEAL_TYPE_LABELS } from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import './RecipesPage.css';
import { RecipeNutritionPreview } from '../components/shared/RecipeNutritionPreview.tsx';
import { RecipeFormModal } from '../components/nutrition/RecipeFormModal.tsx';

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
        <div className="recipe-card" onClick={() => onOpen(recipe)}>
            <div className="card-top">
                <div className="card-info">
                    <h3>{recipe.name}</h3>
                    <div className="card-meta-row">
                        {totalTime > 0 && <span className="time">⏱️ {totalTime}m</span>}
                        <span className="servings">🍽️ {recipe.servings}p</span>
                        <span className="meal-type">{MEAL_TYPE_LABELS[recipe.mealType || 'dinner']}</span>
                    </div>
                </div>
                <button className="card-delete-btn" onClick={(e) => onDelete(e, recipe.id)}>×</button>
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
                                {(recipe.instructions || []).map((step, idx) => (
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
    const { recipes, deleteRecipe, foodItems } = useData();
    const { openRecipe } = useCooking();
    const [searchParams] = useSearchParams();
    const hasAutoOpened = useRef(false);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
    const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
    const [nutritionViewMode, setNutritionViewMode] = useState<'portion' | '100g'>('portion');

    // Handle ?action=new
    useEffect(() => {
        if (searchParams.get('action') === 'new' && !hasAutoOpened.current) {
            hasAutoOpened.current = true;
            setIsFormOpen(true);
        }
    }, [searchParams]);

    const handleOpenForm = useCallback((recipe?: Recipe) => {
        setEditingRecipe(recipe || null);
        setIsFormOpen(true);
    }, []);

    const handleCloseForm = useCallback(() => {
        setIsFormOpen(false);
        setEditingRecipe(null);
    }, []);

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
                    <p className="page-subtitle">{recipes.length} veganska rätter</p>
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
            <RecipeFormModal 
                isOpen={isFormOpen}
                onClose={handleCloseForm}
                editingRecipe={editingRecipe}
            />
        </div>
    );
}

export default RecipesPage;
