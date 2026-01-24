import {
  type AppSettings,
  type DailyVitals,
  type ExerciseEntry,
  type ExerciseIntensity,
  type ExerciseType,
  getISODate,
  type MealEntry,
  type NutritionSummary,
  type User,
  type WeightEntry,
} from "../models/types.ts";

// ============================================
// Streak Calculations
// ============================================

export function calculateStreak(
  mealEntries: MealEntry[],
  exerciseEntries: ExerciseEntry[],
  dailyVitals: Record<string, DailyVitals>,
  weightEntries: WeightEntry[],
  referenceDate?: string,
): number {
  const anchor = referenceDate ? new Date(referenceDate) : new Date();
  const anchorISO = getISODate(anchor);

  // Yesterday relative to anchor
  const prevDay = new Date(anchor);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayISO = getISODate(prevDay);

  const isDayActive = (date: string) => {
    const meals = mealEntries.filter((e) => e.date === date);
    const exercises = exerciseEntries.filter((e) => e.date.startsWith(date));
    const vitals = dailyVitals[date];
    const weightEntry = weightEntries.some((w) => w.date === date);

    // Active if logged meals, exercises, weights, or significant vitals
    return meals.length > 0 ||
      exercises.length > 0 ||
      weightEntry ||
      (vitals &&
        (vitals.water > 0 || (vitals.caffeine ?? 0) > 0 ||
          (vitals.alcohol ?? 0) > 0 || (vitals.sleep ?? 0) > 0));
  };

  let streak = 0;
  let checkDate = new Date(anchor);

  const anchorActive = isDayActive(anchorISO);
  const prevActive = isDayActive(prevDayISO);

  if (!anchorActive && !prevActive) return 0;

  // If anchor is not active, but prev is, we count from prev (streak maintained but not incremented for today yet)
  if (!anchorActive) checkDate = prevDay;

  while (true) {
    const dateStr = getISODate(checkDate);
    if (isDayActive(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streak > 3650) break;
  }
  return streak;
}

export function calculateTrainingStreak(
  exerciseEntries: ExerciseEntry[],
  referenceDate?: string,
  type?: string,
): number {
  const anchor = referenceDate ? new Date(referenceDate) : new Date();
  const anchorISO = getISODate(anchor);

  const prevDay = new Date(anchor);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayISO = getISODate(prevDay);

  const isTrainingDay = (date: string) => {
    const exercises = exerciseEntries.filter((e) => e.date.startsWith(date));
    if (!type) {
      // Any training
      return exercises.length > 0;
    } else if (type === "strength") {
      return exercises.some((e) => e.type === "strength");
    } else if (type === "running") {
      // Cardio mode: running, cycling, walking, swimming
      return exercises.some((e) =>
        ["running", "cycling", "walking", "swimming"].includes(e.type)
      );
    }
    return false;
  };

  let streak = 0;
  let checkDate = new Date(anchor);

  if (!isTrainingDay(anchorISO) && !isTrainingDay(prevDayISO)) return 0;
  if (!isTrainingDay(anchorISO)) checkDate = prevDay;

  while (true) {
    if (isTrainingDay(getISODate(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streak > 1000) break;
  }
  return streak;
}

export function calculateWeeklyTrainingStreak(
  exerciseEntries: ExerciseEntry[],
  referenceDate?: string,
): number {
  // Count weeks where there was at least one training session
  let streak = 0;
  let checkDate = referenceDate ? new Date(referenceDate) : new Date();

  // Move to the beginning of current week (Monday) of the checkDate
  const day = checkDate.getDay();
  const diff = checkDate.getDate() - day + (day === 0 ? -6 : 1);
  checkDate.setDate(diff);

  // Helper to check if a specific calendar week has any training
  const hasTrainingInWeek = (startDate: Date) => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = getISODate(d);
      if (exerciseEntries.some((e) => e.date.startsWith(dateStr))) return true;
    }
    return false;
  };

  // If current week has no training yet, check last week.
  if (!hasTrainingInWeek(new Date(checkDate))) {
    const lastWeek = new Date(checkDate);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (!hasTrainingInWeek(lastWeek)) return 0;
    checkDate = lastWeek;
  }

  while (true) {
    if (hasTrainingInWeek(new Date(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 7);
    } else {
      break;
    }
    if (streak > 520) break;
  }
  return streak;
}

export function calculateCalorieGoalStreak(
  getDailyNutrition: (date: string) => NutritionSummary,
  userSettings: AppSettings,
  referenceDate?: string,
): number {
  const anchor = referenceDate ? new Date(referenceDate) : new Date();
  const anchorISO = getISODate(anchor);

  const prevDay = new Date(anchor);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayISO = getISODate(prevDay);

  const isGoalMet = (date: string) => {
    const data = getDailyNutrition(date);
    const target = userSettings?.dailyCalorieGoal || 2500;
    return data.calories > 0 && data.calories <= target;
  };

  let streak = 0;
  let checkDate = new Date(anchor);

  if (!isGoalMet(anchorISO) && !isGoalMet(prevDayISO)) return 0;
  if (!isGoalMet(anchorISO)) checkDate = prevDay;

  while (true) {
    if (isGoalMet(getISODate(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
    if (streak > 1000) break;
  }
  return streak;
}

// ============================================
// Calculators
// ============================================

export function calculateBMR(
  weight: number,
  settings?: AppSettings,
): number {
  if (!settings) return 2000;
  const height = settings.height || 175;
  const currentYear = new Date().getFullYear();
  const age = settings.birthYear ? (currentYear - settings.birthYear) : 30;
  const gender = settings.gender || "other";

  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  if (gender === "male") bmr += 5;
  else if (gender === "female") bmr -= 161;
  else bmr -= 78; // Average/other

  return Math.round(bmr);
}

export function calculateExerciseCalories(
  type: ExerciseType,
  duration: number,
  intensity: ExerciseIntensity,
  weight: number,
): number {
  // MET values
  const METS: Record<ExerciseType, Record<ExerciseIntensity, number>> = {
    running: { low: 6, moderate: 8, high: 11, ultra: 14 },
    cycling: { low: 4, moderate: 6, high: 10, ultra: 12 },
    strength: { low: 2.5, moderate: 3.5, high: 5.0, ultra: 7.0 }, // Adjusted downwards to align better with Strava
    walking: { low: 2.5, moderate: 3.5, high: 4.5, ultra: 5.5 },
    swimming: { low: 5, moderate: 7, high: 10, ultra: 12 },
    yoga: { low: 2, moderate: 2.5, high: 3.5, ultra: 4 },
    other: { low: 3, moderate: 4.5, high: 6, ultra: 8 },
  };

  const met = METS[type][intensity];
  return Math.round(met * weight * (duration / 60));
}
