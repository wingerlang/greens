import { Weekday, MealType } from './common.ts';

// ============================================
// Weekly Planning Types
// ============================================

/** Planned meal for a specific day and meal type */
export interface PlannedMeal {
    recipeId?: string;
    servings?: number;
    note?: string;
    /** Additional recipe IDs for multiple snacks */
    additionalRecipeIds?: string[];
    /** Ingredient swaps: originalItemId -> newItemId */
    swaps?: Record<string, string>;
    /** When this meal was cooked */
    cookedAt?: string;
    /** Whether logged to CaloriesPage */
    loggedToCalories?: boolean;
}

/** Weekly meal plan structure */
export interface WeeklyPlan {
    id: string;
    weekStartDate: string;  // ISO date of Monday
    meals: {
        [key in Weekday]: {
            [key in MealType]?: PlannedMeal;
        };
    };
    createdAt: string;
    updatedAt: string;
}

export type WeeklyPlanFormData = Omit<WeeklyPlan, 'id' | 'createdAt' | 'updatedAt'>;
