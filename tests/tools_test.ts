
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  calculateCalorieDeficit,
  calculateMacros,
} from "../src/utils/healthCalculators.ts";
import {
  estimate1RM,
  calculateAverage1RM,
  calculatePlateLoading,
} from "../src/utils/strengthCalculators.ts";
import {
  convertPaceToTime,
  convertTimeToPace,
  calculateDistance,
  estimateCardioCalories,
  calculateVDOT,
  predictRaceTime,
  calculateRiegelTime,
  calculateCooperVO2
} from "../src/utils/runningCalculator.ts";

import {
  calculateWilks,
  calculateIPFPoints
} from "../src/utils/strengthCalculators.ts";
import { analyzeStrengthHistory, type ExerciseAnalysis } from "../src/utils/strengthAnalysis.ts";
import type { StrengthWorkout } from "../src/models/strengthTypes.ts";

// --- Health Tests ---

Deno.test("calculateBMI - standard cases", () => {
  assertEquals(calculateBMI(80, 180), 24.7); // 80 / 1.8^2 = 24.69...
  assertEquals(calculateBMI(100, 180), 30.9);
});

Deno.test("calculateBMR - Mifflin-St Jeor", () => {
  // Male: 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  assertEquals(calculateBMR(80, 180, 30, "male"), 1780);
  // Female: 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 -> 1320
  assertEquals(calculateBMR(60, 165, 30, "female"), 1320);
});

Deno.test("calculateTDEE - multipliers", () => {
  const bmr = 2000;
  assertEquals(calculateTDEE(bmr, "sedentary"), 2400); // 1.2
  assertEquals(calculateTDEE(bmr, "active"), 3100); // 1.55
});

Deno.test("calculateCalorieDeficit", () => {
  // Lose 5kg in 10 weeks (0.5kg/week)
  // 1kg fat ~= 7700kcal -> 0.5kg = 3850kcal / 7 days = 550kcal deficit/day
  const result = calculateCalorieDeficit(85, 80, 70, 2500); // 70 days = 10 weeks
  assertEquals(result.dailyDeficit > 540 && result.dailyDeficit < 560, true);
  assertEquals(result.targetCalories, 2500 - result.dailyDeficit);
});

Deno.test("calculateMacros", () => {
  // 2000 kcal, 40% P, 40% C, 20% F
  // P: 800 kcal / 4 = 200g
  // C: 800 kcal / 4 = 200g
  // F: 400 kcal / 9 = 44.44... -> 44g
  const result = calculateMacros(2000, { p: 40, c: 40, f: 20 });
  assertEquals(result.protein, 200);
  assertEquals(result.carbs, 200);
  assertEquals(result.fat, 44);
});

// --- Strength Tests ---

Deno.test("calculateAverage1RM - variants", () => {
  const weight = 100;
  const reps = 5;
  const result = calculateAverage1RM(weight, reps);

  // Epley: 100 * (1 + 5/30) = 116.67
  // Brzycki: 100 / (1.0278 - 0.0278 * 5) = 100 / 0.8888 = 112.5

  assertEquals(result.epley > 116 && result.epley < 117, true);
  assertEquals(result.brzycki > 112 && result.brzycki < 113, true);
  assertEquals(result.average > 110, true);
});

Deno.test("calculatePlateLoading", () => {
  // Target 100kg, Bar 20kg -> Need 80kg -> 40kg per side
  // Plates: 25, 20, 15, 10, 5, 2.5, 1.25
  // 40kg = 25 + 15 (if available) or 20 + 20

  const result = calculatePlateLoading(100, 20); // Default plates
  // Expecting 2x20kg (if standard gym) or similar.
  // Let's assume standard set: 25, 20, 15, 10, 5, 2.5, 1.25
  // 40kg side -> 25 + 15
  const sideWeight = result.plates.reduce((acc, p) => acc + p.weight * p.count, 0);
  assertEquals(sideWeight, 40);
});

// --- Cardio Tests ---

Deno.test("convertPaceToTime", () => {
  // 5:00 min/km for 10km -> 50 mins -> 3000 seconds
  const pace = 5 * 60; // 300s
  assertEquals(convertPaceToTime(10, pace), 3000);
});

