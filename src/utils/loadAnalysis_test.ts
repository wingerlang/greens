import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calculateEffectiveLoad, generateLoadInsights } from "./loadAnalysis.ts";
import { WeeklyLoadData } from "../models/loadAnalysisTypes.ts";
import { StrengthWorkout } from "../models/strengthTypes.ts";

Deno.test("Load Analysis - Basic effective set calculation", () => {
    const mockSession: StrengthWorkout = {
        id: "1",
        userId: "u1",
        date: "2023-01-01",
        name: "Test Workout",
        totalVolume: 1000,
        totalSets: 1,
        totalReps: 10,
        uniqueExercises: 1,
        source: "manual",
        createdAt: "",
        updatedAt: "",
        exercises: [{
            exerciseId: "e1",
            exerciseName: "Squat",
            sets: [
                { setNumber: 1, reps: 5, weight: 100 } // e1RM ~116
            ]
        }]
    };

    const mappings = { "squat": "quads" };

    // First run - Cold start (Reference Max 0 -> Effective)
    const result = calculateEffectiveLoad([mockSession], mappings as any, {});
    assertEquals(result[0].effectiveSets, 1);
});

Deno.test("Load Analysis - Insight Logic", () => {
    // Mock data for "Progress"
    const progressData: WeeklyLoadData[] = [
        { week: "v1", weekNumber: 1, year: 2023, effectiveSets: 5, totalSets: 5, maxE1RM: 100, averageE1RM: 100, exerciseCount: 1 },
        { week: "v2", weekNumber: 2, year: 2023, effectiveSets: 5, totalSets: 5, maxE1RM: 105, averageE1RM: 105, exerciseCount: 1 },
        { week: "v3", weekNumber: 3, year: 2023, effectiveSets: 5, totalSets: 5, maxE1RM: 110, averageE1RM: 110, exerciseCount: 1 },
    ];

    const insight = generateLoadInsights(progressData);
    assertEquals(insight.scenario, "PROGRESS");
});
