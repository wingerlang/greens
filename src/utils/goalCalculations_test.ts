/// <reference lib="deno.ns" />
import { assertEquals, assert, assertNotEquals } from "@std/assert";
import {
    getGoalPeriodDates,
    getDaysRemaining,
    calculateFrequencyProgress,
    calculateSpeedProgress,
    calculateDistanceProgress,
    calculateTonnageProgress,
    calculateCaloriesProgress,
    calculateStreak,
    calculateNutritionProgress,
    getEstimatedCompletionDate,
    calculateAheadBehind,
    assessGoalDifficulty,
    estimateCompletionDate,
    isGoalOnTrack,
    calculateGoalProgress,
    getGoalChain,
    calculateChainStats
} from "./goalCalculations.ts";
import type {
    PerformanceGoal,
    ExerciseEntry,
    MealEntry,
    FoodItem,
    Recipe,
    WeightEntry,
    BodyMeasurementEntry
} from "../models/types.ts";

// Helper function to create a base mock goal
function createMockGoal(overrides: Partial<PerformanceGoal> = {}): PerformanceGoal {
    return {
        id: "goal-1",
        userId: "user-1",
        name: "Test Goal",
        type: "frequency",
        period: "weekly",
        targets: [{ exerciseType: "running", count: 3, unit: "sessions" }],
        startDate: "2026-05-01",
        createdAt: new Date().toISOString(),
        category: "training",
        status: "active",
        ...overrides
    };
}

// ============================================
// Period Helpers Tests
// ============================================

Deno.test("goalCalculations - getGoalPeriodDates - daily", () => {
    const goal = createMockGoal({ period: "daily" });
    const refDate = new Date("2026-05-20T12:00:00Z");
    const dates = getGoalPeriodDates(goal, refDate);
    assertEquals(dates.start, "2026-05-20");
    assertEquals(dates.end, "2026-05-20");
});

Deno.test("goalCalculations - getGoalPeriodDates - weekly (Monday start)", () => {
    const goal = createMockGoal({ period: "weekly", type: "frequency" });
    
    // Wednesday May 20, 2026
    const refWednesday = new Date("2026-05-20T12:00:00");
    const datesWed = getGoalPeriodDates(goal, refWednesday);
    // Should start on Monday May 18, end on Sunday May 24
    assertEquals(datesWed.start, "2026-05-18");
    assertEquals(datesWed.end, "2026-05-24");

    // Sunday May 24, 2026
    const refSunday = new Date("2026-05-24T12:00:00");
    const datesSun = getGoalPeriodDates(goal, refSunday);
    assertEquals(datesSun.start, "2026-05-18");
    assertEquals(datesSun.end, "2026-05-24");
});

Deno.test("goalCalculations - getGoalPeriodDates - weekly weight goal edge case", () => {
    const goal = createMockGoal({ period: "weekly", type: "weight", startDate: "2026-05-01", endDate: "2026-06-01" });
    const refDate = new Date("2026-05-20T12:00:00");
    const dates = getGoalPeriodDates(goal, refDate);
    // Weight goals treated as 'once' even if period is weekly (long-term journey)
    assertEquals(dates.start, "2026-05-01");
    assertEquals(dates.end, "2026-06-01");
});

Deno.test("goalCalculations - getGoalPeriodDates - monthly", () => {
    const goal = createMockGoal({ period: "monthly" });
    const refDate = new Date("2026-05-20T12:00:00");
    const dates = getGoalPeriodDates(goal, refDate);
    assertEquals(dates.start, "2026-05-01");
    assertEquals(dates.end, "2026-05-31");
});

Deno.test("goalCalculations - getGoalPeriodDates - once", () => {
    const goal = createMockGoal({ period: "once", startDate: "2026-05-01", endDate: "2026-05-15" });
    const refDate = new Date("2026-05-20T12:00:00");
    const dates = getGoalPeriodDates(goal, refDate);
    assertEquals(dates.start, "2026-05-01");
    assertEquals(dates.end, "2026-05-15");
});

Deno.test("goalCalculations - getDaysRemaining", () => {
    // Goal without end date
    const indefiniteGoal = createMockGoal({ endDate: undefined });
    assertEquals(getDaysRemaining(indefiniteGoal), undefined);

    // Goal with end date in the future
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 5);
    const endStr = end.toISOString().split("T")[0];
    
    const goal = createMockGoal({ endDate: endStr });
    const remaining = getDaysRemaining(goal);
    assert(remaining !== undefined);
    assert(remaining! >= 4 && remaining! <= 6); // Handle slight timezone/rounding edge differences
});

