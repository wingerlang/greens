/**
 * useCookingSession - Hook for managing cooking session state with persistence
 */

import { useState, useCallback, useEffect } from 'react';
import { type Recipe } from '../models/types.ts';
import { parseSteps, type ParsedStep, scaleAmount, parseIngredientLine, type MatchedIngredient } from '../utils/stepParser.ts';

// ============================================
// Types
// ============================================

export interface IngredientCustomizations {
    excludedIndices: number[];
    multipliers: Record<number, number>;
}

export interface CookingSession {
    id: string;
    recipeId: string;
    recipeName: string;
    portions: number;
    basePortions: number;
    startedAt: string;
    currentStep: number;
    completedSteps: number[];
    status: 'preview' | 'cooking' | 'zen' | 'completed';
    customizations?: IngredientCustomizations; // Ingredient adjustments from Anpassa
    timerStepIndex?: number; // Track which step started the timer
}

export interface ScaledIngredient extends MatchedIngredient {
    scaledAmount: string;
    isExcluded?: boolean;
    customMultiplier?: number;
}

interface UseCookingSessionReturn {
    session: CookingSession | null;
    steps: ParsedStep[];
    scaledIngredients: ScaledIngredient[];
    portionMultiplier: number;

    // Session actions
    startSession: (recipe: Recipe, portions?: number, customizations?: IngredientCustomizations) => void;
    endSession: () => void;

    // Navigation
    goToStep: (index: number) => void;
    nextStep: () => void;
    previousStep: () => void;
    completeStep: (index: number) => void;

    // Mode
    startCooking: () => void;
    enterZenMode: () => void;
    exitZenMode: () => void;

    // Portions
    setPortions: (portions: number) => void;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEY = 'greens-cooking-session';

// ============================================
// Hook
// ============================================

export function useCookingSession(): UseCookingSessionReturn {
    const [session, setSession] = useState<CookingSession | null>(null);
    const [steps, setSteps] = useState<ParsedStep[]>([]);
    const [ingredients, setIngredients] = useState<MatchedIngredient[]>([]);
    const [recipe, setRecipe] = useState<Recipe | null>(null);

    // Load session from storage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setSession(parsed.session);
                setSteps(parsed.steps || []);
                setIngredients(parsed.ingredients || []);
            }
        } catch (e) {
            console.warn('Failed to load cooking session:', e);
        }
    }, []);

    // Save session to storage on change
    useEffect(() => {
        if (session) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, steps, ingredients }));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [session, steps, ingredients]);

    // Calculate portion multiplier
    const portionMultiplier = session
        ? session.portions / session.basePortions
        : 1;

    // Scale ingredients based on portions AND customizations
    const scaledIngredients: ScaledIngredient[] = ingredients.map((ing, index) => {
        const customizations = session?.customizations;
        const isExcluded = customizations?.excludedIndices.includes(index) || false;
        const customMultiplier = customizations?.multipliers[index] || 1;
        const effectiveMultiplier = isExcluded ? 0 : portionMultiplier * customMultiplier;

        return {
            ...ing,
            scaledAmount: isExcluded ? '0' : scaleAmount(ing.amount, effectiveMultiplier),
            isExcluded,
            customMultiplier,
        };
    });

    // Generate unique ID
    const generateId = () => `session_${Date.now()}`;

    // Start new cooking session
    const startSession = useCallback((newRecipe: Recipe, portions?: number, customizations?: IngredientCustomizations) => {
        const basePortions = newRecipe.servings || 4;
        const selectedPortions = portions || basePortions;

        // Parse steps and ingredients
        const parsedSteps = parseSteps(
            newRecipe.instructionsText || '',
            newRecipe.ingredientsText || ''
        );

        const parsedIngredients = (newRecipe.ingredientsText || '')
            .split('\n')
            .map(line => parseIngredientLine(line))
            .filter((i): i is MatchedIngredient => i !== null);

        setRecipe(newRecipe);
        setSteps(parsedSteps);
        setIngredients(parsedIngredients);

        setSession({
            id: generateId(),
            recipeId: newRecipe.id,
            recipeName: newRecipe.name,
            portions: selectedPortions,
            basePortions,
            startedAt: new Date().toISOString(),
            currentStep: 0,
            completedSteps: [],
            status: 'preview',
            customizations, // Store ingredient customizations
        });
    }, []);

    // End session
    const endSession = useCallback(() => {
        setSession(null);
        setSteps([]);
        setIngredients([]);
        setRecipe(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Navigation
    const goToStep = useCallback((index: number) => {
        if (!session || index < 0 || index >= steps.length) return;
        setSession(prev => prev ? { ...prev, currentStep: index } : null);
    }, [session, steps.length]);

    const nextStep = useCallback(() => {
        if (!session) return;
        const next = Math.min(session.currentStep + 1, steps.length - 1);
        setSession(prev => prev ? { ...prev, currentStep: next } : null);
    }, [session, steps.length]);

    const previousStep = useCallback(() => {
        if (!session) return;
        const prev = Math.max(session.currentStep - 1, 0);
        setSession(p => p ? { ...p, currentStep: prev } : null);
    }, [session]);

    const completeStep = useCallback((index: number) => {
        if (!session) return;
        setSession(prev => {
            if (!prev) return null;
            const completed = prev.completedSteps.includes(index)
                ? prev.completedSteps.filter(i => i !== index)
                : [...prev.completedSteps, index];
            return { ...prev, completedSteps: completed };
        });

        // Also mark in steps
        setSteps(prev => prev.map((step, i) =>
            i === index ? { ...step, isCompleted: !step.isCompleted } : step
        ));
    }, [session]);

    // Mode changes
    const startCooking = useCallback(() => {
        setSession(prev => prev ? { ...prev, status: 'cooking' } : null);
    }, []);

    const enterZenMode = useCallback(() => {
        setSession(prev => prev ? { ...prev, status: 'zen' } : null);
    }, []);

    const exitZenMode = useCallback(() => {
        setSession(prev => prev ? { ...prev, status: 'cooking' } : null);
    }, []);

    // Portion control
    const setPortions = useCallback((portions: number) => {
        if (portions < 1 || portions > 20) return;
        setSession(prev => prev ? { ...prev, portions } : null);
    }, []);

    return {
        session,
        steps,
        scaledIngredients,
        portionMultiplier,
        startSession,
        endSession,
        goToStep,
        nextStep,
        previousStep,
        completeStep,
        startCooking,
        enterZenMode,
        exitZenMode,
        setPortions,
    };
}
