/**
 * CookingModeProvider - Global context for cooking mode
 * Provides cooking functionality throughout the app
 */

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { type Recipe } from "../models/types.ts";
import { useData } from "./DataContext.tsx";
import {
  type IngredientCustomizations,
  useCookingSession,
} from "../hooks/useCookingSession.ts";
import { useTimer } from "../hooks/useTimer.ts";
import { RecipeDetailModal } from "../components/cooking/RecipeDetailModal.tsx";
import { CookingSession } from "../components/cooking/CookingSession.tsx";
import { ZenMode } from "../components/cooking/ZenMode.tsx";

// ============================================
// Context Types
// ============================================

interface CookingContextValue {
  openRecipe: (recipe: Recipe) => void;
  isActive: boolean;
}

const CookingContext = createContext<CookingContextValue | null>(null);

// ============================================
// Hook
// ============================================

export function useCooking() {
  const context = useContext(CookingContext);
  if (!context) {
    throw new Error("useCooking must be used within CookingModeProvider");
  }
  return context;
}

// ============================================
// Provider
// ============================================

interface CookingModeProviderProps {
  children: ReactNode;
}

export function CookingModeProvider({ children }: CookingModeProviderProps) {
  const { foodItems, recipes, addMealEntry } = useData();

  // Modal state
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  // Session state
  const {
    session,
    steps,
    scaledIngredients,
    startSession,
    endSession,
    goToStep,
    nextStep,
    previousStep,
    completeStep,
    startCooking,
    enterZenMode,
    exitZenMode,
  } = useCookingSession();

  // Timer state
  const {
    timers,
    activeTimer,
    addTimer,
    startTimer,
    pauseTimer,
    resetTimer,
    getTimerForStep,
  } = useTimer();

  // Open recipe detail modal
  const openRecipe = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
  }, []);

  // Close modal
  const closeModal = () => {
    setSelectedRecipe(null);
  };

  // Start cooking session
  const handleStartCooking = (
    recipe: Recipe,
    portions: number,
    customizations?: IngredientCustomizations,
  ) => {
    startSession(recipe, portions, customizations);
    startCooking();
    // Don't clear selectedRecipe here - we want it to remain so users return to it when exiting
  };

  // End cooking and log to calories
  const handleEndSession = useCallback(() => {
    if (session) {
      // Auto-log to calories
      const today = new Date().toISOString().split("T")[0];
      const hour = new Date().getHours();
      const mealType = hour < 10
        ? "breakfast"
        : hour < 14
        ? "lunch"
        : hour < 18
        ? "dinner"
        : "snack";

      addMealEntry({
        date: today,
        mealType,
        items: [{
          type: "recipe",
          referenceId: session.recipeId,
          servings: session.portions,
          verified: true,
        }],
      });
    }

    endSession();
  }, [session, addMealEntry, endSession]);

  // Handle timer for a step
  const handleStartTimer = (stepIndex: number, minutes: number) => {
    const existingTimer = getTimerForStep(stepIndex);
    if (existingTimer) {
      startTimer(existingTimer.id);
    } else {
      const step = steps[stepIndex];
      const label = step?.timerLabel || `Steg ${stepIndex + 1}`;
      const id = addTimer(label, minutes, stepIndex);
      startTimer(id);
    }
  };

  // Get current step's timer
  const currentStepTimer = session
    ? getTimerForStep(session.currentStep) || null
    : null;

  const contextValue: CookingContextValue = {
    openRecipe,
    isActive: session !== null && session.status !== "preview",
  };

  return (
    <CookingContext.Provider value={contextValue}>
      {children}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          foodItems={foodItems}
          onClose={closeModal}
          onStartCooking={handleStartCooking}
          isActive={!session}
        />
      )}

      {/* Cooking Session View (Köksläge) */}
      {session && session.status === "cooking" && (
        <CookingSession
          recipeName={session.recipeName}
          steps={steps}
          currentStep={session.currentStep}
          completedSteps={session.completedSteps}
          ingredients={scaledIngredients}
          timer={activeTimer}
          onGoToStep={goToStep}
          onCompleteStep={completeStep}
          onEnterZenMode={enterZenMode}
          onStartTimer={handleStartTimer}
          onExit={handleEndSession}
        />
      )}

      {/* Zen Mode */}
      {session && session.status === "zen" && (
        <ZenMode
          recipeName={session.recipeName}
          steps={steps}
          ingredients={scaledIngredients}
          foodItems={foodItems}
          currentStep={session.currentStep}
          // Only show CURRENT step's timer in the main view.
          // Background timers (from other steps) are passed via activeTimers to the overlay.
          timer={currentStepTimer}
          activeTimers={timers} // Pass all timers, ZenMode filters for overlay
          onNextStep={nextStep}
          onPreviousStep={previousStep}
          onGoToStep={goToStep}
          onStartTimer={(minutes) => {
            const step = steps[session.currentStep];
            const duration = minutes || step?.timerMinutes;
            if (duration) {
              handleStartTimer(session.currentStep, duration);
            }
          }}
          onPauseTimer={() => activeTimer && pauseTimer(activeTimer.id)}
          onResetTimer={() => activeTimer && resetTimer(activeTimer.id)}
          onExit={handleEndSession}
        />
      )}
    </CookingContext.Provider>
  );
}
