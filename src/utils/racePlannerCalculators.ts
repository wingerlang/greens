
/**
 * Race Planner Calculators
 * Logic for Glycogen Modeling, Weather Adjustments, and Pacing.
 */

// --- Types ---

export interface RaceProfile {
    distanceKm: number;
    targetTimeSeconds: number; // A-Goal
    date: string;
    startTime: string; // HH:MM
}

export interface RunnerProfile {
    weightKg: number;
    maxHr: number;
    restingHr: number;
    sweatRateLh: number; // Liters per hour
    caffeineToleranceMg: number;
}

export interface Environment {
    temperatureC: number;
    humidityPercent: number;
    sunsetTime?: string; // HH:MM
}

export interface NutritionProduct {
    name: string;
    carbsG: number;
    caffeineMg: number;
    sodiumMg: number;
    liquidMl: number;
    isDrink: boolean; // if true, counts towards fluid intake
}

export interface IntakeEvent {
    distanceKm: number;
    type: 'gel' | 'drink' | 'solid' | 'caffeine' | 'salt';
    amount: number; // count (e.g., 1 gel)
    product?: NutritionProduct;
}

export interface PacingStrategy {
    type: 'stable' | 'negative_split' | 'positive_split' | 'variable';
    description: string;
}

// --- Weather Adjustment ---

/**
 * Calculates a performance penalty based on heat and humidity.
 * Based on research indicating ~1% slowdown per 1°C above ~15°C (wet bulb adjusted).
 * Simplified model:
 * - Base ideal: 10-15°C.
 * - For every degree > 15, add 0.5% to 1.5% time depending on humidity.
 */
export function calculateWeatherPenaltyFactor(tempC: number, humidity: number): number {
    if (tempC <= 15) return 1.0; // No penalty

    const excessTemp = tempC - 15;
    // Humidity factor: 0.5 (low) to 1.5 (high)
    // If humidity is 50%, factor is 1.0. If 100%, 1.5. If 0%, 0.5.
    const humidityFactor = 0.5 + (humidity / 100);

    // Percentage loss per degree excess
    // Commonly cited: 1.5% to 3% slowing for significant heat
    // Let's use a conservative 0.5% - 1.0% per degree range adjusted by humidity
    // "Runners slow by 1.5% for every 10F (5.5C) above 60F (15C)" -> ~0.27% per degree C (Generic)
    // "Elites slow 1 sec/km per degree C above 15" -> ~0.3-0.5%
    // Our user requirement: "1.5% time per degree over 15" (This is aggressive but requested as heuristic)
    // We will scale this 1.5% request by humidity.
    // If 100% humidity: 1.5%. If 50% humidity: 1.0%.

    // Let's stick closer to the User Request but dampen it slightly for low humidity?
    // User said: "t.ex. +1.5% tid per grad över 15°C"

    const penaltyPerDegree = 0.015 * (0.5 + (humidity / 200)); // 0.5 to 1.0 multiplier

    // Actually, user explicitly asked for 1.5%. Let's prioritize that but allow humidity to make it worse/better.
    // Let's assume 1.5% is at "standard" humidity (~60%).

    // Revised logic:
    // Base penalty: 1.0% per degree.
    // Humidity penalty: Add 0.01% per percentage point of humidity if temp > 20?

    // Let's implement the specific request: 1.5% per degree > 15°C.
    // We will modulate it slightly by humidity:
    // Factor = 1 + (Excess * 0.015 * (HumidityCorrection))

    const humidityCorrection = 0.8 + (0.4 * (humidity / 100)); // 0.8 (dry) to 1.2 (wet)
    const totalPenaltyPct = excessTemp * 0.015 * humidityCorrection;

    return 1 + totalPenaltyPct;
}

// --- Glycogen Modeling ---

/**
 * Estimates energy expenditure (kcal/min) based on weight and speed.
 * Formula: ~1 kcal/kg/km.
 */
export function estimateKcalBurnRate(weightKg: number, speedKph: number): number {
    // 1 kcal per kg per km
    // kcal/hour = weight * speed
    // kcal/min = (weight * speed) / 60
    return (weightKg * speedKph) / 60;
}

