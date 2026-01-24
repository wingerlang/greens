/// <reference lib="deno.ns" />
import {
  calculateBMI,
  calculateBMR,
  calculateCalorieDeficit,
  calculateMacros,
  calculateTDEE,
} from "./healthCalculators.ts";
import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("calculateBMI", () => {
  // 70kg, 175cm (1.75m)
  // 70 / (1.75^2) = 70 / 3.0625 = 22.857
  const bmi = calculateBMI(70, 175);
  assertAlmostEquals(bmi, 22.9, 0.1);
});

Deno.test("calculateBMR - Mifflin St Jeor (Male)", () => {
  // Male: 10W + 6.25H - 5A + 5
  // 80kg, 180cm, 30yo
  // 800 + 1125 - 150 + 5 = 1780
  const bmr = calculateBMR(80, 180, 30, "male");
  assertEquals(bmr, 1780);
});

Deno.test("calculateTDEE", () => {
  // BMR 2000, Sedentary (1.2) -> 2400
  assertEquals(calculateTDEE(2000, "sedentary"), 2400);
  // Active (1.55) -> 3100
  assertEquals(calculateTDEE(2000, "active"), 3100);
});

Deno.test("calculateCalorieDeficit", () => {
  // Lose 1kg in 10 days
  // 1kg fat = 7700 kcal
  // Deficit needed = 7700
  // Daily deficit = 770
  const tdee = 2500;
  const res = calculateCalorieDeficit(80, 79, 10, tdee);
  assertEquals(res.dailyDeficit, 770);
  assertEquals(res.targetCalories, 2500 - 770);
});

Deno.test("calculateMacros", () => {
  // 2000 kcal. 40/30/30
  // P: 800 kcal / 4 = 200g
  // C: 600 kcal / 4 = 150g
  // F: 600 kcal / 9 = 66.6g -> 67g
  const macros = calculateMacros(2000, { p: 40, c: 30, f: 30 });
  assertEquals(macros.protein, 200);
  assertEquals(macros.carbs, 150);
  assertEquals(macros.fat, 67);
});
