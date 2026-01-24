/// <reference lib="deno.ns" />
import {
  calculateEstimated1RM,
  calculateIPFPoints,
  calculatePlateLoading,
  calculateWilks,
} from "./strengthCalculators.ts";
import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("calculateWilks - Male 80kg, 500kg Total", () => {
  // Using online calculator for reference
  // 80kg male, 500kg total -> ~341.01 (1995 Wilks) or similar.
  // Our implementation uses 500 / denominator.
  const wilks = calculateWilks(80, 500, "male");
  // It should be around 341
  assertAlmostEquals(wilks, 341.0, 1);
});

Deno.test("calculateIPFPoints - Male 80kg, 500kg Total (Raw)", () => {
  // IPF GL Points
  // 80kg, 500kg
  const pts = calculateIPFPoints(80, 500, "male", "raw");
  // Expectation: around 75-80?
  // Formula: 500 * 100 / (1199.72... - 1025... * e^(-0.00921 * 80))
  // e^(-0.00921*80) = e^(-0.7368) = 0.4786
  // Denom = 1199.7 - 1025.18 * 0.4786 = 1199.7 - 490.6 = 709.1
  // Points = 50000 / 709.1 = 70.5
  assertAlmostEquals(pts, 70.5, 1);
});

Deno.test("calculateEstimated1RM - 100kg x 5 reps", () => {
  // Epley: 100 * (1 + 5/30) = 100 * 1.166 = 116.6
  // Brzycki: 100 * 36/(37-5) = 100 * 36/32 = 112.5
  // Lander: 100*100 / (101.3 - 2.67*5) = 10000 / 87.95 = 113.7
  // Average should be roughly 114-115
  const rm = calculateEstimated1RM(100, 5);
  if (rm < 112 || rm > 117) {
    throw new Error(`Estimated 1RM ${rm} seems out of range for 100x5`);
  }
});

Deno.test("calculatePlateLoading - 60kg", () => {
  // Bar 20. Target 60. Need 40 total. 20 per side.
  // Plates: 20
  const res = calculatePlateLoading(60, 20);
  assertEquals(res.remainder, 0);
  assertEquals(res.plates.length, 1);
  assertEquals(res.plates[0].weight, 20);
  assertEquals(res.plates[0].count, 1);
});

Deno.test("calculatePlateLoading - 65kg", () => {
  // Bar 20. Target 65. Need 45 total. 22.5 per side.
  // Plates: 20, 2.5
  const res = calculatePlateLoading(65, 20);
  assertEquals(res.remainder, 0);
  // Should have 20 and 2.5
  const w20 = res.plates.find((p) => p.weight === 20);
  const w25 = res.plates.find((p) => p.weight === 2.5);
  if (!w20 || !w25) throw new Error("Missing plates");
  assertEquals(w20.count, 1);
  assertEquals(w25.count, 1);
});
