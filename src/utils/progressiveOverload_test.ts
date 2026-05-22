/// <reference lib="deno.ns" />
import { assertEquals, assert, assertNotEquals } from "@std/assert";
import {
    isCompoundExercise,
    getTopSet,
    calculateVolume,
    getProgressionSuggestion,
    getExerciseHistoryWithRM,
    getExerciseHistory,
    getPlateauWarnings,
    getWeeklyVolumeRecommendations,
    getUnderperformers,
    DEFAULT_CONFIG
} from "./progressiveOverload.ts";
import type { StrengthWorkout, StrengthWorkoutExercise, StrengthSet } from "../models/strengthTypes.ts";

// Helper to create mock workouts
function createMockSet(fields: Partial<StrengthSet> = {}): StrengthSet {
    return {
        setNumber: fields.setNumber ?? 1,
        reps: fields.reps ?? 10,
        weight: fields.weight ?? 50,
        isWarmup: fields.isWarmup ?? false,
        isDropset: fields.isDropset ?? false,
        isFailed: fields.isFailed ?? false,
        ...fields
    };
}

function createMockExercise(name: string, sets: StrengthSet[], fields: Partial<StrengthWorkoutExercise> = {}): StrengthWorkoutExercise {
    return {
        exerciseId: `ex-${name.toLowerCase().replace(/\s+/g, "-")}`,
        exerciseName: name,
        sets,
        ...fields
    };
}

function createMockWorkout(date: string, exercises: StrengthWorkoutExercise[], fields: Partial<StrengthWorkout> = {}): StrengthWorkout {
    return {
        id: `wk-${date}-${Math.random().toString(36).substring(2, 6)}`,
        userId: "user-1",
        date,
        name: `Workout ${date}`,
        exercises,
        totalVolume: exercises.reduce((sum, e) => sum + (e.sets.reduce((es, s) => es + (s.isWarmup ? 0 : s.weight * s.reps), 0)), 0),
        totalSets: exercises.reduce((sum, e) => sum + e.sets.length, 0),
        totalReps: exercises.reduce((sum, e) => sum + (e.sets.reduce((er, s) => er + s.reps, 0)), 0),
        uniqueExercises: exercises.length,
        source: "manual",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...fields
    };
}

// ============================================
// isCompoundExercise Tests
// ============================================

Deno.test("progressiveOverload - isCompoundExercise", () => {
    // Standard compound exercises
    assert(isCompoundExercise("Squat"));
    assert(isCompoundExercise("Bänkpress"));
    assert(isCompoundExercise("Deadlift"));
    assert(isCompoundExercise("Pull-up"));
    assert(isCompoundExercise("Hip thrust"));
    assert(isCompoundExercise("Leg Press"));

    // Isolation/non-compound exercises
    assertEquals(isCompoundExercise("Bicep Curl"), false);
    assertEquals(isCompoundExercise("Tricep Pushdown"), false);
    assertEquals(isCompoundExercise("Lateral Raise"), false);
    assertEquals(isCompoundExercise("Leg Extension"), false);
});

// ============================================
// getTopSet Tests
// ============================================

Deno.test("progressiveOverload - getTopSet - basic weight-based sets", () => {
    const exercise = createMockExercise("Bench Press", [
        createMockSet({ setNumber: 1, reps: 10, weight: 60, isWarmup: true }),
        createMockSet({ setNumber: 2, reps: 8, weight: 80 }),
        createMockSet({ setNumber: 3, reps: 5, weight: 85 }), // This is heaviest (85kg)
        createMockSet({ setNumber: 4, reps: 8, weight: 80 })
    ]);

    const top = getTopSet(exercise);
    assert(top !== null);
    assertEquals(top.weight, 85);
    assertEquals(top.reps, 5);
});