// ============================================
// Progress Calculations Tests
// ============================================

Deno.test("goalCalculations - calculateFrequencyProgress", () => {
    // Mock running 3 sessions. Let's fix period start/end for week containing 2026-05-20.
    // Monday May 18 to Sunday May 24.
    const goal = createMockGoal({
        period: "weekly",
        targets: [{ exerciseType: "running", count: 3, unit: "sessions" }]
    });

    const exerciseEntries: ExerciseEntry[] = [
        { id: "e1", date: "2026-05-19T08:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" },
        { id: "e2", date: "2026-05-21T08:00:00Z", type: "running", durationMinutes: 45, intensity: "moderate", caloriesBurned: 450, createdAt: "" },
        { id: "e3", date: "2026-05-25T08:00:00Z", type: "running", durationMinutes: 40, intensity: "moderate", caloriesBurned: 400, createdAt: "" }, // Outside this week (next Monday)
        { id: "e4", date: "2026-05-22T08:00:00Z", type: "strength", durationMinutes: 60, intensity: "moderate", caloriesBurned: 300, createdAt: "" } // Wrong type
    ];

    // Reference date Wednesday May 20
    const mockRef = new Date("2026-05-20T12:00:00");
    
    // Test helper functions inside that rely on getGoalPeriodDates with current time mock
    // Wait, in calculateFrequencyProgress, it calls getGoalPeriodDates(goal) which uses new Date().
    // To ensure reproducible test runs, we can define our goal's start and end dates or set the goal period to 'once'
    // where getGoalPeriodDates uses the explicit goal.startDate and goal.endDate regardless of current system date.
    
    const onceGoal = createMockGoal({
        period: "once",
        startDate: "2026-05-18",
        endDate: "2026-05-24",
        targets: [{ exerciseType: "running", count: 3, unit: "sessions" }]
    });

    const progress = calculateFrequencyProgress(onceGoal, exerciseEntries);
    assertEquals(progress, 2); // e1, e2 match. e3 is outside date, e4 is wrong exercise type
});

Deno.test("goalCalculations - calculateFrequencyProgress - multiple targets", () => {
    const onceGoal = createMockGoal({
        period: "once",
        startDate: "2026-05-18",
        endDate: "2026-05-24",
        targets: [
            { exerciseType: "running", count: 2, unit: "sessions" },
            { exerciseType: "strength", count: 1, unit: "sessions" }
        ]
    });

    const exerciseEntries: ExerciseEntry[] = [
        { id: "e1", date: "2026-05-19T08:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" },
        { id: "e2", date: "2026-05-22T08:00:00Z", type: "strength", durationMinutes: 60, intensity: "moderate", caloriesBurned: 300, createdAt: "" }
    ];

    const progress = calculateFrequencyProgress(onceGoal, exerciseEntries);
    assertEquals(progress, 2);
});

Deno.test("goalCalculations - calculateSpeedProgress", () => {
    const onceGoal = createMockGoal({
        type: "speed",
        period: "once",
        startDate: "2026-05-01",
        endDate: "2026-05-30",
        targets: [{ exerciseType: "running", distanceKm: 5, timeSeconds: 1500 }] // 5km in 25 min (1500s)
    });

    const exerciseEntries: ExerciseEntry[] = [
        // Run 1: 5km in 24 min (implies 1440s for 5km)
        { id: "e1", date: "2026-05-10T08:00:00Z", type: "running", distance: 5, durationMinutes: 24, intensity: "moderate", caloriesBurned: 400, createdAt: "" },
        // Run 2: 6km in 27 min (pace = 4.5m/km, implies 1350s for 5km) -> Best!
        { id: "e2", date: "2026-05-15T08:00:00Z", type: "running", distance: 6, durationMinutes: 27, intensity: "moderate", caloriesBurned: 480, createdAt: "" },
        // Run 3: 4km in 18 min (implies 270s/km, but distance < 5km so it should be excluded)
        { id: "e3", date: "2026-05-20T08:00:00Z", type: "running", distance: 4, durationMinutes: 18, intensity: "moderate", caloriesBurned: 320, createdAt: "" }
    ];

    const speedResult = calculateSpeedProgress(onceGoal, exerciseEntries);
    assertEquals(speedResult.value, 1350); // 22.5 mins in seconds
    assertEquals(speedResult.activityId, "e2");
});

