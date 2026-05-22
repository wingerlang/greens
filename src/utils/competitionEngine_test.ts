/// <reference lib="deno.ns" />
import { assertEquals } from "@std/assert";
import { calculateDailyPoints, COMPETITION_PRESETS } from "./competitionEngine.ts";
import type {
    CompetitionRule,
    ExerciseEntry,
    DailyVitals,
    NutritionSummary
} from "../models/types.ts";

// Helper to get preset rule by presetId
function getPresetRule(presetId: string, points = 1): CompetitionRule {
    const preset = COMPETITION_PRESETS.find(p => p.presetId === presetId);
    if (!preset) {
        throw new Error(`Preset with ID ${presetId} not found`);
    }
    return {
        id: `rule-${presetId}`,
        name: preset.name,
        description: preset.description,
        points: preset.points || points,
        type: preset.type,
        presetId: preset.presetId
    };
}

Deno.test("competitionEngine - calculateDailyPoints - diet rules (vegan_day, sugar_free)", () => {
    const rules = [
        getPresetRule("vegan_day", 1),
        getPresetRule("sugar_free", 2)
    ];

    const vitals: DailyVitals = { water: 0, sleep: 0, updatedAt: "" };
    const exercises: ExerciseEntry[] = [];
    
    // Test case 1: No food logged -> 0 points
    const nutritionEmpty: NutritionSummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, exercises, nutritionEmpty), 0);

    // Test case 2: Food logged -> points rewarded
    const nutritionLogged: NutritionSummary = { calories: 1500, protein: 80, carbs: 200, fat: 40, fiber: 15 };
    // vegan_day: 1pt, sugar_free: 1pt (preset points)
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, exercises, nutritionLogged), 2);
});

Deno.test("competitionEngine - calculateDailyPoints - workout rules (interval_run, long_run, any_workout)", () => {
    const rules = [
        getPresetRule("interval_run"),
        getPresetRule("long_run"),
        getPresetRule("any_workout")
    ];

    const vitals: DailyVitals = { water: 0, sleep: 0, updatedAt: "" };
    const nutrition: NutritionSummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

    // Case 1: No workouts -> 0 points
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, [], nutrition), 0);

    // Case 2: Simple run -> any_workout (1pt)
    const runEntry: ExerciseEntry = {
        id: "e1",
        date: "2026-05-20",
        type: "running",
        durationMinutes: 30,
        intensity: "moderate",
        caloriesBurned: 300,
        createdAt: ""
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, [runEntry], nutrition), 1);

    // Case 3: Interval run -> any_workout (1pt) + interval_run (2pt)
    const intervalEntry: ExerciseEntry = {
        ...runEntry,
        subType: "interval"
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, [intervalEntry], nutrition), 3);

    // Case 4: Long run (>90 min) -> any_workout (1pt) + long_run (2pt)
    const longRunEntry: ExerciseEntry = {
        ...runEntry,
        durationMinutes: 100
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, [longRunEntry], nutrition), 3);
});

Deno.test("competitionEngine - calculateDailyPoints - vitals rules (no_caffeine, sleep_goal, water_goal)", () => {
    const rules = [
        getPresetRule("no_caffeine"),
        getPresetRule("sleep_goal"),
        getPresetRule("water_goal")
    ];

    const exercises: ExerciseEntry[] = [];
    const nutrition: NutritionSummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

    // Case 1: High caffeine, poor sleep, no water -> 0 points
    const vitalsBad: DailyVitals = {
        caffeine: 200,
        sleep: 5.5,
        water: 2,
        updatedAt: ""
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitalsBad, exercises, nutrition), 0);

    // Case 2: No caffeine, 8h sleep, 7 glasses water -> 3 points
    const vitalsGood: DailyVitals = {
        caffeine: 0,
        sleep: 8.0,
        water: 7,
        updatedAt: ""
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitalsGood, exercises, nutrition), 3);
});

Deno.test("competitionEngine - calculateDailyPoints - tonnage_king", () => {
    const rules = [getPresetRule("tonnage_king")];
    const vitals: DailyVitals = { water: 0, sleep: 0, updatedAt: "" };
    const nutrition: NutritionSummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

    // Lifted tonnage: 800 kg total. User weight: 80 kg.
    // 800 / 80 = 10 (needs to be > 10x body weight total) -> No points
    const exerciseEntryUnder: ExerciseEntry = {
        id: "e1",
        date: "2026-05-20",
        type: "strength",
        tonnage: 800,
        durationMinutes: 45,
        intensity: "moderate",
        caloriesBurned: 200,
        createdAt: ""
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, [exerciseEntryUnder], nutrition, 80), 0);

    // Lifted tonnage: 1000 kg total. User weight: 80 kg.
    // 1000 / 80 = 12.5 (> 10) -> Achieved! (3pt preset)
    const exerciseEntryOver: ExerciseEntry = {
        ...exerciseEntryUnder,
        tonnage: 1000
    };
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, [exerciseEntryOver], nutrition, 80), 3);
});

Deno.test("competitionEngine - calculateDailyPoints - complex combinations & fallback custom rule", () => {
    // Custom rule not defined by presetId
    const customRule: CompetitionRule = {
        id: "rule-custom-1",
        name: "Bastubad",
        description: "Basta efter träningen",
        points: 2,
        type: "custom"
    };

    const rules = [
        getPresetRule("double_session"),
        getPresetRule("ultra_run"),
        customRule
    ];

    const vitals: DailyVitals = { water: 0, sleep: 0, updatedAt: "" };
    const nutrition: NutritionSummary = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

    const exercises: ExerciseEntry[] = [
        {
            id: "e1",
            date: "2026-05-20",
            type: "running",
            durationMinutes: 200, // > 180 min -> ultra_run (5pt)
            intensity: "moderate",
            caloriesBurned: 1500,
            notes: "Testade ett riktigt bastubad efteråt", // Matches customRule name 'Bastubad' case-insensitively -> (2pt)
            createdAt: ""
        },
        {
            id: "e2",
            date: "2026-05-20",
            type: "yoga",
            durationMinutes: 20,
            intensity: "low",
            caloriesBurned: 50,
            createdAt: ""
        }
    ];

    // double_session: 2 entries for this date -> 2pt
    // ultra_run: e1 matches -> 5pt
    // customRule: e1 notes matches 'bastubad' -> 2pt
    // Total expected: 2 + 5 + 2 = 9 points
    assertEquals(calculateDailyPoints("2026-05-20", rules, vitals, exercises, nutrition), 9);
});