Deno.test("progressiveOverload - getTopSet - tie break on reps", () => {
    const exercise = createMockExercise("Bench Press", [
        createMockSet({ setNumber: 1, reps: 5, weight: 80 }),
        createMockSet({ setNumber: 2, reps: 8, weight: 80 }), // Same weight, more reps
        createMockSet({ setNumber: 3, reps: 6, weight: 80 })
    ]);

    const top = getTopSet(exercise);
    assert(top !== null);
    assertEquals(top.weight, 80);
    assertEquals(top.reps, 8);
});

Deno.test("progressiveOverload - getTopSet - distance-based exercises", () => {
    // Rowing is distance-based
    const exercise = createMockExercise("Rowing", [
        createMockSet({ setNumber: 1, reps: 1, weight: 0, distance: 500, distanceUnit: "m" }),
        createMockSet({ setNumber: 2, reps: 1, weight: 0, distance: 1000, distanceUnit: "m" }), // Longest distance
        createMockSet({ setNumber: 3, reps: 1, weight: 0, distance: 800, distanceUnit: "m" })
    ]);

    const top = getTopSet(exercise);
    assert(top !== null);
    assertEquals(top.distance, 1000);
});

// ============================================
// calculateVolume Tests
// ============================================

Deno.test("progressiveOverload - calculateVolume", () => {
    const exercise = createMockExercise("Squat", [
        createMockSet({ reps: 10, weight: 50, isWarmup: true }), // Ignored
        createMockSet({ reps: 8, weight: 100 }), // 800
        createMockSet({ reps: 8, weight: 100 }), // 800
        createMockSet({ reps: 6, weight: 110 })  // 660
    ]);

    // Total volume: 800 + 800 + 660 = 2260
    assertEquals(calculateVolume(exercise), 2260);
});

// ============================================
// getProgressionSuggestion Tests
// ============================================

Deno.test("progressiveOverload - getProgressionSuggestion - compound at max reps", () => {
    // Config: targetRepRange is 5-12
    const workouts = [
        createMockWorkout("2026-05-15", [
            createMockExercise("Squat", [
                createMockSet({ reps: 12, weight: 100 }) // at max rep range limit (12)
            ])
        ])
    ];

    const suggestion = getProgressionSuggestion("Squat", workouts, "2026-05-16", DEFAULT_CONFIG);
    assert(suggestion !== null);
    assertEquals(suggestion.isCompound, true);
    // Should suggest increasing weight by config increment (DEFAULT: 2.5kg or 2.5% which is 2.5kg)
    assertEquals(suggestion.suggestedWeight, 102.5);
    // Should suggest min rep range (DEFAULT: 5)
    assertEquals(suggestion.suggestedReps, 5);
});

Deno.test("progressiveOverload - getProgressionSuggestion - compound below max reps", () => {
    const workouts = [
        createMockWorkout("2026-05-15", [
            createMockExercise("Squat", [
                createMockSet({ reps: 8, weight: 100 }) // in the middle (8 reps)
            ])
        ])
    ];

    const suggestion = getProgressionSuggestion("Squat", workouts, "2026-05-16", DEFAULT_CONFIG);
    assert(suggestion !== null);
    // Should suggest same/next weight and reps increment
    assertEquals(suggestion.suggestedWeight, 102.5);
    assertEquals(suggestion.suggestedReps, 9);
});

Deno.test("progressiveOverload - getProgressionSuggestion - isolation exercise", () => {
    // Bicep curl is isolation (slow progression)
    const workouts = [
        createMockWorkout("2026-05-15", [
            createMockExercise("Bicep Curl", [
                createMockSet({ reps: 10, weight: 20 })
            ])
        ])
    ];

    const config = { ...DEFAULT_CONFIG, isolationMultiplier: 0.5 };
    const suggestion = getProgressionSuggestion("Bicep Curl", workouts, "2026-05-16", config);
    assert(suggestion !== null);
    assertEquals(suggestion.isCompound, false);
    // Base increment for 20kg is 2.5kg.
    // Isolation multiplier makes it 1.25kg.
    assertEquals(suggestion.suggestedWeight, 21.25);
    assertEquals(suggestion.suggestedReps, 11);
});

