/// <reference lib="deno.ns" />
import {
  calculateCooperVO2,
  calculateRiegelTime,
  calculateVDOT,
  estimateCardioCalories,
  formatPace,
  formatSeconds,
  getPaceZones,
  predictRaceTime,
} from "./runningCalculator.ts";
import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("calculateVDOT - 5k in 20min", () => {
  const vdot = calculateVDOT(5, 20 * 60);
  // Jack Daniels Table: 20:00 5k is VDOT ~49.8
  assertAlmostEquals(vdot, 49.8, 1);
});

Deno.test("predictRaceTime - VDOT 50 for 10k", () => {
  // VDOT 50 -> 10k should be around 41-42 mins
  const seconds = predictRaceTime(50, 10);
  const mins = seconds / 60;
  assertAlmostEquals(mins, 41.5, 1);
});

Deno.test("getPaceZones - VDOT 50", () => {
  const zones = getPaceZones(50);
  // VDOT 50 Easy Pace ~ 5:00-5:30/km?
  // Threshold ~ 4:15?

  // Just verify hierarchy: Easy > Threshold > Interval (in terms of min/km, easy is slower/higher)
  if (zones.easy < zones.threshold) {
    throw new Error(
      "Easy pace should be slower (higher min/km) than Threshold",
    );
  }
  if (zones.threshold < zones.interval) {
    throw new Error("Threshold pace should be slower than Interval");
  }
});

Deno.test("calculateCooperVO2 - 3000m", () => {
  // (3000 - 504.9) / 44.73 = 55.78
  const vo2 = calculateCooperVO2(3000);
  assertAlmostEquals(vo2, 55.8, 0.1);
});

Deno.test("estimateCardioCalories - Running", () => {
  // 70kg, 10km/h, 1 hour -> 70 * 10 = 700 kcal
  const cal = estimateCardioCalories("running", 3600, {
    weightKg: 70,
    speedKph: 10,
  });
  assertEquals(cal, 700);
});

Deno.test("estimateCardioCalories - Cycling", () => {
  // 200W for 1 hour -> 200 * 3600 J -> / 4184 -> ~172 kcal output -> / 0.24 eff -> ~716 kcal
  const cal = estimateCardioCalories("cycling", 3600, { powerWatts: 200 });
  // 200 * 3600 / 4184 / 0.24 = 716.9
  assertAlmostEquals(cal, 717, 1);
});

Deno.test("calculateRiegelTime", () => {
  // 10k in 40min -> 21.1k
  // 40 * 60 * (21.1/10)^1.06
  // 2400 * 2.11^1.06 ~= 2400 * 2.21 = 5304s = 88.4 min
  const t2 = calculateRiegelTime(40 * 60, 10, 21.1);
  const min = t2 / 60;
  assertAlmostEquals(min, 88.4, 1);
});

Deno.test("formatPace", () => {
  assertEquals(formatPace(5.5), "5:30");
  assertEquals(formatPace(4.0), "4:00");
  assertEquals(formatPace(0), "—");
});

Deno.test("formatSeconds", () => {
  assertEquals(formatSeconds(3665), "1:01:05");
  assertEquals(formatSeconds(65), "1:05");
});
