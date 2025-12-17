/**
 * RecipeDetailModal - Recipe preview with cooking mode entry
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { type Recipe, type FoodItem } from '../../models/types.ts';
import { calculateRecipeEstimate, matchToFoodItem, calculateIngredientNutrition, parseIngredients } from '../../utils/ingredientParser.ts';
import { formatIngredientQuantity } from '../../utils/unitHelper.ts';
import { parseIngredientLine, scaleAmount, type MatchedIngredient } from '../../utils/stepParser.ts';
import { type IngredientCustomizations, type ScaledIngredient } from '../../hooks/useCookingSession.ts';
import { findSmartSwaps, type SwapSuggestion } from '../../utils/smartSwaps.ts';
import './RecipeDetailModal.css';

interface RecipeDetailModalProps {
    recipe: Recipe;
    foodItems: FoodItem[];
    onClose: () => void;
    onStartCooking: (recipe: Recipe, portions: number, customizations?: IngredientCustomizations) => void;
    isActive?: boolean;
    // Optional: For planned meals with swaps
    plannedSwaps?: Record<string, string>; // originalItemId -> newItemId
    onSwapsChange?: (swaps: Record<string, string>) => void;
}

const PORTION_OPTIONS = [2, 4, 6, 8];

export function RecipeDetailModal({
    recipe,
    foodItems,
    onClose,
    onStartCooking,
    isActive = true,
    plannedSwaps = {},
    onSwapsChange,
}: RecipeDetailModalProps) {
    const [portions, setPortions] = useState(recipe.servings || 4);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
    const [proteinBoost, setProteinBoost] = useState(0); // 0 = normal, 1 = +50%, 2 = +100%
    const [proteinAnimating, setProteinAnimating] = useState(false);
    const [showBreakdown, setShowBreakdown] = useState(false); // Toggle ingredient breakdown
    const [customizeMode, setCustomizeMode] = useState(false); // Toggle customization mode
    const [excludedIngredients, setExcludedIngredients] = useState<Set<number>>(new Set()); // Excluded ingredient indices
    const [ingredientMultipliers, setIngredientMultipliers] = useState<Map<number, number>>(new Map()); // Per-ingredient quantity adjustments

    // Local swap state - initialized from plannedSwaps prop (no sync needed since we control locally)
    const [activeSwaps, setActiveSwaps] = useState<Record<string, string>>(plannedSwaps);

    // Toggle swap function
    const toggleSwap = useCallback((originalItemId: string, newItemId: string) => {
        setActiveSwaps(prev => {
            const next = { ...prev };
            if (prev[originalItemId] === newItemId) {
                delete next[originalItemId];
            } else {
                next[originalItemId] = newItemId;
            }
            // Notify parent of change
            if (onSwapsChange) {
                onSwapsChange(next);
            }
            return next;
        });
    }, [onSwapsChange]);

    // Calculate smart swaps for this recipe
    const smartSwaps = useMemo(() => {
        if (!recipe.ingredientsText) return [];
        const parsed = parseIngredients(recipe.ingredientsText);
        return findSmartSwaps(parsed, foodItems);
    }, [recipe.ingredientsText, foodItems]);

    // Calculate portion multiplier
    const basePortions = recipe.servings || 4;
    const multiplier = portions / basePortions;

    // ESC key to close modal
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (isActive && e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose, isActive]);

    // Update URL when modal opens (optional - uses native history API)
    useEffect(() => {
        try {
            const recipeSlug = recipe.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-åäö]/g, '');
            const newPath = `/vecka/recept/${recipe.id}/${recipeSlug}`;
            const currentPath = window.location.pathname;
            // Only update if we're on the weekly page
            if (currentPath.startsWith('/vecka') || currentPath === '/' || currentPath === '') {
                window.history.replaceState(null, '', newPath);
            }
        } catch (e) {
            console.log('URL update skipped');
        }

        // Restore URL on close
        return () => {
            try {
                if (window.location.pathname.includes('/recept/')) {
                    window.history.replaceState(null, '', '/vecka');
                }
            } catch (e) {
                // Ignore
            }
        };
    }, [recipe.id, recipe.name]);

    // Parse and scale ingredients with protein boost AND customizations
    const scaledIngredients = useMemo(() => {
        if (!recipe.ingredientsText) return [];

        const proteinFoods = ['linser', 'tofu', 'bönor', 'kikärtor', 'tempeh', 'seitan'];
        const boostMultiplier = 1 + (proteinBoost * 0.5); // 1, 1.5, 2

        return recipe.ingredientsText
            .split('\n')
            .map(line => parseIngredientLine(line))
            .filter((i): i is MatchedIngredient => i !== null)
            .map((ing, index) => {
                const isProteinFood = proteinFoods.some(p => ing.name.toLowerCase().includes(p));
                const customMultiplier = ingredientMultipliers.get(index) || 1;
                const isExcluded = excludedIngredients.has(index);
                const finalMultiplier = isExcluded ? 0 : (isProteinFood ? multiplier * boostMultiplier : multiplier) * customMultiplier;
                return {
                    ...ing,
                    scaledAmount: isExcluded ? '0' : scaleAmount(ing.amount, finalMultiplier),
                    isBoosted: isProteinFood && proteinBoost > 0,
                    isExcluded,
                    customMultiplier,
                };
            });
    }, [recipe.ingredientsText, multiplier, proteinBoost, ingredientMultipliers, excludedIngredients]);

    // Calculate full nutrition (total and per portion)
    const nutrition = useMemo(() => {
        if (!scaledIngredients.length) return {
            total: { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0, co2: 0 },
            perPortion: { calories: 0, protein: 0, carbs: 0, fat: 0, price: 0, co2: 0 }
        };

        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let totalPrice = 0;
        let totalCo2 = 0;

        scaledIngredients.forEach((ing: ScaledIngredient) => {
            // Skip excluded ingredients
            if (ing.isExcluded) return;

            // Find food item
            // We construct a ParsedIngredient-like object for matching
            const parsedLike = {
                name: ing.name,
                unit: ing.unit,
                quantity: 1, // Quantity doesn't matter for matching
                originalText: ing.originalText
            };
            const foodItem = matchToFoodItem(parsedLike, foodItems);

            if (foodItem) {
                // Parse amount string to number
                const normalizeAmount = (str: string) => parseFloat(str.replace(',', '.'));
                const quantity = normalizeAmount(ing.scaledAmount);

                if (!isNaN(quantity)) {
                    const { nutrition, price, co2 } = calculateIngredientNutrition(
                        { ...parsedLike, quantity },
                        foodItem
                    );

                    totalCalories += nutrition.calories;
                    totalProtein += nutrition.protein;
                    totalCarbs += nutrition.carbs;
                    totalFat += nutrition.fat;
                    totalPrice += price;
                    totalCo2 += co2;
                }
            }
        });

        const total = {
            calories: Math.round(totalCalories),
            protein: Math.round(totalProtein),
            carbs: Math.round(totalCarbs),
            fat: Math.round(totalFat),
            price: Math.round(totalPrice),
            co2: Math.round(totalCo2 * 100) / 100,
        };

        return {
            total,
            perPortion: {
                calories: Math.round(total.calories / portions),
                protein: Math.round(total.protein / portions),
                carbs: Math.round(total.carbs / portions),
                fat: Math.round(total.fat / portions),
                price: Math.round(total.price / portions),
                co2: Math.round((total.co2 / portions) * 100) / 100,
            }
        };
    }, [scaledIngredients, foodItems, portions]);

    // Parse instructions into steps
    const steps = useMemo(() => {
        if (!recipe.instructionsText) return [];
        return recipe.instructionsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }, [recipe.instructionsText]);

    // Find high-protein ingredient for suggestion
    const proteinSuggestion = useMemo(() => {
        const proteinFoods = ['linser', 'tofu', 'bönor', 'kikärtor', 'tempeh', 'seitan'];
        const found = scaledIngredients.find((ing: ScaledIngredient) =>
            proteinFoods.some(p => ing.name.toLowerCase().includes(p))
        );
        if (found) {
            return {
                name: found.name,
                proteinPer100g: 24, // Example value
            };
        }
        return null;
    }, [scaledIngredients]);

    // Toggle step completion
    const toggleStep = useCallback((stepIndex: number) => {
        setCompletedSteps((prev: Set<number>) => {
            const next = new Set(prev);
            if (next.has(stepIndex)) {
                next.delete(stepIndex);
            } else {
                next.add(stepIndex);
            }
            return next;
        });
    }, []);

    // Handle protein boost
    const handleProteinBoost = useCallback(() => {
        if (proteinBoost < 2) {
            setProteinAnimating(true);
            setProteinBoost((prev: number) => prev + 1);
            setTimeout(() => setProteinAnimating(false), 600);
        }
    }, [proteinBoost]);

    // Reset protein boost
    const resetProteinBoost = useCallback(() => {
        setProteinBoost(0);
    }, []);

    return (
        <div className="recipe-detail-overlay" onClick={onClose}>
            <div className="recipe-detail-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="modal-header">
                    <div className="header-left">
                        <h1>{recipe.name}</h1>
                        {recipe.mealType && (
                            <span className="gluten-badge">
                                🌿 {recipe.mealType}
                            </span>
                        )}
                    </div>
                    <div className="header-actions">
                        <button className="btn-icon" title="Redigera">✏️</button>
                        <button className="btn-kitchen-mode" onClick={() => onStartCooking(recipe, portions)}>
                            📺 KÖKSLÄGE
                        </button>
                        <button className="btn-close" onClick={onClose}>×</button>
                    </div>
                </header>

                {/* Stats - NOW SHOWING PER PORTION */}
                <div className="recipe-stats">
                    <div className="stat">
                        <span className="stat-label">TIDSÅTGÅNG</span>
                        <span className="stat-value">⏱ {recipe.cookTime || 30} m</span>
                    </div>
                    <div
                        className="stat highlight"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        title="Klicka för ingrediensdetaljer"
                    >
                        <span className="stat-label">PER PORTION {showBreakdown ? '▼' : '▶'}</span>
                        <span className="stat-value" style={{ textDecoration: 'underline dotted' }}>{nutrition.perPortion.calories} kcal</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">PROTEIN/PORT</span>
                        <span className="stat-value">💪 {nutrition.perPortion.protein}g</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">PRIS/PORT</span>
                        <span className="stat-value">💰 {nutrition.perPortion.price} kr</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">CO₂</span>
                        <span className="stat-value">🌍 {nutrition.total.co2} kg</span>
                    </div>
                </div>

                {/* Ingredient Breakdown - Toggleable */}
                {showBreakdown && (
                    <div className="ingredient-breakdown" style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '12px',
                        padding: '12px',
                        marginBottom: '16px',
                        fontSize: '13px'
                    }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto auto auto',
                            gap: '8px 12px',
                            color: 'var(--text-secondary)',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            paddingBottom: '8px',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            marginBottom: '8px'
                        }}>
                            <span>Ingrediens</span>
                            <span style={{ textAlign: 'right', width: '50px' }}>Mängd</span>
                            <span style={{ textAlign: 'right', width: '45px' }}>Kcal</span>
                            <span style={{ textAlign: 'right', width: '35px' }}>P</span>
                            <span style={{ textAlign: 'right', width: '35px' }}>F</span>
                        </div>
                        {scaledIngredients.map((ing: ScaledIngredient, idx: number) => {
                            // Match to food database for nutrition
                            const matched = foodItems.find(f =>
                                f.name.toLowerCase().includes(ing.name.toLowerCase()) ||
                                ing.name.toLowerCase().includes(f.name.toLowerCase())
                            );
                            // Parse scaledAmount (e.g., "200g" → 200)
                            const amountMatch = String(ing.scaledAmount).match(/(\d+(?:[.,]\d+)?)/);
                            const grams = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 100;
                            const gramsPerPortion = Math.round(grams / portions);
                            const kcalPerIng = matched ? Math.round((matched.calories / 100) * grams / portions) : 0;
                            const proteinPerIng = matched ? Math.round((matched.protein / 100) * grams / portions * 10) / 10 : 0;
                            const fatPerIng = matched ? Math.round((matched.fat / 100) * grams / portions * 10) / 10 : 0;
                            return (
                                <div key={idx} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto auto auto auto',
                                    gap: '8px 12px',
                                    padding: '4px 0',
                                    color: matched ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}>
                                    <span style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {ing.name}
                                    </span>
                                    <span style={{ textAlign: 'right', width: '50px', color: 'var(--text-secondary)' }}>
                                        {gramsPerPortion}g
                                    </span>
                                    <span style={{ textAlign: 'right', width: '45px', color: '#10b981' }}>
                                        {kcalPerIng}
                                    </span>
                                    <span style={{ textAlign: 'right', width: '35px', color: '#a78bfa' }}>
                                        {proteinPerIng}
                                    </span>
                                    <span style={{ textAlign: 'right', width: '35px', color: '#f87171' }}>
                                        {fatPerIng}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Storkok Button - Doubles portions */}
                <button
                    className={`storkok-btn ${portions >= 8 ? 'active' : ''}`}
                    onClick={() => setPortions((prev: number) => prev >= 8 ? basePortions : 8)}
                >
                    🍲 {portions >= 8 ? 'Tillbaka till normalt' : 'Gör till Storkok (8 port)'}
                </button>

                {/* Portion Selector */}
                <div className="portion-selector">
                    <span className="portion-icon">👥</span>
                    <span className="portion-label">PORTIONER</span>
                    <div className="portion-buttons">
                        {PORTION_OPTIONS.map(p => (
                            <button
                                key={p}
                                className={`portion-btn ${portions === p ? 'active' : ''}`}
                                onClick={() => setPortions(p)}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="modal-content">
                    {/* Left Column - Ingredients */}
                    <div className="ingredients-section">
                        <div className="section-header">
                            <h2>Ingredienser</h2>
                            <button
                                className="btn-customize"
                                title={customizeMode ? "Stäng anpassning" : "Anpassa ingredienser för denna måltid"}
                                onClick={() => setCustomizeMode(!customizeMode)}
                                style={{
                                    background: customizeMode ? 'var(--primary-color)' : undefined,
                                    color: customizeMode ? 'white' : undefined
                                }}
                            >
                                {customizeMode ? '✓ KLAR' : '⚙ ANPASSA'}
                            </button>
                        </div>

                        {customizeMode && (
                            <div style={{
                                background: 'rgba(139, 92, 246, 0.1)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                marginBottom: '12px',
                                fontSize: '12px',
                                color: 'var(--text-secondary)'
                            }}>
                                💡 Klicka på ✕ för att exkludera eller justera mängd. Ändringarna påverkar endast denna måltid.
                            </div>
                        )}

                        <ul className="ingredients-list">
                            {scaledIngredients.map((ing, i) => {
                                const isExcluded = excludedIngredients.has(i);
                                const multiplier = ingredientMultipliers.get(i) || 1;

                                // Format quantity
                                const quantity = parseFloat(ing.scaledAmount.replace(',', '.'));
                                const foodItem = matchToFoodItem({
                                    name: ing.name,
                                    unit: ing.unit,
                                    quantity: quantity,
                                    originalText: ing.originalText
                                }, foodItems);

                                const formattedText = !isNaN(quantity)
                                    ? formatIngredientQuantity(quantity, ing.unit, foodItem || undefined)
                                    : `${ing.scaledAmount} ${ing.unit}`;

                                return (
                                    <li
                                        key={i}
                                        className={`ingredient-item ${(ing as any).isBoosted ? 'boosted' : ''}`}
                                        style={{
                                            opacity: isExcluded ? 0.4 : 1,
                                            textDecoration: isExcluded ? 'line-through' : 'none'
                                        }}
                                    >
                                        {customizeMode ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const next = new Set(excludedIngredients);
                                                        if (isExcluded) {
                                                            next.delete(i);
                                                        } else {
                                                            next.add(i);
                                                        }
                                                        setExcludedIngredients(next);
                                                    }}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '4px',
                                                        border: 'none',
                                                        background: isExcluded ? '#ef4444' : '#374151',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        marginRight: '8px',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    {isExcluded ? '↩' : '✕'}
                                                </button>
                                                <span style={{ flex: 1 }}>
                                                    {formattedText} {ing.name}
                                                </span>
                                                {!isExcluded && (
                                                    <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                                        <button
                                                            onClick={() => {
                                                                const next = new Map(ingredientMultipliers);
                                                                next.set(i, Math.max(0.25, multiplier - 0.25));
                                                                setIngredientMultipliers(next);
                                                            }}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '4px',
                                                                border: 'none',
                                                                background: '#374151',
                                                                color: 'white',
                                                                cursor: 'pointer',
                                                                fontSize: '10px'
                                                            }}
                                                        >−</button>
                                                        <span style={{
                                                            minWidth: '35px',
                                                            textAlign: 'center',
                                                            color: multiplier !== 1 ? '#10b981' : 'inherit',
                                                            fontWeight: multiplier !== 1 ? 'bold' : 'normal'
                                                        }}>
                                                            {Math.round(multiplier * 100)}%
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                const next = new Map(ingredientMultipliers);
                                                                next.set(i, multiplier + 0.25);
                                                                setIngredientMultipliers(next);
                                                            }}
                                                            style={{
                                                                width: '20px',
                                                                height: '20px',
                                                                borderRadius: '4px',
                                                                border: 'none',
                                                                background: '#374151',
                                                                color: 'white',
                                                                cursor: 'pointer',
                                                                fontSize: '10px'
                                                            }}
                                                        >+</button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <input type="checkbox" id={`ing-${i}`} />
                                                <label htmlFor={`ing-${i}`}>
                                                    {formattedText} {ing.name}
                                                    {multiplier !== 1 && <span style={{ color: '#10b981', marginLeft: '4px' }}>({Math.round(multiplier * 100)}%)</span>}
                                                    {(ing as any).isBoosted && <span className="boost-badge">+{proteinBoost * 50}%</span>}
                                                </label>
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Protein Suggestion - NOW ACTIONABLE */}
                        {proteinSuggestion && proteinBoost < 2 && (
                            <button
                                className={`protein-suggestion ${proteinAnimating ? 'animating' : ''}`}
                                onClick={handleProteinBoost}
                            >
                                <span className="suggestion-icon">💪</span>
                                <div className="suggestion-text">
                                    <strong>VILL DU HA MER PROTEIN?</strong>
                                    <span>Klicka för att öka {proteinSuggestion.name} med 50%</span>
                                </div>
                                <span className="boost-arrow">→</span>
                            </button>
                        )}
                        {proteinBoost > 0 && (
                            <div className="protein-boosted-info">
                                <span>✅ Protein ökat med {proteinBoost * 50}%</span>
                                <button
                                    className="reset-boost-btn"
                                    onClick={resetProteinBoost}
                                >
                                    ↺ Ångra
                                </button>
                            </div>
                        )}

                        {/* SMART SWAPS SECTION - Temporarily disabled for debugging */}
                        {false && (smartSwaps.length > 0 || Object.keys(activeSwaps).length > 0) && (
                            <div className="smart-swaps-section" style={{
                                background: 'rgba(6, 182, 212, 0.08)',
                                border: '1px solid rgba(6, 182, 212, 0.2)',
                                borderRadius: '12px',
                                padding: '12px 16px',
                                marginTop: '16px'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '10px'
                                }}>
                                    <h4 style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: 'var(--accent-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        margin: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        🌍 Klimat & Pris-smart
                                        {Object.keys(activeSwaps).length > 0 && (
                                            <span style={{
                                                background: 'var(--accent-secondary)',
                                                color: '#0f172a',
                                                padding: '2px 6px',
                                                borderRadius: '6px',
                                                fontSize: '10px'
                                            }}>
                                                {Object.keys(activeSwaps).length} aktiva
                                            </span>
                                        )}
                                    </h4>
                                    {Object.keys(activeSwaps).length > 0 && (
                                        <button
                                            onClick={() => setActiveSwaps({})}
                                            style={{
                                                background: 'rgba(100, 116, 139, 0.3)',
                                                border: '1px solid rgba(100, 116, 139, 0.3)',
                                                borderRadius: '6px',
                                                padding: '4px 10px',
                                                color: 'var(--text-secondary)',
                                                fontSize: '11px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ↩ Återställ
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {smartSwaps.map((swap, idx) => {
                                        const isApplied = activeSwaps[swap.originalItem.id] === swap.suggestion.id;
                                        return (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px 10px',
                                                background: isApplied ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.2)',
                                                borderRadius: '8px',
                                                border: isApplied ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent'
                                            }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            fontWeight: 'bold',
                                                            fontSize: '13px',
                                                            color: isApplied ? 'var(--accent-primary)' : 'var(--text-primary)'
                                                        }}>
                                                            {isApplied ? swap.suggestion.name : swap.original.name}
                                                        </span>
                                                        {isApplied && (
                                                            <span style={{
                                                                fontSize: '11px',
                                                                color: 'var(--text-muted)',
                                                                textDecoration: 'line-through'
                                                            }}>
                                                                ({swap.original.name})
                                                            </span>
                                                        )}
                                                        {!isApplied && (
                                                            <>
                                                                <span style={{ color: 'var(--text-muted)' }}>→</span>
                                                                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {swap.suggestion.name}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '2px' }}>
                                                        {swap.reason === 'price' && `💰 Spara pengar`}
                                                        {swap.reason === 'co2' && `🌍 Miljövänligt`}
                                                        {swap.reason === 'both' && `🌟 Spara pengar & miljö`}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleSwap(swap.originalItem.id, swap.suggestion.id)}
                                                    style={{
                                                        background: isApplied ? 'var(--accent-primary)' : 'rgba(100, 116, 139, 0.3)',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '6px 12px',
                                                        color: isApplied ? '#0f172a' : 'var(--text-secondary)',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {isApplied ? '✓ Vald' : 'Byt'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Instructions */}
                    <div className="instructions-section">
                        <p className="recipe-description">{recipe.description}</p>

                        <h2>Gör så här</h2>
                        <ol className="instructions-list">
                            {steps.map((step, i) => (
                                <li
                                    key={i}
                                    className={`instruction-step ${completedSteps.has(i) ? 'completed' : ''}`}
                                    onClick={() => toggleStep(i)}
                                >
                                    <span className="step-number">{completedSteps.has(i) ? '✓' : i + 1}</span>
                                    <span className={`step-text ${completedSteps.has(i) ? 'line-through' : ''}`}>{step}</span>
                                </li>
                            ))}
                        </ol>

                        {/* Start Cooking CTA */}
                        <button
                            className="start-cooking-btn"
                            onClick={() => {
                                const finalMultipliers: Record<number, number> = {};
                                const boostFactor = 1 + (proteinBoost * 0.5);
                                const proteinFoods = ['linser', 'tofu', 'bönor', 'kikärtor', 'tempeh', 'seitan'];

                                scaledIngredients.forEach((ing: ScaledIngredient, idx: number) => {
                                    let m = ingredientMultipliers.get(idx) || 1;

                                    // Apply protein boost if applicable
                                    // We check name again to be sure (scaledIngredients also has isBoosted but checking name is robust)
                                    const isProteinFood = proteinFoods.some(p => ing.name.toLowerCase().includes(p));

                                    if (isProteinFood && proteinBoost > 0) {
                                        m = m * boostFactor;
                                    }

                                    if (m !== 1) {
                                        finalMultipliers[idx] = m;
                                    }
                                });

                                const customizations: IngredientCustomizations = {
                                    excludedIndices: Array.from(excludedIngredients),
                                    multipliers: finalMultipliers
                                };
                                onStartCooking(recipe, portions, customizations);
                            }}
                        >
                            <span className="cooking-icon">🍳</span>
                            <div className="cooking-text">
                                <strong>Starta matlagningen</strong>
                                <span>Öppna det distraktionsfria köksläget.</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
}