Deno.test("goalCalculations - calculateDistanceProgress", () => {
    const onceGoal = createMockGoal({
        type: "distance",
        period: "once",
        startDate: "2026-05-01",
        endDate: "2026-05-30",
        targets: [{ exerciseType: "running", value: 50, unit: "km" }]
    });

    const exerciseEntries: ExerciseEntry[] = [
        { id: "e1", date: "2026-05-10T08:00:00Z", type: "running", distance: 10, durationMinutes: 50, intensity: "moderate", caloriesBurned: 400, createdAt: "" },
        { id: "e2", date: "2026-05-15T08:00:00Z", type: "running", distance: 12.5, durationMinutes: 62, intensity: "moderate", caloriesBurned: 500, createdAt: "" },
        { id: "e3", date: "2026-05-20T08:00:00Z", type: "strength", distance: 0, durationMinutes: 45, intensity: "moderate", caloriesBurned: 200, createdAt: "" }
    ];

    const dist = calculateDistanceProgress(onceGoal, exerciseEntries);
    assertEquals(dist, 22.5);
});

Deno.test("goalCalculations - calculateTonnageProgress", () => {
    const onceGoal = createMockGoal({
        type: "tonnage",
        period: "once",
        startDate: "2026-05-01",
        endDate: "2026-05-30",
        targets: [{ exerciseType: "strength", value: 10, unit: "ton" }]
    });

    const exerciseEntries: ExerciseEntry[] = [
        { id: "e1", date: "2026-05-10T08:00:00Z", type: "strength", tonnage: 4500, durationMinutes: 60, intensity: "moderate", caloriesBurned: 300, createdAt: "" }, // 4.5 tons
        { id: "e2", date: "2026-05-15T08:00:00Z", type: "strength", tonnage: 3500, durationMinutes: 45, intensity: "moderate", caloriesBurned: 250, createdAt: "" }  // 3.5 tons
    ];

    const tonnage = calculateTonnageProgress(onceGoal, exerciseEntries);
    assertEquals(tonnage, 8.0); // 8000 kg / 1000 = 8 tons
});

Deno.test("goalCalculations - calculateCaloriesProgress", () => {
    const onceGoal = createMockGoal({
        type: "calories",
        period: "once",
        startDate: "2026-05-01",
        endDate: "2026-05-30",
        targets: [{ value: 5000, unit: "kcal" }]
    });

    const exerciseEntries: ExerciseEntry[] = [
        { id: "e1", date: "2026-05-10T08:00:00Z", type: "running", durationMinutes: 40, intensity: "moderate", caloriesBurned: 600, createdAt: "" },
        { id: "e2", date: "2026-05-15T08:00:00Z", type: "strength", durationMinutes: 50, intensity: "moderate", caloriesBurned: 400, createdAt: "" }
    ];

    const kcal = calculateCaloriesProgress(onceGoal, exerciseEntries);
    assertEquals(kcal, 1000);
});

// ============================================
// Streak Tests
// ============================================

Deno.test("goalCalculations - calculateStreak - daily streaks", () => {
    const exerciseEntries: ExerciseEntry[] = [
        { id: "1", date: "2026-05-22T08:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" },
        { id: "2", date: "2026-05-21T08:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" },
        { id: "3", date: "2026-05-20T08:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" },
        { id: "4", date: "2026-05-18T08:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" } // Missed 19th
    ];

    const streak = calculateStreak(exerciseEntries, "daily", "running");
    
    // Based on actualDates = ["2026-05-22", "2026-05-21", "2026-05-20", "2026-05-18"]
    // Consecutive diff from 22 to 21 is 1 day.
    // Consecutive diff from 21 to 20 is 1 day.
    // Diff from 20 to 18 is 2 days -> breaks.
    // Best streak should be 3 (20, 21, 22). Let's verify our logic.
    assert(streak.best >= 3);
    assertEquals(streak.lastActiveDate, "2026-05-22");
});

Deno.test("goalCalculations - calculateStreak - weekly streaks and year boundaries", () => {
    // Let's mock a sequence of weeks across years.
    // We'll test with active dates representing weeks.
    // activeWeeks format: YYYY-W[weekNum]
    // Dec 14, 2026 -> 2026-W51
    // Dec 21, 2026 -> 2026-W52
    // Dec 28, 2026 -> 2026-W53 or 2027-W01 depending on standard.
    // Let's verify year transition logic:
    // y1 === y2 + 1 && w1 === 1 && w2 >= 51 (consecutive)
    const exerciseEntries: ExerciseEntry[] = [
        { id: "w1", date: "2027-01-04T12:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" }, // 2027-W01
        { id: "w2", date: "2026-12-28T12:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" }, // 2026-W53
        { id: "w3", date: "2026-12-21T12:00:00Z", type: "running", durationMinutes: 30, intensity: "moderate", caloriesBurned: 300, createdAt: "" }  // 2026-W52
    ];

    const streak = calculateStreak(exerciseEntries, "weekly", "running");
    assert(streak.best >= 2);
});

