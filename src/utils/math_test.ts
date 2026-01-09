import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calculateRollingAverage, calculateTrend } from "./math.ts";

Deno.test("calculateRollingAverage - basic window", () => {
    const data = [10, 10, 10, 10, 10]; // 5 items
    // Window size 7 default, so it takes what it can
    const result = calculateRollingAverage(data);
    assertEquals(result, [10, 10, 10, 10, 10]);
});

Deno.test("calculateRollingAverage - smoothing", () => {
    const data = [10, 20, 10, 20];
    const result = calculateRollingAverage(data, 2);
    // index 0: [10] -> 10
    // index 1: [10, 20] -> 15
    // index 2: [20, 10] -> 15
    // index 3: [10, 20] -> 15
    assertEquals(result, [10, 15, 15, 15]);
});

Deno.test("calculateTrend", () => {
    assertEquals(calculateTrend([10, 11]), "up"); // +1 > 0.5
    assertEquals(calculateTrend([10, 9]), "down"); // -1 < -0.5
    assertEquals(calculateTrend([10, 10.2]), "stable"); // 0.2 < 0.5
});
