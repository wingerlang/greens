/**
 * useGoalProgress Hook
 * React hook for calculating and managing goal progress.
 */

import { useMemo } from "react";
import { useData } from "../context/DataContext";
import type { PerformanceGoal } from "../models/types";
import {
  calculateGoalProgress,
  calculateStreak,
  type GoalProgress,
  type StreakInfo,
} from "../utils/goalCalculations";

// Re-export types
export type { GoalProgress, StreakInfo };

/**
 * Hook to get progress for a single goal.
 */
export function useGoalProgress(
  goal: PerformanceGoal | null | undefined,
): GoalProgress | null {
  const {
    unifiedActivities = [],
    mealEntries = [],
    foodItems = [],
    recipes = [],
    weightEntries = [],
    bodyMeasurements = [],
  } = useData();

  return useMemo(() => {
    if (!goal) return null;

    // Use unifiedActivities which includes merged strength sessions
    return calculateGoalProgress(
      goal,
      unifiedActivities as any[], // Cast to ExerciseEntry[] for compatibility
      mealEntries,
      foodItems,
      recipes,
      weightEntries,
      bodyMeasurements,
    );
  }, [
    goal,
    unifiedActivities,
    mealEntries,
    foodItems,
    recipes,
    weightEntries,
    bodyMeasurements,
  ]);
}

/**
 * Hook to get progress for all goals.
 */
export function useAllGoalsProgress(): Map<string, GoalProgress> {
  const {
    performanceGoals = [],
    unifiedActivities = [],
    mealEntries = [],
    foodItems = [],
    recipes = [],
    weightEntries = [],
    bodyMeasurements = [],
  } = useData();

  return useMemo(() => {
    const progressMap = new Map<string, GoalProgress>();

    performanceGoals.forEach((goal) => {
      // Use unifiedActivities which includes merged strength sessions
      const progress = calculateGoalProgress(
        goal,
        unifiedActivities as any[], // Cast to ExerciseEntry[] for compatibility
        mealEntries,
        foodItems,
        recipes,
        weightEntries,
        bodyMeasurements,
      );
      progressMap.set(goal.id, progress);
    });

    return progressMap;
  }, [
    performanceGoals,
    unifiedActivities,
    mealEntries,
    foodItems,
    recipes,
    weightEntries,
    bodyMeasurements,
  ]);
}

/**
 * Hook to get goals grouped by category.
 */
export function useGoalsByCategory() {
  const { performanceGoals = [] } = useData();
  const progressMap = useAllGoalsProgress();

  return useMemo(() => {
    const categories = {
      training: [] as { goal: PerformanceGoal; progress: GoalProgress }[],
      nutrition: [] as { goal: PerformanceGoal; progress: GoalProgress }[],
      body: [] as { goal: PerformanceGoal; progress: GoalProgress }[],
      lifestyle: [] as { goal: PerformanceGoal; progress: GoalProgress }[],
    };

    performanceGoals.forEach((goal) => {
      const progress = progressMap.get(goal.id);
      if (!progress) return;

      const category = goal.category || "training";
      if (category in categories) {
        categories[category as keyof typeof categories].push({
          goal,
          progress,
        });
      }
    });

    return categories;
  }, [performanceGoals, progressMap]);
}

/**
 * Hook to get active goals only.
 */
export function useActiveGoals() {
  const { performanceGoals = [] } = useData();
  const progressMap = useAllGoalsProgress();

  return useMemo(() => {
    return performanceGoals
      .filter((goal) => goal.status === "active" || !goal.status)
      .map((goal) => ({
        goal,
        progress: progressMap.get(goal.id)!,
      }))
      .filter((item) => item.progress);
  }, [performanceGoals, progressMap]);
}

/**
 * Hook to get completed goals.
 */
export function useCompletedGoals() {
  const { performanceGoals = [] } = useData();

  return useMemo(() => {
    return performanceGoals.filter((goal) => goal.status === "completed");
  }, [performanceGoals]);
}

/**
 * Hook to get goals summary stats.
 */
export function useGoalsSummary() {
  const { performanceGoals = [] } = useData();
  const progressMap = useAllGoalsProgress();

  return useMemo(() => {
    const active = performanceGoals.filter((g) =>
      g.status === "active" || !g.status
    );
    const completed = performanceGoals.filter((g) => g.status === "completed");
    const paused = performanceGoals.filter((g) => g.status === "paused");

    let totalProgress = 0;
    let onTrackCount = 0;
    let completedThisWeek = 0;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    active.forEach((goal) => {
      const progress = progressMap.get(goal.id);
      if (progress) {
        totalProgress += progress.percentage;
        if (progress.isOnTrack) onTrackCount++;
      }
    });

    completed.forEach((goal) => {
      if (goal.completedAt && goal.completedAt >= weekAgoStr) {
        completedThisWeek++;
      }
    });

    return {
      totalGoals: performanceGoals.length,
      activeCount: active.length,
      completedCount: completed.length,
      pausedCount: paused.length,
      averageProgress: active.length > 0 ? totalProgress / active.length : 0,
      onTrackCount,
      offTrackCount: active.length - onTrackCount,
      completedThisWeek,
    };
  }, [performanceGoals, progressMap]);
}

/**
 * Hook to get training streak info.
 */
export function useTrainingStreak(exerciseType?: string) {
  const { unifiedActivities = [] } = useData();

  return useMemo(() => {
    // Use unifiedActivities which includes strength sessions
    return calculateStreak(unifiedActivities as any[], "daily", exerciseType);
  }, [unifiedActivities, exerciseType]);
}

/**
 * Hook to get weekly training streak.
 */
export function useWeeklyStreak(exerciseType?: string) {
  const { unifiedActivities = [] } = useData();

  return useMemo(() => {
    // Use unifiedActivities which includes strength sessions
    return calculateStreak(unifiedActivities as any[], "weekly", exerciseType);
  }, [unifiedActivities, exerciseType]);
}