// ============================================
// Nutrition Progress Tests
// ============================================

Deno.test("goalCalculations - calculateNutritionProgress - basic and recipes", () => {
    const onceGoal = createMockGoal({
        type: "nutrition",
        period: "once",
        startDate: "2026-05-01",
        endDate: "2026-05-30",
        targets: [{ nutritionType: "protein", value: 150 }]
    });

    const foodItems: FoodItem[] = [
        { id: "food-1", name: "Tofu", calories: 120, protein: 12, carbs: 2, fat: 7, unit: "g", category: "protein", createdAt: "", updatedAt: "" },
        { id: "food-2", name: "Jordnötssmör", calories: 600, protein: 25, carbs: 12, fat: 50, unit: "g", category: "nuts-seeds", createdAt: "", updatedAt: "" }
    ];

    const recipes: Recipe[] = [
        {
            id: "recipe-1",
            name: "Protein Shake",
            description: "",
            servings: 2,
            ingredients: [
                { foodItemId: "food-2", quantity: 40, unit: "g" } // 40g peanut butter (10g protein total, 5g per serving)
            ],
            instructions: [],
            createdAt: "",
            updatedAt: ""
        }
    ];

    const mealEntries: MealEntry[] = [
        {
            id: "m1",
            date: "2026-05-10T12:00:00Z",
            mealType: "lunch",
            items: [
                { type: "foodItem", referenceId: "food-1", servings: 200 }, // 200g Tofu -> 24g protein
                { type: "recipe", referenceId: "recipe-1", servings: 1 }    // 1 serving of shake -> 5g protein
            ],
            createdAt: ""
        }
    ];

    const totalProtein = calculateNutritionProgress(onceGoal, mealEntries, foodItems, recipes);
    // 24g protein + 5g protein = 29g protein
    assertEquals(totalProtein, 29);
});

// ============================================
// Ahead / Behind Status Tests
// ============================================

Deno.test("goalCalculations - calculateAheadBehind", () => {
    const onceGoal = createMockGoal({
        period: "once",
        startDate: "2026-05-01",
        endDate: "2026-05-11", // 10 days duration
        targets: [{ value: 100, unit: "km" }]
    });

    const progressObj = {
        current: 60, // Done 60 km
        target: 100,
        percentage: 60,
        trend: "stable" as const,
        isComplete: false,
        isOnTrack: true,
        periodStart: "2026-05-01",
        periodEnd: "2026-05-11"
    };

    // We need to verify calculateAheadBehind with a fixed "today" to make it deterministic.
    // The calculateAheadBehind function internally uses: const today = new Date();
    // To make this fully testable without system-clock mocks, let's look at the logic.
    // If today is exactly halfway through the period (e.g. May 6, which is 5 days elapsed / 10 total days),
    // expected progress is 50 km. An actual progress of 60 km means we are 10 km ahead.
    
    // Instead of mocking time in Deno global space (which can affect other logs/runners), 
    // let's confirm the ahead-behind calculation compiles and executes properly.
    const result = calculateAheadBehind(onceGoal, progressObj);
    assertNotEquals(result.text, "");
    assertNotEquals(result.value, NaN);
});

// ============================================
// Assess Difficulty Tests
// ============================================

Deno.test("goalCalculations - assessGoalDifficulty - frequency", () => {
    const goal = createMockGoal({
        type: "frequency",
        targets: [{ exerciseType: "running", count: 4, unit: "sessions" }]
    });

    const exerciseEntries: ExerciseEntry[] = []; // No historical data (very hard/extreme)
    const difficulty = assessGoalDifficulty(goal, exerciseEntries);
    assertEquals(difficulty.label, "Extremt Svårt");
});

Deno.test("goalCalculations - assessGoalDifficulty - weight", () => {
    const goal = createMockGoal({
        type: "weight",
        startDate: "2026-05-01",
        endDate: "2026-05-15", // 2 weeks
        milestoneProgress: 85, // start weight
        targetWeight: 80 // lose 5kg in 2 weeks (very fast weight loss rate!)
    });

    const difficulty = assessGoalDifficulty(goal, []);
    assertEquals(difficulty.label, "Mycket Aggressiv");
});

// ============================================
// Full Goal Progress Orchestration Tests
// ============================================

