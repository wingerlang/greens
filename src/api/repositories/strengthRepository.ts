/**
 * Strength Repository
 * Deno KV storage for strength training data.
 */

import { kv } from "../kv.ts";
import {
  MuscleGroup,
  PersonalBest,
  StrengthExercise,
  StrengthLogImportResult,
  StrengthStats,
  StrengthWorkout,
} from "../../models/strengthTypes.ts";

// ============================================
// Workouts
// ============================================

export async function saveWorkout(workout: StrengthWorkout): Promise<void> {
  // Primary key: ['strength_workouts', userId, date, workoutId]
  await kv.set(
    ["strength_workouts", workout.userId, workout.date, workout.id],
    workout,
  );
}

export async function getWorkout(
  userId: string,
  workoutId: string,
): Promise<StrengthWorkout | null> {
  // We need to search since we don't know the date
  const iter = kv.list<StrengthWorkout>({
    prefix: ["strength_workouts", userId],
  });
  for await (const entry of iter) {
    if (entry.value.id === workoutId) {
      return entry.value;
    }
  }
  return null;
}

export async function getWorkoutsByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<StrengthWorkout[]> {
  const iter = kv.list<StrengthWorkout>({
    start: ["strength_workouts", userId, startDate],
    end: ["strength_workouts", userId, endDate + "\uffff"],
  });

  const workouts: StrengthWorkout[] = [];
  for await (const entry of iter) {
    workouts.push(entry.value);
  }
  return workouts.sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
}

export async function getAllWorkouts(
  userId: string,
): Promise<StrengthWorkout[]> {
  return getWorkoutsByDateRange(userId, "2000-01-01", "2099-12-31");
}

export async function getWorkoutByDateAndName(
  userId: string,
  date: string,
  name: string,
): Promise<StrengthWorkout | null> {
  const iter = kv.list<StrengthWorkout>({
    prefix: ["strength_workouts", userId, date],
  });
  for await (const entry of iter) {
    if (entry.value.name === name || entry.value.sourceWorkoutName === name) {
      return entry.value;
    }
  }
  return null;
}

export async function deleteWorkout(
  userId: string,
  date: string,
  workoutId: string,
): Promise<void> {
  await kv.delete(["strength_workouts", userId, date, workoutId]);
}

// ============================================
// Exercises
// ============================================

export async function saveExercise(exercise: StrengthExercise): Promise<void> {
  await kv.set(["strength_exercises", exercise.id], exercise);
}

export async function getExercise(
  exerciseId: string,
): Promise<StrengthExercise | null> {
  const res = await kv.get<StrengthExercise>([
    "strength_exercises",
    exerciseId,
  ]);
  return res.value;
}