/**
 * Estimates Carbohydrate vs Fat oxidation ratio (RER) based on intensity.
 * Intensity % of VDOT or Max HR.
 * Simplified linear model:
 * 50% Intensity -> 20% Carbs, 80% Fat (RER 0.80 ish)
 * 70% Intensity -> 50% Carbs, 50% Fat
 * 85% Intensity -> 85% Carbs, 15% Fat
 * 100% Intensity -> 100% Carbs (RER 1.0)
 *
 * Returns ratio of energy from carbs (0.0 - 1.0)
 */
export function getCarbRatio(intensityPct: number): number {
    // Sigmoidal or Exponential curve is better, but linear-ish segments work
    if (intensityPct < 0.5) return 0.2;
    if (intensityPct >= 1.0) return 1.0;

    // Interpolate between 0.5 (20%) and 1.0 (100%)
    // Linear fit: y = mx + c
    // (0.5, 0.2), (1.0, 1.0)
    // m = 0.8 / 0.5 = 1.6
    // y - 0.2 = 1.6(x - 0.5) => y = 1.6x - 0.8 + 0.2 => 1.6x - 0.6

    const ratio = (1.6 * intensityPct) - 0.6;
    return Math.max(0.1, Math.min(1.0, ratio));
}

export interface GlycogenState {
    timeSeconds: number;
    distanceKm: number;
    glycogenStoreG: number; // Current store
    bloodGlucoseG: number; // Available immediate
    pace: number; // min/km
    isBonking: boolean;
}

/**
 * Simulates the race and glycogen levels.
 */
export function simulateRace(
    profile: RaceProfile,
    runner: RunnerProfile,
    intakeEvents: IntakeEvent[],
    initialGlycogen: number = 500,
    weatherPenalty: number = 1.0
): { timeline: GlycogenState[], crashTime: number | null, finishTime: number } {

    const timeStepMinutes = 5; // Simulation resolution
    const targetPaceMinKm = (profile.targetTimeSeconds / 60) / profile.distanceKm;
    const adjustedPaceMinKm = targetPaceMinKm * weatherPenalty;
    const speedKph = 60 / adjustedPaceMinKm;

    // Est. Intensity (Very rough)
    // Assume A-goal is around Threshold or High-Aerobic.
    // We can guess intensity based on distance.
    // 5k: 100%, 10k: 95%, 21k: 90%, 42k: 85%, 100k: 70%.
    let intensity = 0.85;
    if (profile.distanceKm < 10) intensity = 0.98;
    else if (profile.distanceKm < 22) intensity = 0.92;
    else if (profile.distanceKm < 45) intensity = 0.85;
    else intensity = 0.70; // Ultra

    const kcalPerMinute = estimateKcalBurnRate(runner.weightKg, speedKph);
    const carbRatio = getCarbRatio(intensity);
    const carbBurnPerMinuteG = (kcalPerMinute * carbRatio) / 4; // 4 kcal per gram of carb

    let currentGlycogen = initialGlycogen;
    let currentTime = 0;
    let currentDist = 0;
    let crashTime: number | null = null;

    const timeline: GlycogenState[] = [];

    // Add start state
    timeline.push({
        timeSeconds: 0,
        distanceKm: 0,
        glycogenStoreG: currentGlycogen,
        bloodGlucoseG: 5, // Baseline
        pace: adjustedPaceMinKm,
        isBonking: false
    });

    const sortedEvents = [...intakeEvents].sort((a, b) => a.distanceKm - b.distanceKm);
    let eventIndex = 0;

    while (currentDist < profile.distanceKm) {
        // Step forward
        currentTime += timeStepMinutes;
        const distInc = (speedKph * timeStepMinutes) / 60;
        currentDist += distInc;

        // Burn
        // Bonk penalty? If glycogen < 0, pace drops drastically (e.g., +20%)
        let currentBurn = carbBurnPerMinuteG * timeStepMinutes;

        // Intake
        // Check if we passed any events in this step
        let intakeCarbs = 0;
        // Simple approximation: if we passed the event distance in this step
        while(eventIndex < sortedEvents.length && sortedEvents[eventIndex].distanceKm <= currentDist) {
            const evt = sortedEvents[eventIndex];
            if (evt.product) {
                intakeCarbs += evt.product.carbsG * evt.amount;
            } else {
                // Generic fallback if product not linked but amount implies carbs?
                // Assume amount is grams for generic? No, Type says 'amount' is count.
                // We'll rely on product being set or handling elsewhere.
                // For now, assume 0 if no product.
            }
            eventIndex++;
        }

        // Absorption Limit (e.g., 90g/h ~ 1.5g/min max)
        // We add intake to store directly for simplified "Body Battery" model,
        // but in reality gut absorption is the bottleneck.
        // Let's cap the effective addition to store to mimic absorption delay?
        // Or just assume simple bucket model for MVP.
        currentGlycogen += intakeCarbs;

        // Subtract Burn
        currentGlycogen -= currentBurn;

        // Check Bonk
        let isBonking = false;
        if (currentGlycogen <= 0) {
            if (crashTime === null) crashTime = currentTime * 60;
            currentGlycogen = 0; // Floor at 0
            isBonking = true;
            // Slow down simulation for next steps?
            // MVP: Just mark it.
        }

        timeline.push({
            timeSeconds: currentTime * 60,
            distanceKm: currentDist,
            glycogenStoreG: Math.round(currentGlycogen),
            bloodGlucoseG: 5,
            pace: adjustedPaceMinKm,
            isBonking
        });
    }

    return {
        timeline,
        crashTime,
        finishTime: timeline[timeline.length-1].timeSeconds
    };
}

