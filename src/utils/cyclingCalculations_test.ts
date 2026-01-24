/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  calculateWattsPerKg,
  estimateFtp,
  getAssaultBikeLevel,
  getCyclingLevel,
} from "./cyclingCalculations.ts";

Deno.test("calculateWattsPerKg - basic calculation", () => {
  assertEquals(calculateWattsPerKg(250, 80), 3.13);
  assertEquals(calculateWattsPerKg(300, 75), 4);
});

Deno.test("calculateWattsPerKg - edge cases", () => {
  assertEquals(calculateWattsPerKg(0, 80), 0);
  assertEquals(calculateWattsPerKg(200, 0), 0);
});

Deno.test("estimateFtp", () => {
  assertEquals(estimateFtp(300), 285);
  assertEquals(estimateFtp(200), 190);
});

Deno.test("getCyclingLevel - Male", () => {
  // 6.0 is World Class
  assertEquals(getCyclingLevel(6.0, "ftp", "male"), "World Class");
  assertEquals(getCyclingLevel(6.1, "ftp", "male"), "World Class");

  // 3.0 is Moderate
  assertEquals(getCyclingLevel(3.0, "ftp", "male"), "Moderate");
  assertEquals(getCyclingLevel(3.1, "ftp", "male"), "Moderate");

  // 2.9 is Fair (Threshold for Moderate is 3.0, Fair is 2.5)
  assertEquals(getCyclingLevel(2.9, "ftp", "male"), "Fair");

  // 1.0 is Untrained (below 2.0)
  assertEquals(getCyclingLevel(1.0, "ftp", "male"), "Untrained");
});

Deno.test("getCyclingLevel - Female", () => {
  // 5.3 is World Class
  assertEquals(getCyclingLevel(5.3, "ftp", "female"), "World Class");

  // 2.5 is Moderate
  assertEquals(getCyclingLevel(2.5, "ftp", "female"), "Moderate");
});

Deno.test("getAssaultBikeLevel", () => {
  // Male 1m: Elite >= 70
  assertEquals(getAssaultBikeLevel(70, "1m", "male"), "Elite");

  // Male 1m: Intermediate >= 40
  assertEquals(getAssaultBikeLevel(40, "1m", "male"), "Intermediate");
  assertEquals(getAssaultBikeLevel(39, "1m", "male"), "Beginner"); // >25 is Beginner in array, wait.

  // Standards: Elite, Advanced, Intermediate, Beginner
  // If 39:
  // Elite (70)? No.
  // Adv (55)? No.
  // Int (40)? No.
  // Beg (25)? Yes. -> Returns 'Beginner' from the list.

  // If 10:
  // ... Beg (25)? No.
  // Loop finishes. Returns default 'Beginner'.

  assertEquals(getAssaultBikeLevel(39, "1m", "male"), "Beginner");
  assertEquals(getAssaultBikeLevel(10, "1m", "male"), "Beginner");
});