export async function getAllExercises(): Promise<StrengthExercise[]> {
  const iter = kv.list<StrengthExercise>({ prefix: ["strength_exercises"] });
  const exercises: StrengthExercise[] = [];
  for await (const entry of iter) {
    exercises.push(entry.value);
  }
  return exercises.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveExercises(
  exercises: Map<string, StrengthExercise>,
): Promise<number> {
  let count = 0;
  for (const exercise of exercises.values()) {
    const existing = await getExercise(exercise.id);
    if (!existing) {
      await saveExercise(exercise);
      count++;
    }
  }
  return count;
}

// ============================================
// Personal Bests
// ============================================

export async function savePersonalBest(pb: PersonalBest): Promise<void> {
  await kv.set(["strength_pbs", pb.userId, pb.exerciseId, pb.type], pb);
}

export async function getPersonalBest(
  userId: string,
  exerciseId: string,
  type: PersonalBest["type"],
): Promise<PersonalBest | null> {
  const res = await kv.get<PersonalBest>([
    "strength_pbs",
    userId,
    exerciseId,
    type,
  ]);
  return res.value;
}

export async function getAllPersonalBests(
  userId: string,
): Promise<PersonalBest[]> {
  const iter = kv.list<PersonalBest>({ prefix: ["strength_pbs", userId] });
  const pbs: PersonalBest[] = [];
  for await (const entry of iter) {
    pbs.push(entry.value);
  }
  return pbs.sort((a, b) => b.value - a.value); // Highest first
}

export async function savePersonalBests(pbs: PersonalBest[]): Promise<number> {
  let count = 0;
  for (const pb of pbs) {
    const existing = await getPersonalBest(pb.userId, pb.exerciseId, pb.type);
    if (!existing || pb.value > existing.value) {
      await savePersonalBest(pb);
      count++;
    }
  }
  return count;
}

/**
 * Reset an exercise - delete all personal bests for a specific exercise.
 * Workout data is preserved, PBs will be recalculated on next import.
 */
export async function resetExercise(
  userId: string,
  exerciseId: string,
): Promise<number> {
  const iter = kv.list<PersonalBest>({
    prefix: ["strength_pbs", userId, exerciseId],
  });
  let deletedCount = 0;

  for await (const entry of iter) {
    await kv.delete(entry.key);
    deletedCount++;
  }

  return deletedCount;
}

// ============================================
// Import Logic
// ============================================

export async function importWorkouts(
  userId: string,
  workouts: StrengthWorkout[],
  exercises: Map<string, StrengthExercise>,
  personalBests: PersonalBest[],
): Promise<StrengthLogImportResult> {
  const result: StrengthLogImportResult = {
    success: true,
    workoutsImported: 0,
    workoutsUpdated: 0,
    workoutsSkipped: 0,
    exercisesDiscovered: 0,
    personalBestsFound: 0,
    errors: [],
  };

  try {
    // Save exercises first
    result.exercisesDiscovered = await saveExercises(exercises);

    // Import workouts with merge logic
    for (const workout of workouts) {
      workout.userId = userId; // Ensure userId is set

      const existing = await getWorkoutByDateAndName(
        userId,
        workout.date,
        workout.name,
      );

      if (existing) {
        // Update existing workout
        workout.id = existing.id;
        workout.createdAt = existing.createdAt;
        workout.updatedAt = new Date().toISOString();
        await saveWorkout(workout);
        result.workoutsUpdated++;
      } else {
        // New workout
        await saveWorkout(workout);
        result.workoutsImported++;
      }
    }

    // Save personal bests
    result.personalBestsFound = await savePersonalBests(personalBests);
  } catch (e) {
    result.success = false;
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
}

// ============================================
// Statistics
// ============================================

export async function getStrengthStats(userId: string): Promise<StrengthStats> {
  const allWorkouts = await getAllWorkouts(userId);

  const now = new Date();
  const weekAgo =
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split(
      "T",
    )[0];
  const monthAgo =
    new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split(
      "T",
    )[0];

  const muscleGroupVolume: Record<MuscleGroup, number> = {
    chest: 0,
    back: 0,
    shoulders: 0,
    biceps: 0,
    triceps: 0,
    forearms: 0,
    quads: 0,
    hamstrings: 0,
    glutes: 0,
    calves: 0,
    core: 0,
    traps: 0,
    lats: 0,
    full_body: 0,
  };

  let totalSets = 0;
  let totalVolume = 0;
  let workoutsThisWeek = 0;
  let workoutsThisMonth = 0;
  let volumeThisWeek = 0;
  let volumeThisMonth = 0;

  for (const workout of allWorkouts) {
    totalSets += workout.totalSets;
    totalVolume += workout.totalVolume;

    if (workout.date >= weekAgo) {
      workoutsThisWeek++;
      volumeThisWeek += workout.totalVolume;
    }
    if (workout.date >= monthAgo) {
      workoutsThisMonth++;
      volumeThisMonth += workout.totalVolume;
    }
  }

  const { currentStreak, longestStreak } = calculateStreaks(allWorkouts);

  return {
    userId,
    totalWorkouts: allWorkouts.length,
    totalSets,
    totalVolume,
    workoutsThisWeek,
    workoutsThisMonth,
    volumeThisWeek,
    volumeThisMonth,
    muscleGroupVolume,
    currentStreak,
    longestStreak,
    lastWorkoutDate: allWorkouts[0]?.date,
  };
}

/**
 * Get ISO week string (YYYY-Www)
 */
export function getIsoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    (((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Calculate streaks based on weekly consistency.
 * A streak is defined as consecutive weeks with at least one workout.
 * Current streak counts backwards from current or previous week.
 */
export function calculateStreaks(
  workouts: StrengthWorkout[],
): { currentStreak: number; longestStreak: number } {
  if (workouts.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get current time context
  const now = new Date();
  const currentWeek = getIsoWeek(now.toISOString().split("T")[0]);
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const previousWeek = getIsoWeek(lastWeekDate.toISOString().split("T")[0]);

  // Map WeekString -> Date (any date in that week) to facilitate streak gaps calculation
  const weekToDate = new Map<string, string>(); // week -> YYYY-MM-DD
  for (const w of workouts) {
    const iso = getIsoWeek(w.date);
    if (!weekToDate.has(iso)) {
      weekToDate.set(iso, w.date);
    }
  }

  const sortedUniqueWeeks = Array.from(weekToDate.keys()).sort().reverse();

  if (sortedUniqueWeeks.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Calculate Longest Streak
  let maxStreak = 1;
  let curStreak = 1;

  for (let i = 0; i < sortedUniqueWeeks.length - 1; i++) {
    const thisWeek = sortedUniqueWeeks[i];
    const nextWeek = sortedUniqueWeeks[i + 1]; // older

    // Check if nextWeek is exactly 1 week before thisWeek
    const d1 = new Date(weekToDate.get(thisWeek)!);
    const d2 = new Date(weekToDate.get(nextWeek)!);

    // Calculate week difference
    // We rely on getIsoWeek on (d1 - 7 days) == nextWeek?
    // Since d1 and d2 can be any day in the week (e.g. Mon and Sun),
    // simple time diff isn't enough.
    // But we can check: getIsoWeek(d1 - 7 days) === nextWeek?

    // Warning: d1 might be Monday, d1-7 is previous Monday.
    // We need to align them?
    // Actually, if we just convert (d1 - 7 days) to ISO week string, it should match nextWeek.
    // BUT `d1` is just *some* date in the week.
    // If `d1` is a Tuesday, `d1-7` is previous Tuesday, which is in the previous week.
    // So yes, `getIsoWeek(d1 - 7 days)` should return the previous week string.

    const d1Obj = new Date(weekToDate.get(thisWeek)!);
    // Ensure we are working with UTC dates to avoid DST issues affecting "7 days ago" logic?
    // Or just use local time, usually fine for -7 days unless crossing DST boundary at midnight.
    // Let's safer: subtract 7 days.
    const prevWeekDate = new Date(d1Obj);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const expectedPrevWeek = getIsoWeek(
      prevWeekDate.toISOString().split("T")[0],
    );

    if (nextWeek === expectedPrevWeek) {
      curStreak++;
    } else {
      if (curStreak > maxStreak) maxStreak = curStreak;
      curStreak = 1;
    }
  }
  if (curStreak > maxStreak) maxStreak = curStreak;

  // Calculate Current Streak
  // It must start at currentWeek or previousWeek
  let activeStreak = 0;
  const latestWeek = sortedUniqueWeeks[0];

  if (latestWeek === currentWeek || latestWeek === previousWeek) {
    // We are active. The streak is the first sequence in sortedUniqueWeeks
    // We can just reuse the logic above, but stop at first break.
    activeStreak = 1;
    for (let i = 0; i < sortedUniqueWeeks.length - 1; i++) {
      const thisWeek = sortedUniqueWeeks[i];
      const nextWeek = sortedUniqueWeeks[i + 1];

      const d1Obj = new Date(weekToDate.get(thisWeek)!);
      const prevWeekDate = new Date(d1Obj);
      prevWeekDate.setDate(prevWeekDate.getDate() - 7);
      const expectedPrevWeek = getIsoWeek(
        prevWeekDate.toISOString().split("T")[0],
      );

      if (nextWeek === expectedPrevWeek) {
        activeStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak: activeStreak,
    longestStreak: maxStreak,
  };
}

// ============================================
// Data Management
// ============================================

/**
 * Update merge info on a strength workout
 */
export async function updateWorkoutMergeInfo(
  userId: string,
  workoutId: string,
  mergeInfo: StrengthWorkout["mergeInfo"],
): Promise<boolean> {
  const workout = await getWorkout(userId, workoutId);
  if (!workout) return false;

  workout.mergeInfo = mergeInfo;
  workout.updatedAt = new Date().toISOString();
  await saveWorkout(workout);
  return true;
}

/**
 * Clear merge info from a strength workout (separate/unmerge)
 */
export async function clearWorkoutMergeInfo(
  userId: string,
  workoutId: string,
): Promise<boolean> {
  const workout = await getWorkout(userId, workoutId);
  if (!workout) return false;

  workout.mergeInfo = { isMerged: false };
  workout.updatedAt = new Date().toISOString();
  await saveWorkout(workout);
  return true;
}

export async function clearUserStrengthData(userId: string): Promise<void> {
  // 1. Delete all workouts
  const workoutIter = kv.list({ prefix: ["strength_workouts", userId] });
  for await (const entry of workoutIter) {
    await kv.delete(entry.key);
  }

  // 2. Delete all Personal Bests
  const pbIter = kv.list({ prefix: ["strength_pbs", userId] });
  for await (const entry of pbIter) {
    await kv.delete(entry.key);
  }
}

// Export singleton-style
export const strengthRepo = {
  saveWorkout,
  getWorkout,
  getWorkoutsByDateRange,
  getAllWorkouts,
  getWorkoutByDateAndName,
  deleteWorkout,
  saveExercise,
  getExercise,
  getAllExercises,
  saveExercises,
  savePersonalBest,
  getPersonalBest,
  getAllPersonalBests,
  savePersonalBests,
  resetExercise,
  importWorkouts,
  getStrengthStats,
  calculateStreaks, // Exported for testing
  updateWorkoutMergeInfo,
  clearWorkoutMergeInfo,
  clearUserStrengthData,
};
