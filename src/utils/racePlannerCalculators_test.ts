
import {
    calculateWeatherPenaltyFactor,
    estimateKcalBurnRate,
    getCarbRatio,
    generateSplits,
    simulateRace,
    calculateDropbagLogistics
} from "./racePlannerCalculators.ts";
import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("Race Planner - Weather Penalty", () => {
    // 15C, 50% humidity -> No penalty
    assertEquals(calculateWeatherPenaltyFactor(15, 50), 1.0);
    assertEquals(calculateWeatherPenaltyFactor(10, 50), 1.0);

    // 25C, 50% Humidity
    // Excess = 10. Correction = 0.8 + 0.2 = 1.0. Penalty = 10 * 0.015 * 1.0 = 0.15 (15%)
    // My formula: 0.8 + 0.4 * (50/100) = 1.0.
    // Wait, correction logic: 0.8 + (0.4 * 0.5) = 1.0.
    // Factor = 1 + (10 * 0.015 * 1.0) = 1.15.
    assertAlmostEquals(calculateWeatherPenaltyFactor(25, 50), 1.15);

    // 25C, 100% Humidity
    // Correction = 0.8 + 0.4 = 1.2.
    // Penalty = 10 * 0.015 * 1.2 = 0.18 (18%)
    assertAlmostEquals(calculateWeatherPenaltyFactor(25, 100), 1.18);
});

Deno.test("Race Planner - Burn Rate", () => {
    // 70kg, 10kph
    // 700 kcal/h -> 11.66 kcal/min
    assertAlmostEquals(estimateKcalBurnRate(70, 10), 11.66, 0.1);
});

Deno.test("Race Planner - Carb Ratio", () => {
    // Low intensity
    assertEquals(getCarbRatio(0.4), 0.2);
    // Max intensity
    assertEquals(getCarbRatio(1.1), 1.0);
    // 85% intensity
    // 1.6*0.85 - 0.6 = 1.36 - 0.6 = 0.76
    assertAlmostEquals(getCarbRatio(0.85), 0.76, 0.01);
});

Deno.test("Race Planner - Splits", () => {
    // 10km in 60 mins (6 min/km or 360s/km)
    const splits = generateSplits(10, 3600, 'stable');
    assertEquals(splits.length, 10);
    assertEquals(splits[0].timeSeconds, 360);
    assertEquals(splits[9].cumulativeSeconds, 3600);

    // Negative split
    const splitsNeg = generateSplits(10, 3600, 'negative');
    // First km should be slower (> 360)
    // Last km should be faster (< 360)
    if (splitsNeg[0].timeSeconds <= 360) throw new Error("First split should be slower");
    if (splitsNeg[9].timeSeconds >= 360) throw new Error("Last split should be faster");
});

Deno.test("Race Planner - Simulation", () => {
    const profile = {
        distanceKm: 42.2,
        targetTimeSeconds: 4 * 3600, // 4 hours
        date: "2024-01-01",
        startTime: "09:00"
    };
    const runner = {
        weightKg: 75,
        maxHr: 190,
        restingHr: 50,
        sweatRateLh: 1.0,
        caffeineToleranceMg: 300
    };

    // Run without intake
    const res = simulateRace(profile, runner, [], 500); // 500g start
    // 4 hours running. 75kg.
    // Speed = 10.55 kph.
    // Burn ~ 75 * 10.55 = 791 kcal/h.
    // Total burn ~ 3165 kcal.
    // Intensity ~ 85% (from code logic for 42k). Carb Ratio ~ 0.76.
    // Carb burn ~ 3165 * 0.76 / 4 = 601g.
    // Start 500g. Deficit -101g. Should crash.
    assertEquals(res.crashTime !== null, true);

    // Run with heavy intake
    const intake = [
        {
            distanceKm: 0,
            type: 'gel' as const,
            amount: 1,
            product: { name: "Gel", carbsG: 30, caffeineMg: 0, sodiumMg: 0, liquidMl: 0, isDrink: false }
        }
    ];
    // Add 10 gels (300g)
    for(let i=1; i<=10; i++) {
        intake.push({
            distanceKm: i * 4,
            type: 'gel' as const,
            amount: 1,
            product: { name: "Gel", carbsG: 30, caffeineMg: 0, sodiumMg: 0, liquidMl: 0, isDrink: false }
        });
    }

    const res2 = simulateRace(profile, runner, intake, 500);
    // Total carbs +330. Total avail 830. Burn 601. Should finish.
    assertEquals(res2.crashTime, null);
});

Deno.test("Race Planner - Dropbag", () => {
    const intake = [
        { distanceKm: 0, type: 'gel' as const, amount: 1, product: { name: "Gel", carbsG: 25, caffeineMg:0, sodiumMg:0, liquidMl:0, isDrink:false } },
        { distanceKm: 10, type: 'gel' as const, amount: 1, product: { name: "Gel", carbsG: 25, caffeineMg:0, sodiumMg:0, liquidMl:0, isDrink:false } },
        { distanceKm: 50, type: 'gel' as const, amount: 1, product: { name: "Gel", carbsG: 25, caffeineMg:0, sodiumMg:0, liquidMl:0, isDrink:false } }
    ];

    // Dropbag at 42km
    const logistics = calculateDropbagLogistics(intake, [42]);

    // Segment 1: Start (0) to 42. Contains KM 0 and KM 10. Total 2 Gels.
    // Segment 2: 42 to End. Contains KM 50. Total 1 Gel.

    assertEquals(logistics.length, 2);
    assertEquals(logistics[0].location, "Start (Carry)");
    assertEquals(logistics[0].items["Gel"], 2);
    assertEquals(logistics[1].location, "Dropbag KM 42");
    assertEquals(logistics[1].items["Gel"], 1);
});
