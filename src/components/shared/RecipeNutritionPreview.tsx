import React, { useMemo, useState } from 'react';
import './RecipeNutritionPreview.css';

interface RecipeNutritionPreviewProps {
    servings: number;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    totalWeight: number;
    recipeServings: number; // The recipe's internal servings count
    onViewModeChange?: (mode: ViewMode) => void;
}

type ViewMode = '100g' | 'portion' | 'recipe';

export function RecipeNutritionPreview({
    servings,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    totalWeight,
    recipeServings,
    onViewModeChange
}: RecipeNutritionPreviewProps) {
    const [viewMode, setViewMode] = useState<ViewMode>(totalWeight > 0 ? '100g' : 'portion');

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        if (onViewModeChange) onViewModeChange(mode);
    };

    const displayValues = useMemo(() => {
        let factor = 1;
        
        switch (viewMode) {
            case '100g':
                factor = totalWeight > 0 ? (100 / totalWeight) : (1 / (recipeServings || 1));
                break;
            case 'portion':
                factor = 1 / (recipeServings || 1);
                break;
            case 'recipe':
                factor = 1;
                break;
        }

        return {
            calories: Math.round(totalCalories * factor),
            protein: Math.round((totalProtein * factor) * 10) / 10,
            carbs: Math.round((totalCarbs * factor) * 10) / 10,
            fat: Math.round((totalFat * factor) * 10) / 10,
            weight: Math.round(totalWeight * factor)
        };
    }, [viewMode, totalCalories, totalProtein, totalCarbs, totalFat, totalWeight, recipeServings]);

    const macroDistribution = useMemo(() => {
        const pCal = displayValues.protein * 4;
        const cCal = displayValues.carbs * 4;
        const fCal = displayValues.fat * 9;
        const total = pCal + cCal + fCal;
        
        if (total === 0) return { p: 0, c: 0, f: 0 };
        
        return {
            p: Math.round((pCal / total) * 100),
            c: Math.round((cCal / total) * 100),
            f: Math.round((fCal / total) * 100)
        };
    }, [displayValues]);

    const headerTitle = useMemo(() => {
        switch (viewMode) {
            case '100g': return 'NÄRINGSVÄRDE PER 100G';
            case 'portion': return 'NÄRINGSVÄRDE PER PORTION';
            case 'recipe': return 'NÄRINGSVÄRDE PER RECEPT';
        }
    }, [viewMode]);

    return (
        <div className="recipe-nutrition-preview">
            <div className="preview-header">
                <div className="title-group">
                    <h3>{headerTitle}</h3>
                    <div className="view-toggle">
                        <button 
                            type="button"
                            className={`toggle-btn ${viewMode === '100g' ? 'active' : ''} ${totalWeight <= 0 ? 'disabled' : ''}`}
                            onClick={() => totalWeight > 0 && setViewMode('100g')}
                            title={totalWeight <= 0 ? 'Vikt saknas för receptet' : 'Visa per 100g'}
                        >
                            100g
                        </button>
                        <button 
                            type="button"
                            className={`toggle-btn ${viewMode === 'portion' ? 'active' : ''}`}
                            onClick={() => handleViewModeChange('portion')}
                        >
                            Portion
                        </button>
                        <button 
                            type="button"
                            className={`toggle-btn ${viewMode === 'recipe' ? 'active' : ''}`}
                            onClick={() => handleViewModeChange('recipe')}
                        >
                            Hela
                        </button>
                    </div>
                </div>
            </div>
            <div className="preview-grid">
                <div className="preview-item">
                    <span className="label">KALORIER</span>
                    <span className="value">{displayValues.calories}</span>
                    <span className="unit">kcal</span>
                </div>
                <div className="preview-item">
                    <span className="label">PROTEIN</span>
                    <span className="value">{displayValues.protein}</span>
                    <span className="unit">g</span>
                </div>
                <div className="preview-item">
                    <span className="label">KOLHYDRATER</span>
                    <span className="value">{displayValues.carbs}</span>
                    <span className="unit">g</span>
                </div>
                <div className="preview-item">
                    <span className="label">FETT</span>
                    <span className="value">{displayValues.fat}</span>
                    <span className="unit">g</span>
                </div>
                <div className="preview-item">
                    <span className="label">{viewMode === '100g' ? 'KONTEXT' : 'VIKT'}</span>
                    <span className="value">{viewMode === '100g' ? '100' : displayValues.weight}</span>
                    <span className="unit">g</span>
                </div>
            </div>

            {/* Macro Distribution Bar */}
            <div className="macro-distribution">
                <div className="macro-bar">
                    <div className="bar-segment protein" style={{ width: `${macroDistribution.p}%` }}></div>
                    <div className="bar-segment carbs" style={{ width: `${macroDistribution.c}%` }}></div>
                    <div className="bar-segment fat" style={{ width: `${macroDistribution.f}%` }}></div>
                </div>
                <div className="macro-labels">
                    <div className="macro-label protein">
                        <span className="dot"></span>
                        <span>Protein {macroDistribution.p}%</span>
                    </div>
                    <div className="macro-label carbs">
                        <span className="dot"></span>
                        <span>Kolhydrater {macroDistribution.c}%</span>
                    </div>
                    <div className="macro-label fat">
                        <span className="dot"></span>
                        <span>Fett {macroDistribution.f}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RecipeNutritionPreview;