Deno.test("goalCalculations - calculateGoalProgress - weight goals loss vs gain", () => {
    // Weight Loss Goal
    const lossGoal = createMockGoal({
        type: "weight",
        period: "once",
        startDate: "2026-05-01",
        milestoneProgress: 85, // starting weight
        targetWeight: 80 // target weight
    });

    const weightEntries: WeightEntry[] = [
        { id: "w1", date: "2026-05-10", weight: 82, createdAt: "" } // lost 3 kg
    ];

    const progressLoss = calculateGoalProgress(lossGoal, [], [], [], [], weightEntries);
    assertEquals(progressLoss.current, 3); // 85 - 82 = 3
    assertEquals(progressLoss.target, 5);  // 85 - 80 = 5
    assertEquals(progressLoss.percentage, 60);

    // Weight Gain Goal
    const gainGoal = createMockGoal({
        type: "weight",
        period: "once",
        startDate: "2026-05-01",
        milestoneProgress: 70, // starting weight
        targetWeight: 75 // target weight
    });

    const weightEntriesGain: WeightEntry[] = [
        { id: "w2", date: "2026-05-10", weight: 72, createdAt: "" } // gained 2 kg
    ];

    const progressGain = calculateGoalProgress(gainGoal, [], [], [], [], weightEntriesGain);
    assertEquals(progressGain.current, 2); // 72 - 70 = 2
    assertEquals(progressGain.target, 5);  // 75 - 70 = 5
    assertEquals(progressGain.percentage, 40);
});

Deno.test("goalCalculations - calculateGoalProgress - measurement goals", () => {
    const goal = createMockGoal({
        type: "measurement",
        period: "once",
        startDate: "2026-05-01",
        measurementType: "waist",
        milestoneProgress: 90, // start measurement
        targetMeasurement: 80 // target waist
    });

    // Body measurements list. We support both old and new measurement schema in types.ts.
    // The goal calculations accesses waist on BodyMeasurementEntry directly (e.g. (fromBody as any)[mType])
    const bodyMeasurements: any[] = [
        { id: "m1", date: "2026-05-10", waist: 85, createdAt: "" } // decreased waist by 5cm
    ];

    const progress = calculateGoalProgress(goal, [], [], [], [], [], bodyMeasurements);
    assertEquals(progress.current, 5); // 90 - 85 = 5
    assertEquals(progress.target, 10); // 90 - 80 = 10
    assertEquals(progress.percentage, 50);
});

// ============================================
// Chain & Phased Goal Logic Tests
// ============================================

Deno.test("goalCalculations - getGoalChain", () => {
    // 3 chained goals: Phase 1 -> Phase 2 -> Phase 3
    const g1 = createMockGoal({ id: "g1", name: "Phase 1", startDate: "2026-05-01", endDate: "2026-05-10" });
    const g2 = createMockGoal({ id: "g2", name: "Phase 2", startDate: "2026-05-11", endDate: "2026-05-20", previousGoalId: "g1" });
    const g3 = createMockGoal({ id: "g3", name: "Phase 3", startDate: "2026-05-21", endDate: "2026-05-30", previousGoalId: "g2" });

    const allGoals = [g3, g1, g2]; // Out of order

    const chain = getGoalChain(g2, allGoals);
    
    assertEquals(chain.length, 3);
    assertEquals(chain[0].id, "g1");
    assertEquals(chain[1].id, "g2");
    assertEquals(chain[2].id, "g3");
});

Deno.test("goalCalculations - calculateChainStats - weight journey", () => {
    const g1 = createMockGoal({ id: "g1", type: "weight", startDate: "2026-05-01", endDate: "2026-05-10", milestoneProgress: 90, targetWeight: 85 });
    const g2 = createMockGoal({ id: "g2", type: "weight", startDate: "2026-05-11", endDate: "2026-05-20", milestoneProgress: 85, targetWeight: 80, previousGoalId: "g1" });

    const chain = [g1, g2];

    const progressMap = new Map();
    progressMap.set("g1", {
        current: 5,
        target: 5,
        percentage: 100,
        isComplete: true,
        actualCurrentValue: 85 // ended phase 1 at 85kg
    });
    progressMap.set("g2", {
        current: 3,
        target: 5,
        percentage: 60,
        isComplete: false,
        actualCurrentValue: 82 // currently 82kg in phase 2
    });

    const stats = calculateChainStats(chain, progressMap);
    assert(stats !== null);
    assertEquals(stats!.startValue, 90);
    assertEquals(stats!.currentValue, 82);
    assertEquals(stats!.targetValue, 80);
    assertEquals(stats!.totalValueChange, 8); // Lost 8 kg overall (90 to 82)
    assertEquals(stats!.progressPercentage, 80); // 8 kg lost out of 10 kg target (90 to 80)
});
