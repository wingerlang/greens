import React, { type ReactNode, useEffect, useState } from "react";
import { Navigation } from "./Navigation.tsx";
import { Omnibox } from "./Omnibox.tsx";
import { GlobalExerciseModal } from "./training/GlobalExerciseModal.tsx";
import { NoccoOClock } from "./NoccoOClock.tsx";
import { ExerciseType } from "../models/types.ts";
import { NutritionBreakdownModal } from "./calories/NutritionBreakdownModal.tsx";
import { useData } from "../context/DataContext.tsx";
import { useRef } from "react";
import { GlobalNotification } from "./common/GlobalNotification.tsx";
import { useLocation, useNavigate } from "react-router-dom";
import { Footer } from "./Footer.tsx";
import { ActivityDetailModal } from "./activities/ActivityDetailModal.tsx";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isOmniboxOpen, setIsOmniboxOpen] = useState(false);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [trainingModalDefaults, setTrainingModalDefaults] = useState<
    { type?: ExerciseType; input?: string; date?: string }
  >({});

  const handleOpenTraining = (
    defaults: { type?: ExerciseType; input?: string; date?: string },
  ) => {
    setTrainingModalDefaults(defaults);
    setIsOmniboxOpen(false);
    setIsTrainingModalOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOmniboxOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { recipes, foodItems, getFoodItem, unifiedActivities } = useData();
  const [nutritionBreakdownItem, setNutritionBreakdownItem] = useState<
    | { type: "recipe" | "foodItem"; referenceId: string; servings: number }
    | null
  >(null);

  // Universal Activity Modal
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    null,
  );

  // Find the activity object if an ID is selected
  const selectedActivity = selectedActivityId
    ? unifiedActivities.find((a) => a.id === selectedActivityId)
    : null;

  useEffect(() => {
    const updateFromParams = () => {
      const params = new URLSearchParams(window.location.search);
      const breakdownId = params.get("breakdown");
      const registerDate = params.get("registerDate");
      const registerType = params.get("registerType") as ExerciseType | null;
      const registerInput = params.get("registerInput");
      const activityId = params.get("activityId");

      if (breakdownId) {
        const recipe = recipes.find((r) => r.id === breakdownId);
        if (recipe) {
          setNutritionBreakdownItem({
            type: "recipe",
            referenceId: recipe.id,
            servings: 1,
          });
        } else {
          const food = foodItems.find((f) => f.id === breakdownId);
          if (food) {
            setNutritionBreakdownItem({
              type: "foodItem",
              referenceId: food.id,
              servings: 100,
            });
          }
        }
      }

      if (registerDate) {
        handleOpenTraining({
          date: registerDate,
          type: registerType || undefined,
          input: registerInput || undefined,
        });
      }

      if (activityId) {
        setSelectedActivityId(activityId);
      }

      if (breakdownId || registerDate) {
        // Clean up URL without reload (activityId is kept in URL to allow sharing/back button)
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, "", newUrl);
      }
    };

    // Initial check
    updateFromParams();

    // Listen for popstate (back/forward)
    window.addEventListener("popstate", updateFromParams);

    // Listen for custom pushState events if we implemented a wrapper,
    // but for now we rely on the fact that we might trigger this manually or via navigation.
    // A hacky but effective way to detect in-app navigation that uses pushState is
    // to hook into re-renders if useLocation is used, but here we can just expose a helper or listen to Interval.
    // Better: React Router's useLocation hook.
  }, [recipes, foodItems]);

  // Placeholder - skipping this replacement for now until I view Navigation.tsx hook to detect changes
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const activityId = params.get("activityId");
    setSelectedActivityId(activityId);

    // Also check for registerDate on location change
    const registerDate = params.get("registerDate");
    if (registerDate) {
      const registerType = params.get("registerType") as ExerciseType | null;
      const registerInput = params.get("registerInput");
      handleOpenTraining({
        date: registerDate,
        type: registerType || undefined,
        input: registerInput || undefined,
      });
      // Cleanup URL immediately for actions
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }, [location.search]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <GlobalNotification />
      <NoccoOClock />
      {/* New Omnibox Component - handles its own overlay */}
      <Omnibox
        isOpen={isOmniboxOpen}
        onClose={() => setIsOmniboxOpen(false)}
        onOpenTraining={handleOpenTraining}
        onOpenNutrition={(item) => {
          setIsOmniboxOpen(false);
          setNutritionBreakdownItem(item);
        }}
      />

      <GlobalExerciseModal
        isOpen={isTrainingModalOpen}
        onClose={() => setIsTrainingModalOpen(false)}
        initialType={trainingModalDefaults.type}
        initialInput={trainingModalDefaults.input}
        initialDate={trainingModalDefaults.date}
      />

      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => {
            setSelectedActivityId(null);
            const params = new URLSearchParams(window.location.search);
            params.delete("activityId");
            const newUrl = window.location.pathname +
              (params.toString() ? "?" + params.toString() : "") +
              window.location.hash;
            window.history.replaceState({}, "", newUrl);
          }}
        />
      )}

      {nutritionBreakdownItem && (
        <NutritionBreakdownModal
          item={nutritionBreakdownItem}
          onClose={() => setNutritionBreakdownItem(null)}
          recipes={recipes}
          foodItems={foodItems}
          getFoodItem={getFoodItem}
        />
      )}

      <Navigation onOpenOmnibox={() => setIsOmniboxOpen(true)} />
      <main className="flex-1 w-full max-w-[1536px] mx-auto p-3 md:p-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
