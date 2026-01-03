
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { calculateStreaks } from "../src/api/repositories/strengthRepository.ts";
import { StrengthWorkout } from "../src/models/strengthTypes.ts";

// Helper to create a minimal workout
function createWorkout(date: string): StrengthWorkout {
    return {
        id: "test",
        userId: "user",
        date: date,
        name: "test",
        exercises: [],
        totalVolume: 0,
        totalSets: 0,
        totalReps: 0,
        uniqueExercises: 0,
        source: "manual",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

Deno.test("Streak Calculation: No workouts", () => {
    const workouts: StrengthWorkout[] = [];
    const stats = calculateStreaks(workouts);
    assertEquals(stats.currentStreak, 0);
    assertEquals(stats.longestStreak, 0);
});

Deno.test("Streak Calculation: Single workout this week", () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const workouts = [createWorkout(dateStr)];

    const stats = calculateStreaks(workouts);
    assertEquals(stats.currentStreak, 1);
    assertEquals(stats.longestStreak, 1);
});

Deno.test("Streak Calculation: 3 consecutive weeks (including this week)", () => {
    // Current week
    const d1 = new Date();
    // Last week
    const d2 = new Date(); d2.setDate(d1.getDate() - 7);
    // 2 weeks ago
    const d3 = new Date(); d3.setDate(d1.getDate() - 14);

    const workouts = [
        createWorkout(d1.toISOString().split('T')[0]),
        createWorkout(d2.toISOString().split('T')[0]),
        createWorkout(d3.toISOString().split('T')[0])
    ];

    const stats = calculateStreaks(workouts);
    assertEquals(stats.currentStreak, 3);
    assertEquals(stats.longestStreak, 3);
});

Deno.test("Streak Calculation: Broken streak (gap > 1 week)", () => {
    // Current week
    const d1 = new Date();
    // 3 weeks ago (skip 1 week)
    const d2 = new Date(); d2.setDate(d1.getDate() - 21);

    const workouts = [
        createWorkout(d1.toISOString().split('T')[0]),
        createWorkout(d2.toISOString().split('T')[0])
    ];

    const stats = calculateStreaks(workouts);
    assertEquals(stats.currentStreak, 1); // Only the current one counts
    // Longest might be 1 if only 1 consecutive exists at any point
    assertEquals(stats.longestStreak, 1);
});

Deno.test("Streak Calculation: Longest streak in past", () => {
    // 5 consecutive weeks long ago
    const start = new Date("2023-01-01"); // Sunday
    const workouts = [];
    for(let i=0; i<5; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + (i*7));
        workouts.push(createWorkout(d.toISOString().split('T')[0]));
    }

    // Gap
    // One workout today
    workouts.push(createWorkout(new Date().toISOString().split('T')[0]));

    const stats = calculateStreaks(workouts);
    assertEquals(stats.currentStreak, 1);
    assertEquals(stats.longestStreak, 5);
});