Deno.test("progressiveOverload - getProgressionSuggestion - distance based exercise", () => {
    // Rowing is distance based
    const workouts = [
        createMockWorkout("2026-05-15", [
            createMockExercise("Rowing", [
                createMockSet({ reps: 1, weight: 0, distance: 1000 })
            ])
        ])
    ];

    const suggestion = getProgressionSuggestion("Rowing", workouts, "2026-05-16", DEFAULT_CONFIG);
    assert(suggestion !== null);
    assertEquals(suggestion.isDistanceBased, true);
    // 1000m * 1.025 = 1025m. Rounded to nearest 50m since > 1000m is 1050m.
    assertEquals(suggestion.suggestedDistance, 1050);
});

Deno.test("progressiveOverload - getProgressionSuggestion - plateaued exercise", () => {
    // Create 4 workouts without any weight or reps progression
    const workouts = [
        createMockWorkout("2026-05-18", [createMockExercise("Bench Press", [createMockSet({ reps: 5, weight: 80 })])]),
        createMockWorkout("2026-05-15", [createMockExercise("Bench Press", [createMockSet({ reps: 5, weight: 80 })])]),
        createMockWorkout("2026-05-12", [createMockExercise("Bench Press", [createMockSet({ reps: 5, weight: 80 })])]),
        createMockWorkout("2026-05-09", [createMockExercise("Bench Press", [createMockSet({ reps: 5, weight: 80 })])])
    ];

    const suggestion = getProgressionSuggestion("Bench Press", workouts, "2026-05-19", DEFAULT_CONFIG);
    assert(suggestion !== null);
    assertEquals(suggestion.isPlateaued, true);
    assertEquals(suggestion.sessionsSinceProgress, 3);
    assert(suggestion.plateauMessage !== undefined);
});

// ============================================
// getExerciseHistory & getExerciseHistoryWithRM Tests
// ============================================

Deno.test("progressiveOverload - getExerciseHistory", () => {
    const workouts = [
        createMockWorkout("2026-05-18", [createMockExercise("Deadlift", [createMockSet({ reps: 5, weight: 140 })])]),
        createMockWorkout("2026-05-15", [createMockExercise("Deadlift", [createMockSet({ reps: 5, weight: 130 })])])
    ];

    const history = getExerciseHistory("Deadlift", workouts);
    assertEquals(history.length, 2);
    assertEquals(history[0].date, "2026-05-18");
    assertEquals(history[0].weight, 140);
    assertEquals(history[1].weight, 130);
});

// ============================================
// getPlateauWarnings Tests
// ============================================

Deno.test("progressiveOverload - getPlateauWarnings - no plateau", () => {
    // Only 2 sessions, won't trigger (needs minSessions = 3, default)
    const workouts = [
        createMockWorkout("2026-05-18", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 100 })])]),
        createMockWorkout("2026-05-15", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 95 })])])
    ];

    const warnings = getPlateauWarnings(workouts, 3);
    assertEquals(warnings.length, 0);
});

Deno.test("progressiveOverload - getPlateauWarnings - triggers plateau and deload severity", () => {
    // 5 sessions with stagnant/declining performance
    const workouts = [
        createMockWorkout("2026-05-20", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 100 })])]),
        createMockWorkout("2026-05-17", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 100 })])]),
        createMockWorkout("2026-05-14", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 100 })])]),
        createMockWorkout("2026-05-11", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 100 })])]),
        createMockWorkout("2026-05-08", [createMockExercise("Squat", [createMockSet({ reps: 5, weight: 100 })])])
    ];

    const config = {
        ...DEFAULT_CONFIG,
        plateauSessionThreshold: 3,
        deloadThreshold: 4,
        changeExerciseThreshold: 6
    };

    const warnings = getPlateauWarnings(workouts, 3, config);
    assertEquals(warnings.length, 1);
    assertEquals(warnings[0].exerciseName, "Squat");
    assertEquals(warnings[0].weeksSinceProgress, 4); // 4 stagnant transitions
    assertEquals(warnings[0].severity, "medium"); // Since sessionsSinceProgress = 4 (>= deloadThreshold)
    assertEquals(warnings[0].recommendation, "deload");
    assert(warnings[0].actionItems.includes("Sänk vikten med 20-30% i en vecka"));
});

