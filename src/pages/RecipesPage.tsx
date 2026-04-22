import React, { useState, useMemo, useEffect, useRef, memo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext.tsx';
import { useCooking } from '../context/CookingModeProvider.tsx';
import { type FoodItem, type Recipe, MEAL_TYPE_LABELS } from '../models/types.ts';
import { calculateRecipeEstimate } from '../utils/ingredientParser.ts';
import './RecipesPage.css';
import { RecipeNutritionPreview } from '../components/shared/RecipeNutritionPreview.tsx';
import { RecipeFormModal } from '../components/nutrition/RecipeFormModal.tsx';
import { 
    Search, 
    Filter, 
    ChefHat, 
    Clock, 
    Users, 
    Trash2, 
    Edit, 
    Zap, 
    X,
    LayoutGrid, 
    List, 
    Plus, 
    TrendingUp, 
    DollarSign,
    Dumbbell,
    UtensilsCrossed,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    History as HistoryIcon
} from 'lucide-react';

const ITEMS_PER_PAGE = 12;

interface RecipeCardProps {
    recipe: Recipe;
    foodItems: FoodItem[];
    nutritionViewMode: 'portion' | '100g';
    usageCount?: number;
    lastEaten?: string;
    onOpen: (recipe: Recipe) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onCook: (recipe: Recipe) => void;
}

const RecipeCard = memo(({ recipe, foodItems, nutritionViewMode, onOpen, onDelete, onCook, usageCount, lastEaten }: RecipeCardProps) => {
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
            carbs: Math.round(estimate.carbs * factor),
            fat: Math.round(estimate.fat * factor),
            price: Math.round(estimate.price * (nutritionViewMode === '100g' ? factor : (1 / recipe.servings)))
        };
    }, [estimate, nutritionViewMode, recipe.servings]);

    return (
        <div className="recipe-card-premium" onClick={() => onOpen(recipe)}>
            <div className="card-content">
                <div className="flex justify-between items-start mb-1">
                    <div className="flex flex-col">
                        <span className="meal-tag text-[8px] font-black uppercase tracking-widest text-indigo-400 opacity-80">
                            {MEAL_TYPE_LABELS[recipe.mealType || 'dinner']}
                        </span>
                        {usageCount ? (
                            <span className="text-[7px] font-black text-amber-500/80 uppercase">🔥 {usageCount} gånger</span>
                        ) : null}
                    </div>
                    <button className="text-slate-600 hover:text-rose-500 transition-colors" onClick={(e) => onDelete(e, recipe.id)}>
                        <Trash2 size={12} />
                    </button>
                </div>
                
                <h3 className="recipe-title">{recipe.name}</h3>
                <div className="flex justify-between items-baseline mb-2">
                    <p className="recipe-desc opacity-50 flex-1">{recipe.description || 'Vegansk måltid.'}</p>
                    {lastEaten && <span className="text-[7px] text-slate-500 font-bold ml-2 whitespace-nowrap">⏳ {lastEaten}</span>}
                </div>
                
                <div className="recipe-meta">
                    <div className="meta-item">
                        <Clock size={10} className="text-slate-500" />
                        <span>{totalTime > 0 ? `${totalTime}m` : 'Snabb'}</span>
                    </div>
                    <div className="meta-item">
                        <Users size={10} className="text-slate-500" />
                        <span>{recipe.servings}p</span>
                    </div>
                    <div className="meta-item">
                        <DollarSign size={10} className="text-amber-500/50" />
                        <span className="text-amber-500/80">{nutritionValues?.price} kr</span>
                    </div>
                </div>

                {nutritionValues && (
                    <div className="recipe-nutrition-grid">
                        <div className="nut-stat bg-rose-500/5">
                            <span className="val text-rose-400">{nutritionValues.kcal}</span>
                            <span className="lab">KC</span>
                        </div>
                        <div className="nut-stat bg-emerald-500/5">
                            <span className="val text-emerald-400">{nutritionValues.protein}g</span>
                            <span className="lab">P</span>
                        </div>
                        <div className="nut-stat bg-blue-500/5">
                            <span className="val text-blue-400">{nutritionValues.carbs}g</span>
                            <span className="lab">K</span>
                        </div>
                        <div className="nut-stat bg-amber-500/5">
                            <span className="val text-amber-400">{nutritionValues.fat}g</span>
                            <span className="lab">F</span>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="card-footer">
                <button className="btn-cook-glow" onClick={(e) => { e.stopPropagation(); onCook(recipe); }}>
                    Laga Nu
                </button>
            </div>
        </div>
    );
});

