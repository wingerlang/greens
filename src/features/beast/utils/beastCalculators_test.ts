/// <reference lib="deno.ns" />
import {
    calculateCooperScore,
    calculateStrengthScore,
    calculateHyroxScore,
    getBeastTier
} from "./beastCalculators.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("calculateCooperScore", () => {
    // Max 3600, Min 1500
    assertEquals(calculateCooperScore(3600), 100);
    assertEquals(calculateCooperScore(1500), 0);
    assertEquals(calculateCooperScore(2550), 50); // Midpoint
});

Deno.test("calculateStrengthScore (Wilks)", () => {
    // Test integration with Wilks
    // We assume 500 Wilks is 100 points
    // 80kg male, 500kg total -> Wilks ~340 -> Score ~68
    // I need to check Wilks calc in a separate test, but here we test the normalization.
    const score = calculateStrengthScore(80, 500, 'male');
    // Wilks for 80kg/500kg is roughly 340.
    // 340/500 * 100 = 68.
    // Let's just check it's in range.
    if (score < 60 || score > 80) throw new Error(`Score ${score} seems off for 80kg/500kg total`);
});

Deno.test("calculateHyroxScore", () => {
    // Best 57m (3420s) -> 100
    // Baseline 120m (7200s) -> 0
    assertEquals(calculateHyroxScore(57 * 60), 100);
    assertEquals(calculateHyroxScore(120 * 60), 0);

    // 88.5 min midpoint (5310s) -> 50
    const mid = (57 + 120) / 2 * 60;
    assertEquals(calculateHyroxScore(mid), 50);
});

Deno.test("getBeastTier", () => {
    assertEquals(getBeastTier(95), "TITAN");
    assertEquals(getBeastTier(10), "ROOKIE");
});
