/**
 * useRandomizer - Smart meal randomization hook
 */

import { useMemo, useCallback } from 'react';
import { type Recipe, type Weekday, type MealType, type WeeklyPlan, WEEKDAYS } from '../models/types.ts';

interface RandomizerOptions {
    respectMealType: boolean;
    avoidRepeatsInWeek: boolean;
    preferSeasonal: boolean;
    maxCookTime?: number;
}

const DEFAULT_OPTIONS: RandomizerOptions = {
    respectMealType: true,
    avoidRepeatsInWeek: true,
    preferSeasonal: true,
};

// Seasonal ingredients by month
const SEASONAL_INGREDIENTS: Record<string, string[]> = {
    winter: ['kål', 'rotfrukter', 'potatis', 'morot', 'palsternacka'],
    spring: ['sparris', 'rädisa', 'spenat', 'örter'],
    summer: ['tomat', 'gurka', 'zucchini', 'paprika', 'majs'],
    autumn: ['pumpa', 'svamp', 'äpple', 'päron', 'squash'],
};

function getCurrentSeason(): 'winter' | 'spring' | 'summer' | 'autumn' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
}

export function useRandomizer(
    recipes: Recipe[],
    weekPlan: WeeklyPlan['meals'] | undefined,
    options: Partial<RandomizerOptions> = {}
) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const season = getCurrentSeason();

    // Get recipes already used this week
    const usedRecipeIds = useMemo(() => {
        if (!weekPlan) return new Set<string>();

        const ids = new Set<string>();
        WEEKDAYS.forEach(day => {
            const dayPlan = weekPlan[day];
            if (dayPlan) {
                Object.values(dayPlan).forEach(meal => {
                    if (meal?.recipeId) ids.add(meal.recipeId);
                    meal?.additionalRecipeIds?.forEach(id => ids.add(id));
                });
            }
        });
        return ids;
    }, [weekPlan]);

    // Score a recipe for a given meal slot
    const scoreRecipe = useCallback((recipe: Recipe, mealType: MealType): number => {
        let score = 50; // Base score

        // Meal type match
        if (opts.respectMealType && recipe.mealType) {
            if (recipe.mealType === mealType) {
                score += 30;
            } else if (
                (mealType === 'lunch' && recipe.mealType === 'dinner') ||
                (mealType === 'dinner' && recipe.mealType === 'lunch')
            ) {
                score += 10; // Lunch/dinner are somewhat interchangeable
            } else {
                score -= 20;
            }
        }

        // Already used this week penalty
        if (opts.avoidRepeatsInWeek && usedRecipeIds.has(recipe.id)) {
            score -= 100;
        }

        // Seasonal bonus
        if (opts.preferSeasonal && recipe.ingredientsText) {
            const seasonalIngs = SEASONAL_INGREDIENTS[season];
            const hasSeasonal = seasonalIngs.some(ing =>
                recipe.ingredientsText!.toLowerCase().includes(ing)
            );
            if (hasSeasonal) score += 15;
        }

        // Cook time filter
        if (opts.maxCookTime && (recipe.cookTime || 0) > opts.maxCookTime) {
            score -= 50;
        }

        return score;
    }, [opts, usedRecipeIds, season]);

    // Get random recipe for a slot
    const getRandomRecipe = useCallback((mealType: MealType): Recipe | null => {
        if (!Array.isArray(recipes) || recipes.length === 0) return null;

        // Score all recipes
        const scored = recipes.map(r => ({
            recipe: r,
            score: scoreRecipe(r, mealType),
        }));

        // Filter to positive scores
        const candidates = scored.filter(s => s.score > 0);
        if (candidates.length === 0) {
            // Fallback: just pick any
            return recipes[Math.floor(Math.random() * recipes.length)];
        }

        // Weighted random selection
        const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
        let random = Math.random() * totalScore;

        for (const candidate of candidates) {
            random -= candidate.score;
            if (random <= 0) {
                return candidate.recipe;
            }
        }

        return candidates[0].recipe;
    }, [recipes, scoreRecipe]);

    // Get multiple suggestions for a slot
    const getSuggestions = useCallback((mealType: MealType, count: number = 3): Recipe[] => {
        if (!Array.isArray(recipes) || recipes.length === 0) return [];

        const scored = recipes
            .map(r => ({ recipe: r, score: scoreRecipe(r, mealType) }))
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score);

        return scored.slice(0, count).map(s => s.recipe);
    }, [recipes, scoreRecipe]);

    // Randomize a full day
    const randomizeDay = useCallback((
        day: Weekday,
        visibleMeals: MealType[],
        currentPlan: WeeklyPlan['meals']
    ): Partial<Record<MealType, { recipeId: string; servings: number }>> => {
        const result: Partial<Record<MealType, { recipeId: string; servings: number }>> = {};

        visibleMeals.forEach(meal => {
            // Only fill empty slots
            if (!currentPlan[day]?.[meal]?.recipeId) {
                const recipe = getRandomRecipe(meal);
                if (recipe) {
                    result[meal] = { recipeId: recipe.id, servings: recipe.servings || 4 };
                }
            }
        });

        return result;
    }, [getRandomRecipe]);

    return {
        getRandomRecipe,
        getSuggestions,
        randomizeDay,
    };
}

export default useRandomizer;
