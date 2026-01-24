import { useMemo } from "react";
import { useData } from "../context/DataContext.tsx";
import { generateId, PlannedActivity } from "../models/types.ts";
import {
  getTrainingSuggestions,
  TrainingSuggestion,
} from "../utils/trainingSuggestions.ts";

// Helper to check if a date string is valid
const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

export function useSmartTrainingSuggestions(
  selectedDate: string | null,
  weeklyStats: any,
  goalProgress: any,
) {
  const { exerciseEntries, plannedActivities, performanceGoals, currentUser } =
    useData();

  return useMemo(() => {
    if (!selectedDate) return [];

    // 1. Get Base Suggestions from Utility (Goals, History, Recovery)
    const baseSuggestions = getTrainingSuggestions(
      exerciseEntries,
      selectedDate,
      performanceGoals,
      weeklyStats,
      currentUser?.settings,
    );

    // 2. Context-Aware Filtering (Check Planned Activities)
    // Don't suggest things we already have planned this week
    const weekNumber = getWeekNumber(selectedDate);

    const filteredSuggestions = baseSuggestions.filter((suggestion) => {
      // Filter Long Run if already planned this week
      if (suggestion.label.includes("Långpass")) {
        const hasLongRunPlanned = plannedActivities.some((a) =>
          (a.category === "LONG_RUN" || (a.estimatedDistance || 0) >= 12) &&
          getWeekNumber(a.date) === weekNumber &&
          a.status !== "COMPLETED"
        );
        if (hasLongRunPlanned) return false;
      }

      // Filter "Måljakt" if we already have a run planned for TODAY (don't suggest chasing goal if we already have a plan to execute)
      if (suggestion.label.includes("Måljakt")) {
        const hasRunToday = plannedActivities.some((a) =>
          a.date === selectedDate &&
          (a.type === "RUN" || a.category === "EASY" ||
            a.category === "INTERVALS" || a.category === "TEMPO" ||
            a.category === "LONG_RUN")
        );
        if (hasRunToday) return false;
      }

      // Filter Strength if done or planned today
      if (suggestion.type === "STRENGTH") {
        const hasStrengthToday = plannedActivities.some((a) =>
          a.date === selectedDate &&
          (a.type === "STRENGTH" || a.category === "STRENGTH")
        );
        if (hasStrengthToday) return false;
      }

      return true;
    });

    return filteredSuggestions;
  }, [
    selectedDate,
    exerciseEntries,
    weeklyStats,
    goalProgress,
    plannedActivities,
    performanceGoals,
    currentUser,
  ]);
}

// Helper for week number
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}