// ============================================
// getWeeklyVolumeRecommendations Tests
// ============================================

Deno.test("progressiveOverload - getWeeklyVolumeRecommendations - maintains, increases and decreases", () => {
    // 8 workouts representing weekly volume.
    // Weekly volume drops in last two weeks
    const workouts: StrengthWorkout[] = [];
    
    // Recent 2 weeks (weeks 1 and 2): low volume
    // 2 workouts with Squat: 10 reps @ 50kg = 500 volume total
    workouts.push(createMockWorkout("2026-05-20", [createMockExercise("Squat", [createMockSet({ reps: 10, weight: 50 })])]));
    workouts.push(createMockWorkout("2026-05-13", [createMockExercise("Squat", [createMockSet({ reps: 10, weight: 50 })])]));

    // Baseline weeks (weeks 3, 4, 5, 6): high volume (1500 volume per week)
    // 4 workouts with Squat: 10 reps @ 150kg = 1500 volume total per workout
    workouts.push(createMockWorkout("2026-05-06", [createMockExercise("Squat", [createMockSet({ reps: 10, weight: 150 })])]));
    workouts.push(createMockWorkout("2026-04-29", [createMockExercise("Squat", [createMockSet({ reps: 10, weight: 150 })])]));
    workouts.push(createMockWorkout("2026-04-22", [createMockExercise("Squat", [createMockSet({ reps: 10, weight: 150 })])]));
    workouts.push(createMockWorkout("2026-04-15", [createMockExercise("Squat", [createMockSet({ reps: 10, weight: 150 })])]));

    const recs = getWeeklyVolumeRecommendations(workouts, 8);
    assert(recs.length > 0);
    const squatRec = recs.find(r => r.exerciseName === "Squat");
    assert(squatRec !== undefined);
    // Recent volume: 1000 total / 2 weeks = 500 weekly average
    // Baseline volume: 6000 total / 6 baseline weeks (8-2) = 1000 weekly average
    // Change: (500 - 1000) / 1000 = -50% (which is < -30%)
    assertEquals(squatRec.recommendation, "increase");
    assertEquals(squatRec.targetVolume, 1000);
});

// ============================================
// getUnderperformers Tests
// ============================================

Deno.test("progressiveOverload - getUnderperformers", () => {
    // 25 sets of squat (needs minSets = 20, default)
    const exerciseSets: StrengthSet[] = [];
    for (let i = 0; i < 25; i++) {
        exerciseSets.push(createMockSet({ setNumber: i + 1, reps: 5, weight: 100 }));
    }

    const workouts = [
        createMockWorkout("2026-05-20", [createMockExercise("Squat", exerciseSets)])
    ];

    // PB was set on 2026-01-01 (long time ago)
    const personalBests = [
        {
            id: "pb-1",
            exerciseName: "Squat",
            date: "2026-01-01",
            value: 100,
            workoutId: "wk-old",
            type: "1rm"
        }
    ];

    // Since minSets = 20, our 25 sets squat triggers getUnderperformers.
    // Sets since last PB = 25 (all performed after 2026-01-01)
    const stagnation = getUnderperformers(workouts, personalBests, 20);
    assertEquals(stagnation.length, 1);
    assertEquals(stagnation[0].exerciseName, "Squat");
    assertEquals(stagnation[0].setsSinceLastPB, 25);
    assert(stagnation[0].stagnationScore > 0);
});