interface RecipeViewModalProps {
    recipe: Recipe;
    foodItems: FoodItem[];
    onClose: () => void;
    onEdit: () => void;
    onCook: () => void;
    usageCount?: number;
    lastEaten?: string;
}

const RecipeViewModal = ({ recipe, foodItems, onClose, onEdit, onCook, usageCount, lastEaten }: RecipeViewModalProps) => {
    const estimate = useMemo(() => {
        return calculateRecipeEstimate(recipe.ingredientsText || '', foodItems, {}, recipe.instructionsText, recipe.name);
    }, [recipe, foodItems]);

    return (
        <div className="modal-overlay-premium" onClick={onClose}>
            <div className="recipe-details-modal" onClick={e => e.stopPropagation()}>
                <div className="preview-top">
                    <div className="preview-header">
                        <div className="top-meta">
                            <span className="meal-tag">{MEAL_TYPE_LABELS[recipe.mealType || 'dinner']}</span>
                            <div className="header-actions">
                                <button className="action-circle-btn" onClick={onEdit}><Edit size={14} /></button>
                                <button className="action-circle-btn close" onClick={onClose}><X size={14} /></button>
                            </div>
                        </div>
                        <h2 className="preview-title">{recipe.name}</h2>
                        <p className="preview-desc">{recipe.description}</p>
                    </div>

                    <div className="preview-stats-bar">
                        <div className="p-stat">
                            <Clock size={14} className="text-indigo-400" />
                            <div className="v-stack">
                                <span className="v">{(recipe.prepTime || 0) + (recipe.cookTime || 0)}m</span>
                                <span className="l">Tid</span>
                            </div>
                        </div>
                        <div className="p-stat">
                            <Users size={14} className="text-emerald-400" />
                            <div className="v-stack">
                                <span className="v">{recipe.servings} st</span>
                                <span className="l">Port</span>
                            </div>
                        </div>
                        <div className="p-stat">
                            <Zap size={14} className="text-rose-400" />
                            <div className="v-stack">
                                <span className="v">{Math.round(estimate.calories / recipe.servings)}</span>
                                <span className="l">kcal/p</span>
                            </div>
                        </div>
                        <div className="p-stat">
                            <HistoryIcon size={14} className="text-amber-400" />
                            <div className="v-stack">
                                <span className="v">{usageCount} ggr</span>
                                <span className="l">Senast: {lastEaten}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="preview-body">
                    <div className="preview-grid">
                        <section className="preview-section">
                            <h3 className="section-header"><UtensilsCrossed size={12} /> Ingredienser</h3>
                            <div className="premium-ing-list">
                                {estimate.matchedIngredients.map((mi, idx) => (
                                    <div key={idx} className="premium-ing-item">
                                        <div className="ing-info">
                                            <span className="ing-name text-[13px]">{mi.name}</span>
                                            <span className="ing-qty text-[11px] font-mono">{mi.quantity}{mi.unit}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="preview-section">
                            <h3 className="section-header"><ChefHat size={12} /> Instruktioner</h3>
                            <div className="premium-steps-list">
                                {(recipe.instructions || []).map((step, idx) => (
                                    <div key={idx} className="premium-step">
                                        <div className="step-num">{idx + 1}</div>
                                        <div className="step-content text-[14px] leading-relaxed opacity-80">{step}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5">
                        <RecipeNutritionPreview 
                            servings={recipe.servings}
                            totalCalories={estimate.calories}
                            totalProtein={estimate.protein}
                            totalCarbs={estimate.carbs}
                            totalFat={estimate.fat}
                            totalWeight={estimate.totalWeight}
                            recipeServings={recipe.servings}
                        />
                    </div>
                </div>

                <div className="preview-footer">
                    <button className="btn-secondary-premium mr-2" onClick={onEdit}>
                        <Edit size={14} />
                        Redigera
                    </button>
                    <button className="btn-cook-big" onClick={onCook}>
                        <Zap size={16} fill="currentColor" />
                        Börja Tillaga
                    </button>
                </div>
            </div>
        </div>
    );
};

const RecipeListItem = memo(({ recipe, foodItems, nutritionViewMode, onOpen, onDelete, onCook, usageCount, lastEaten }: RecipeCardProps) => {
    const estimate = useMemo(() => {
        if (recipe.ingredientsText) {
            return calculateRecipeEstimate(recipe.ingredientsText, foodItems);
        }
        return null;
    }, [recipe.ingredientsText, foodItems]);

    const factor = nutritionViewMode === '100g' 
        ? (estimate?.totalWeight ? 100 / estimate.totalWeight : 1 / recipe.servings)
        : (1 / recipe.servings);

    return (
        <div className="recipe-card-premium list-item" onClick={() => onOpen(recipe)}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex flex-col w-8">
                    <span className="text-[8px] font-black uppercase text-indigo-400/60 leading-none">{MEAL_TYPE_LABELS[recipe.mealType || 'dinner'].substring(0, 3)}</span>
                    {usageCount ? <span className="text-[6px] font-black text-amber-500/60 leading-none mt-0.5">🔥{usageCount}</span> : null}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <h3 className="recipe-title">{recipe.name}</h3>
                    {lastEaten && <span className="text-[7px] text-slate-500 font-bold opacity-60">Senast: {lastEaten}</span>}
                </div>
            </div>
            
            <div className="recipe-meta">
                <div className="meta-item"><Clock size={10} /> {recipe.prepTime + recipe.cookTime}m</div>
                <div className="meta-item"><Users size={10} /> {recipe.servings}p</div>
            </div>

            <div className="recipe-nutrition-grid">
                 <div className="nut-stat"><span className="val">{Math.round(estimate!.calories * factor)}</span><span className="lab">KC</span></div>
                 <div className="nut-stat"><span className="val">{Math.round(estimate!.protein * factor)}g</span><span className="lab">P</span></div>
                 <div className="nut-stat"><span className="val">{Math.round(estimate!.price * (nutritionViewMode === '100g' ? factor : (1 / recipe.servings)))}kr</span><span className="lab">PR</span></div>
            </div>

            <div className="card-footer">
                <button className="btn-cook-glow" onClick={(e) => { e.stopPropagation(); onCook(recipe); }}>Laga</button>
                <button className="p-1.5 text-slate-600 hover:text-rose-500 transition-colors" onClick={(e) => onDelete(e, recipe.id)}><Trash2 size={12} /></button>
            </div>
        </div>
    );
});

export function RecipesPage() {
    const { recipes, deleteRecipe, foodItems, mealEntries } = useData();
    const { openRecipe } = useCooking();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const hasAutoOpened = useRef(false);
    
    // State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
    const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
    const [nutritionViewMode, setNutritionViewMode] = useState<'portion' | '100g'>('portion');
    
    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [mealTypeFilter, setMealTypeFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'name' | 'calories' | 'protein' | 'price' | 'most_cooked'>('most_cooked');
    const [currentPage, setCurrentPage] = useState(1);

    // Auto-open logic
    useEffect(() => {
        if (searchParams.get('action') === 'new' && !hasAutoOpened.current) {
            hasAutoOpened.current = true;
            setIsFormOpen(true);
        }
    }, [searchParams]);    // Derived Data with Estimates and Usage Stats
    const recipesWithUsage = useMemo(() => {
        const usageMap: Record<string, { count: number; lastDate: string }> = {};
        
        // Scan all meal entries to find recipe usage
        mealEntries.forEach(entry => {
            entry.items.forEach(item => {
                if (item.type === 'recipe' && item.referenceId) {
                    const id = item.referenceId;
                    if (!usageMap[id]) {
                        usageMap[id] = { count: 0, lastDate: entry.date };
                    }
                    usageMap[id].count++;
                    if (entry.date > usageMap[id].lastDate) {
                        usageMap[id].lastDate = entry.date;
                    }
                }
            });
        });

        return recipes.map(r => {
            const estimate = calculateRecipeEstimate(r.ingredientsText || '', foodItems);
            const usage = usageMap[r.id] || { count: 0, lastDate: '' };
            return {
                ...r,
                estimate,
                usageCount: usage.count,
                lastEatenDate: usage.lastDate
            };
        });
    }, [recipes, mealEntries, foodItems]);

    // Filtering & Sorting
    const filteredRecipes = useMemo(() => {
        let result = recipesWithUsage.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                r.ingredientsText?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = mealTypeFilter === 'all' || r.mealType === mealTypeFilter;
            return matchesSearch && matchesType;
        });

        result.sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'calories') return (b.estimate.calories / b.servings) - (a.estimate.calories / a.servings);
            if (sortBy === 'protein') return (b.estimate.protein / b.servings) - (a.estimate.protein / a.servings);
            if (sortBy === 'price') return (a.estimate.price / a.servings) - (b.estimate.price / b.servings);
            if (sortBy === 'most_cooked') {
                if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
                return b.createdAt.localeCompare(a.createdAt);
            }
            return 0;
        });

        return result;
    }, [recipesWithUsage, searchTerm, mealTypeFilter, sortBy]);

    // Pagination
    const totalPages = Math.ceil(filteredRecipes.length / ITEMS_PER_PAGE);
    const paginatedRecipes = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredRecipes.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredRecipes, currentPage]);

    // Stats
    const stats = useMemo(() => {
        if (recipesWithUsage.length === 0) return null;
        const total = recipesWithUsage.length;
        const avgKcal = Math.round(recipesWithUsage.reduce((sum, r) => sum + (r.estimate.calories / r.servings), 0) / total);
        const avgProt = Math.round(recipesWithUsage.reduce((sum, r) => sum + (r.estimate.protein / r.servings), 0) / total);
        const avgPrice = Math.round(recipesWithUsage.reduce((sum, r) => sum + (r.estimate.price / r.servings), 0) / total);
        return { total, avgKcal, avgProt, avgPrice };
    }, [recipesWithUsage]);

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

    const getTimeAgo = (dateStr: string) => {
        if (!dateStr) return 'Aldrig';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 0) return 'Idag';
        if (diffDays === 1) return 'Igår';
        if (diffDays < 7) return `${diffDays}d sedan`;
        return dateStr;
    };

    return (
        <div className="recipes-container-premium">
            {/* 1. Header & Stats Bar */}
            <header className="premium-header">
                <div className="title-section">
                    <div className="badge-new">
                        <Sparkles size={10} />
                        <span>Kockläge</span>
                    </div>
                    <h1>Mina Recept</h1>
                </div>
                
                {stats && (
                    <div className="stats-dashboard">
                        <div className="stat-card">
                            <span className="lab">Totalt</span>
                            <span className="val">{stats.total}</span>
                        </div>
                        <div className="stat-card">
                            <TrendingUp size={10} className="icon kcal" />
                            <span className="val">{stats.avgKcal}</span>
                            <span className="lab">kcal/p</span>
                        </div>
                        <div className="stat-card">
                            <Dumbbell size={10} className="icon protein" />
                            <span className="val">{stats.avgProt}g</span>
                            <span className="lab">p/p</span>
                        </div>
                        <div className="stat-card">
                            <DollarSign size={10} className="icon price" />
                            <span className="val">{stats.avgPrice}kr</span>
                            <span className="lab">kr/p</span>
                        </div>
                    </div>
                )}

                <button className="btn-add-premium" onClick={() => handleOpenForm()}>
                    <Plus size={14} />
                    <span>Nytt Recept</span>
                </button>
            </header>

            {/* 2. Search & Controls */}
            <div className="controls-bar-premium">
                <div className="search-box">
                    <Search size={14} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Sök recept/ingredienser..." 
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>

                <div className="filters-row">
                    <div className="type-pills">
                        {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                            <button 
                                key={type} 
                                className={`pill-btn ${mealTypeFilter === type ? 'active' : ''}`}
                                onClick={() => { setMealTypeFilter(type); setCurrentPage(1); }}
                            >
                                {type === 'all' ? 'Alla' : MEAL_TYPE_LABELS[type as keyof typeof MEAL_TYPE_LABELS]}
                            </button>
                        ))}
                    </div>

                    <div className="sort-group-premium">
                        <ArrowUpDown size={12} className="text-slate-500" />
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                            <option value="name">Namn</option>
                            <option value="most_cooked">Mest lagat 🔥</option>
                            <option value="calories">Energi (Kcal)</option>
                            <option value="protein">Protein (Mest)</option>
                            <option value="price">Pris (Lägst)</option>
                        </select>
                    </div>

                    <div className="toggle-group">
                        <button onClick={() => setDisplayMode('grid')} className={displayMode === 'grid' ? 'active' : ''} title="Gallerivy"><LayoutGrid size={14} /></button>
                        <button onClick={() => setDisplayMode('list')} className={displayMode === 'list' ? 'active' : ''} title="Listvy"><List size={14} /></button>
                    </div>

                    <div className="view-mode-pills">
                        <button onClick={() => setNutritionViewMode('portion')} className={nutritionViewMode === 'portion' ? 'active' : ''}>Port</button>
                        <button onClick={() => setNutritionViewMode('100g')} className={nutritionViewMode === '100g' ? 'active' : ''}>100g</button>
                    </div>
                </div>
            </div>

            {/* 3. Content Grid */}
            {recipes.length === 0 ? (
                <div className="empty-state-premium">
                    <div className="chef-icon-bg"><ChefHat size={32} /></div>
                    <h2>Receptboken är tom</h2>
                    <button className="btn-add-premium mt-4" onClick={() => handleOpenForm()}>Skapa recept</button>
                </div>
            ) : filteredRecipes.length === 0 ? (
                <div className="empty-state-premium">
                    <Search size={32} className="opacity-20 mb-2" />
                    <p>Inga träffar</p>
                </div>
            ) : (
                <>
                    <div className={`recipes-display-${displayMode}`}>
                        {paginatedRecipes.map((recipe: any) => (
                            displayMode === 'grid' ? (
                                <RecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    foodItems={foodItems}
                                    nutritionViewMode={nutritionViewMode}
                                    onOpen={() => setViewingRecipe(recipe)}
                                    onDelete={handleDelete}
                                    onCook={openRecipe}
                                    usageCount={recipe.usageCount}
                                    lastEaten={getTimeAgo(recipe.lastEatenDate)}
                                />
                            ) : (
                                <RecipeListItem
                                    key={recipe.id}
                                    recipe={recipe}
                                    foodItems={foodItems}
                                    nutritionViewMode={nutritionViewMode}
                                    onOpen={() => setViewingRecipe(recipe)}
                                    onDelete={handleDelete}
                                    onCook={openRecipe}
                                    usageCount={recipe.usageCount}
                                    lastEaten={getTimeAgo(recipe.lastEatenDate)}
                                />
                            )
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination-premium">
                            <button 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="page-btn"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <div className="page-info">
                                Sida <span>{currentPage}</span> av {totalPages}
                            </div>
                            <button 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="page-btn"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </>
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
                    usageCount={recipesWithUsage.find(r => r.id === viewingRecipe.id)?.usageCount || 0}
                    lastEaten={getTimeAgo(recipesWithUsage.find(r => r.id === viewingRecipe.id)?.lastEatenDate || '')}
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