// --- Pacing Strategy ---

export interface Split {
    km: number;
    timeSeconds: number;
    cumulativeSeconds: number;
    paceMinKm: string;
}

export function generateSplits(
    distanceKm: number,
    targetTimeSeconds: number,
    strategy: 'stable' | 'negative' | 'positive'
): Split[] {
    const splits: Split[] = [];
    const avgPace = targetTimeSeconds / distanceKm; // sec/km

    let cumulative = 0;

    for (let k = 1; k <= Math.ceil(distanceKm); k++) {
        let splitPace = avgPace;

        if (strategy === 'negative') {
            // Start 5% slower, end 5% faster
            const progress = k / distanceKm;
            const factor = 1.05 - (0.10 * progress); // 1.05 -> 0.95
            splitPace = avgPace * factor;
        } else if (strategy === 'positive') {
            // Start 5% faster, end 5% slower
            const progress = k / distanceKm;
            const factor = 0.95 + (0.10 * progress);
            splitPace = avgPace * factor;
        }

        // Adjust for last partial km
        const dist = (k > distanceKm) ? (distanceKm - (k-1)) : 1;
        const time = splitPace * dist;

        cumulative += time;

        // Format pace min/km
        const mins = Math.floor(splitPace / 60);
        const secs = Math.round(splitPace % 60);
        const paceStr = `${mins}:${secs.toString().padStart(2, '0')}`;

        splits.push({
            km: k > distanceKm ? distanceKm : k,
            timeSeconds: time,
            cumulativeSeconds: cumulative,
            paceMinKm: paceStr
        });
    }

    return splits;
}

// --- Dropbag Logic ---

export function calculateDropbagLogistics(
    intakeEvents: IntakeEvent[],
    dropbagKms: number[]
): { location: string, items: Record<string, number> }[] {

    // Sort Kms including 0 (Start) and Finish (implicit, but we care about segments)
    // Locations: "Start", "Dropbag KM X", "Dropbag KM Y"...

    const locations = [0, ...dropbagKms].sort((a,b) => a-b);
    const logistics = [];

    for (let i = 0; i < locations.length; i++) {
        const startKm = locations[i];
        const endKm = locations[i+1] || 9999; // 9999 represents finish/infinity

        // Filter events in this segment
        // Need to carry items for events occurring: startKm < event <= endKm
        // Actually, usually you pickup at startKm to use UNTIL endKm.
        // So events: startKm <= event < endKm?
        // Let's assume you pick up everything needed for the NEXT leg at the CURRENT station.

        const segmentEvents = intakeEvents.filter(e => e.distanceKm >= startKm && e.distanceKm < endKm);

        // Aggregate
        const items: Record<string, number> = {};

        for (const evt of segmentEvents) {
            if (!evt.product) continue;
            const name = evt.product.name;
            items[name] = (items[name] || 0) + evt.amount;
        }

        logistics.push({
            location: startKm === 0 ? "Start (Carry)" : `Dropbag KM ${startKm}`,
            items
        });
    }

    return logistics;
}
