import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  analyzeErgPerformance,
  ErgMath,
  getErgLevel,
} from "./ergCalculations.ts";
import { ExerciseEntry } from "../models/types.ts";

Deno.test("ErgMath - Watts to Pace Conversion", () => {
  // 2:00/500m -> 120s -> 500/120 = 4.166 m/s
  // Watts = 2.8 * (4.166)^3 = 2.8 * 72.33 = 202.5
  const watts = ErgMath.paceToWatts(120);
  assertEquals(Math.round(watts), 203);

  // Reverse
  const pace = ErgMath.wattsToPace(202.5);
  assertEquals(Math.round(pace), 120);
});

Deno.test("ErgMath - Format Time", () => {
  assertEquals(ErgMath.formatTime(125.5), "2:05.5");
  assertEquals(ErgMath.formatTime(60), "1:00.0");
});

Deno.test("ErgMath - Parse Time", () => {
  assertEquals(ErgMath.parseTime("2:00"), 120);
  assertEquals(ErgMath.parseTime("2:05.5"), 125.5);
  assertEquals(ErgMath.parseTime("1:00:00"), 3600);
});

Deno.test("getErgLevel - Returns correct level", () => {
  const level = getErgLevel(390, "2000m", "row", "male"); // 6:30
  assertEquals(level, "Advanced");
});

Deno.test("analyzeErgPerformance - Finds best row", () => {
  const mockEntries: ExerciseEntry[] = [
    {
      id: "1",
      date: "2023-01-01",
      title: "Morning Row",
      type: "rowing",
      distance: 2, // 2000m
      distanceUnit: "km",
      durationMinutes: 7, // 7:00
      caloriesBurned: 100,
      userId: "user1",
      createdAt: "2023-01-01",
    } as any,
  ];

  const results = analyzeErgPerformance(mockEntries, [], "row", "male");
  const record2k = results["2000m"];

  if (!record2k) throw new Error("Should have found 2k record");

  assertEquals(record2k.timeSeconds, 420);
  assertEquals(record2k.distance, 2000);
  assertEquals(record2k.level, "Intermediate");
});
