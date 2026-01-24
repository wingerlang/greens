/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateBMR,
  calculateExerciseCalories,
  calculateStreak,
  calculateTrainingStreak,
  calculateWeeklyTrainingStreak,
} from "./analytics.ts";
import { getISODate } from "../models/types.ts";

// Helper to mock dates
const today = getISODate();
const yesterday = getISODate(new Date(Date.now() - 86400000));
const dayBeforeYesterday = getISODate(new Date(Date.now() - 86400000 * 2));

Deno.test("calculateStreak - counts consecutive active days including today", () => {
  const mealEntries: any[] = [
    { date: today, items: [] },
    { date: yesterday, items: [] },
  ];
  // Should be 2
  const streak = calculateStreak(mealEntries, [], {}, [], today);
  assertEquals(streak, 2);
});

Deno.test("calculateStreak - counts consecutive active days ending yesterday if today is inactive", () => {
  const mealEntries: any[] = [
    { date: yesterday, items: [] },
    { date: dayBeforeYesterday, items: [] },
  ];
  // Should be 2 (yesterday + dayBeforeYesterday)
  const streak = calculateStreak(mealEntries, [], {}, [], today);
  assertEquals(streak, 2);
});

Deno.test("calculateStreak - breaks on gap", () => {
  const mealEntries: any[] = [
    { date: today, items: [] },
    // gap on yesterday
    { date: dayBeforeYesterday, items: [] },
  ];
  // Should be 1 (just today)
  const streak = calculateStreak(mealEntries, [], {}, [], today);
  assertEquals(streak, 1);
});

Deno.test("calculateTrainingStreak - filters by type", () => {
  const exercises: any[] = [
    { date: today, type: "running" },
    { date: yesterday, type: "strength" },
    { date: dayBeforeYesterday, type: "running" },
  ];

  // Running streak: Today (running) -> Yesterday (strength - skip) -> Streak breaks?
  // Wait, the logic is "isTrainingDay" for that specific type.
  // Yesterday was NOT a running day. So running streak is 1.
  assertEquals(calculateTrainingStreak(exercises, today, "running"), 1);

  // Strength streak: Today (running - not strength). Yesterday (strength).
  // So streak should count from yesterday. 1 day.
  assertEquals(calculateTrainingStreak(exercises, today, "strength"), 1);

  // Any training: Today (yes), Yesterday (yes), DayBefore (yes). 3 days.
  assertEquals(calculateTrainingStreak(exercises, today), 3);
});

Deno.test("calculateBMR - calculates correctly for male", () => {
  const weight = 80;
  const settings: any = {
    height: 180,
    birthYear: new Date().getFullYear() - 30, // 30 years old
    gender: "male",
  };
  // (10 * 80) + (6.25 * 180) - (5 * 30) + 5
  // 800 + 1125 - 150 + 5 = 1780
  const bmr = calculateBMR(weight, settings);
  assertEquals(bmr, 1780);
});

Deno.test("calculateExerciseCalories - calculates running moderate", () => {
  const weight = 80;
  const duration = 60; // 1 hour
  const type = "running";
  const intensity = "moderate";

  // MET for running moderate is 8
  // 8 * 80 * (60/60) = 640
  const cals = calculateExerciseCalories(type, duration, intensity, weight);
  assertEquals(cals, 640);
});