Deno.test("convertTimeToPace", () => {
  // 50 mins (3000s) for 10km -> 300s/km (5:00)
  assertEquals(convertTimeToPace(10, 3000), 300);
});

Deno.test("calculateDistance", () => {
  // 1 hour (3600s) at 6:00 min/km (360s) -> 10km
  assertEquals(calculateDistance(3600, 360), 10);
});

Deno.test("estimateCardioCalories - Running", () => {
  // Running: ~1 kcal/kg/km
  // 80kg person runs 10km -> ~800kcal
  const calories = estimateCardioCalories("running", 3600, { weightKg: 80, speedKph: 10 });
  assertEquals(calories > 750 && calories < 850, true);
});

Deno.test("estimateCardioCalories - Cycling", () => {
  // Cycling: Power * Time * Efficiency factor
  // 200W for 1h (3600s) -> 200J/s * 3600s = 720,000 Joules
  // 1 kcal = 4184 Joules -> 172 kcal output
  // Human efficiency ~24% -> 172 / 0.24 = 716 kcal
  const calories = estimateCardioCalories("cycling", 3600, { powerWatts: 200 });
  assertEquals(calories > 600 && calories < 800, true);
});

Deno.test("calculateVDOT and predictRaceTime", () => {
  // 5km in 20 mins (1200s) -> VDOT ~49.8
  const vdot = calculateVDOT(5, 1200);
  assertEquals(vdot > 49 && vdot < 51, true);

  // Predict 10km time from VDOT 50
  // VDOT 50 10k is ~41:20 (2480s)
  const predictedTime = predictRaceTime(50, 10);
  assertEquals(predictedTime > 2400 && predictedTime < 2600, true);
});

Deno.test("calculateRiegelTime", () => {
  // 5k in 20 min -> 10k prediction
  // T2 = 20 * (10/5)^1.06 = 20 * 2.085 = 41.7 mins
  const t2 = calculateRiegelTime(1200, 5, 10);
  assertEquals(t2 > 2400 && t2 < 2600, true);
});

Deno.test("calculateCooperVO2", () => {
  // 2400m in 12 mins
  // (2400 - 504.9) / 44.73 = 1895.1 / 44.73 = 42.36
  const vo2 = calculateCooperVO2(2400);
  assertEquals(Math.abs(vo2 - 42.4) < 0.5, true);
});

Deno.test("Strength Standards (Wilks/IPF)", () => {
  // Wilks
  const wilks = calculateWilks(80, 500, 'male');
  assertEquals(wilks > 300, true);

  // IPF
  const ipf = calculateIPFPoints(80, 500, 'male');
  assertEquals(ipf > 0, true);
});

Deno.test("analyzeStrengthHistory", () => {
  const mockSessions: StrengthWorkout[] = [
    {
      id: "1", date: "2023-01-01", userId: "u1", name: "Legs", totalVolume: 0, totalSets: 0, totalReps: 0, uniqueExercises: 0, source: 'manual', createdAt: "", updatedAt: "",
      exercises: [
        {
          exerciseId: "e1", exerciseName: "Back Squat",
          sets: [{ setNumber: 1, reps: 5, weight: 100 }, { setNumber: 2, reps: 1, weight: 120 }]
        }
      ]
    },
    {
      id: "2", date: "2023-01-08", userId: "u1", name: "Legs 2", totalVolume: 0, totalSets: 0, totalReps: 0, uniqueExercises: 0, source: 'manual', createdAt: "", updatedAt: "",
      exercises: [
        {
          exerciseId: "e1", exerciseName: "Squat",
          sets: [{ setNumber: 1, reps: 5, weight: 105 }] // PB for 5 reps
        }
      ]
    }
  ];

  const analysis = analyzeStrengthHistory(mockSessions, "Squat");

  assertEquals(analysis.totalWorkouts, 2);
  assertEquals(analysis.bestRepMaxes[5].weight, 105); // Best 5 rep set
  assertEquals(analysis.bestRepMaxes[1].weight, 120); // Best 1 rep set

  // 120x1 -> 1RM ~120
  // 105x5 -> 1RM ~105 * (1 + 5/30) = 105 * 1.166 = 122.5
  // So best Est 1RM should be from the 5 rep set
  const bestEst = analysis.allTimeBest1RM?.estimated1RM || 0;
  assertEquals(bestEst > 121, true);
});
