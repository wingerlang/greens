
/**
 * Race Planner Calculators
 * Logic for Glycogen Modeling, Weather Adjustments, Hydration, Caffeine, and Pacing.
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
    sweatRateLh: number; // Liters per hour (can be preset or calculated)
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
    kcal?: number; // Optional, derived from carbsG if not set
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

// --- NEW: Hydration & Caffeine Types ---

export interface HydrationState {
    timeMinutes: number;
    distanceKm: number;
    fluidLossL: number;        // Cumulative sweat loss
    fluidIntakeL: number;      // Cumulative fluid intake
    fluidDeficitL: number;     // Current deficit (loss - intake)
    bodyWeightKg: number;      // Current weight (initial - deficit*0.9kg/L estimate)
}

export interface CaffeineState {
    timeMinutes: number;
    caffeineMgInSystem: number;  // With half-life decay
    lastIntakeMinutes: number;   // Time since last caffeine
}

export interface EnergyBreakdown {
    totalKcalBurned: number;
    carbsKcal: number;
    fatKcal: number;
    carbsG: number;
    fatG: number;
    carbsIntakeG: number;
    netCarbBalance: number; // intake - burned
}

// --- Sweat Rate Presets ---

export const SWEAT_RATE_PRESETS = [
    { id: 'low', label: 'Låg', value: 0.5, desc: 'Sval dag, lugnt tempo' },
    { id: 'normal', label: 'Normal', value: 0.8, desc: 'Standardförhållanden' },
    { id: 'high', label: 'Hög', value: 1.2, desc: 'Varmt eller intensivt' },
    { id: 'extreme', label: 'Extrem', value: 1.5, desc: 'Mycket varmt väder' }
] as const;

// --- Caffeine Presets ---

export const CAFFEINE_PRESETS = [
    { id: 'none', label: 'Ingen', preRaceMg: 0, duringRaceMg: 0, desc: 'Inget koffein' },
    { id: 'cautious', label: 'Försiktig', preRaceMg: 100, duringRaceMg: 50, desc: '~1.5 mg/kg, lägre dos' },
    { id: 'moderate', label: 'Van', preRaceMg: 200, duringRaceMg: 100, desc: '~3 mg/kg, standarddos' },
    { id: 'aggressive', label: 'Erfaren', preRaceMg: 300, duringRaceMg: 150, desc: '~4-5 mg/kg, hög dos' }
] as const;

// --- Carb Target Presets ---

export const CARB_TARGET_PRESETS = [
    { id: 'low', label: '40 g/h', value: 40, desc: 'Nybörjare, kort lopp' },
    { id: 'moderate', label: '60 g/h', value: 60, desc: 'Standardrekommendation' },
    { id: 'high', label: '90 g/h', value: 90, desc: 'Tränad mage, långt lopp' },
    { id: 'elite', label: '120 g/h', value: 120, desc: 'Elite, dubbla transportörer' }
] as const;

// --- Carb Source Presets ---

export const CARB_SOURCE_PRESETS = [
    { id: 'auto', label: 'Auto (Väderanpassad)', gelPct: 50, drinkPct: 50 }, // Values overridden by logic
    { id: 'gel_only', label: 'Endast gel', gelPct: 100, drinkPct: 0 },
    { id: 'gel_heavy', label: '70% Gel / 30% Dryck', gelPct: 70, drinkPct: 30 },
    { id: 'balanced', label: '50% / 50%', gelPct: 50, drinkPct: 50 },
    { id: 'drink_heavy', label: '30% Gel / 70% Dryck', gelPct: 30, drinkPct: 70 },
    { id: 'drink_only', label: 'Endast dryck', gelPct: 0, drinkPct: 100 }
] as const;

// --- Sweat Rate Calculation ---

/**
 * Estimates sweat rate based on temperature, humidity, and exercise intensity.
 * Based on research: Base ~0.5L/h, increases with heat and intensity.
 */
export function calculateSweatRate(tempC: number, humidityPct: number, intensityPct: number = 0.85): number {
    // Base rate at comfortable conditions (15C, 50% humidity)
    let baseRate = 0.5;

    // Temperature effect: +0.05 L/h per degree above 15C
    if (tempC > 15) {
        baseRate += (tempC - 15) * 0.05;
    }

    // Humidity effect: Higher humidity reduces evaporation efficiency, body sweats more
    // +0.002 L/h per percentage point above 50%
    if (humidityPct > 50) {
        baseRate += (humidityPct - 50) * 0.002;
    }

    // Intensity effect: Higher intensity = more heat = more sweat
    // Scale by intensity (0.5x at 50% intensity, 1.2x at 100%)
    const intensityFactor = 0.5 + (intensityPct * 0.7);
    baseRate *= intensityFactor;

    // Cap at reasonable bounds
    return Math.max(0.3, Math.min(2.5, baseRate));
}

/**
 * Suggests a sweat rate preset based on conditions.
 */
export function suggestSweatPreset(tempC: number, humidityPct: number): string {
    const estimated = calculateSweatRate(tempC, humidityPct);
    if (estimated <= 0.6) return 'low';
    if (estimated <= 1.0) return 'normal';
    if (estimated <= 1.4) return 'high';
    return 'extreme';
}

// --- Caffeine Simulation ---

const CAFFEINE_HALF_LIFE_HOURS = 5;

/**
 * Calculates remaining caffeine in system after time elapsed.
 * Uses exponential decay with ~5h half-life.
 */
export function calculateCaffeineRemaining(initialMg: number, elapsedMinutes: number): number {
    const elapsedHours = elapsedMinutes / 60;
    // Half-life formula: remaining = initial * (0.5)^(t/halfLife)
    const remaining = initialMg * Math.pow(0.5, elapsedHours / CAFFEINE_HALF_LIFE_HOURS);
    return Math.round(remaining * 10) / 10;
}

/**
 * Simulates caffeine levels throughout a race.
 */
export function simulateCaffeine(
    preRaceMg: number,
    preRaceMinutesBefore: number,
    intakeEvents: IntakeEvent[],
    totalRaceMinutes: number
): CaffeineState[] {
    const timeline: CaffeineState[] = [];
    const stepMinutes = 5;

    // Start with pre-race caffeine already partially absorbed
    let currentCaffeine = calculateCaffeineRemaining(preRaceMg, preRaceMinutesBefore);
    let lastIntake = -preRaceMinutesBefore;

    const caffeineEvents = intakeEvents
        .filter(e => e.product?.caffeineMg && e.product.caffeineMg > 0)
        .map(e => ({
            timeMinutes: 0, // Will be calculated from distance
            mg: (e.product?.caffeineMg || 0) * e.amount
        }));

    for (let t = 0; t <= totalRaceMinutes; t += stepMinutes) {
        // Apply decay
        if (t > 0) {
            currentCaffeine = calculateCaffeineRemaining(currentCaffeine, stepMinutes);
        }

        // Add any intake at this time
        // Note: We'd need pace info to convert km to time - for now assume linear
        // This will be integrated properly in the main simulation

        timeline.push({
            timeMinutes: t,
            caffeineMgInSystem: Math.round(currentCaffeine),
            lastIntakeMinutes: t - lastIntake
        });
    }

    return timeline;
}

// --- Energy/Calorie Calculations ---

/**
 * Calculates total kcal from a nutrition product.
 */
export function getProductKcal(product: NutritionProduct): number {
    if (product.kcal) return product.kcal;
    // Estimate: 4 kcal per gram of carbs
    return product.carbsG * 4;
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
    // NEW: Hydration tracking
    fluidBalanceL: number; // Positive = over-hydrated, Negative = dehydrated
    sweatLossL: number; // Cumulative sweat loss
    fluidIntakeL: number; // Cumulative fluid intake
    // NEW: Caffeine tracking
    caffeineMg: number; // Current caffeine in system (with decay)
}

export interface SimulationResult {
    timeline: GlycogenState[];
    crashTime: number | null;
    finishTime: number;
    peakCaffeineMg: number;
    peakCaffeineTimeMin: number;
}

/**
 * Simulates the race with glycogen, hydration, and caffeine levels.
 */
export function simulateRace(
    profile: RaceProfile,
    runner: RunnerProfile,
    intakeEvents: IntakeEvent[],
    initialGlycogen: number = 500,
    weatherPenalty: number = 1.0,
    preRaceCaffeineMg: number = 0 // NEW: Pre-race caffeine taken 30 min before
): SimulationResult {

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

    // Hydration: sweat rate per minute
    const sweatPerMinuteL = runner.sweatRateLh / 60;

    let currentGlycogen = initialGlycogen;
    let currentTime = 0;
    let currentDist = 0;
    let crashTime: number | null = null;

    // NEW: Hydration tracking
    let cumulativeSweatL = 0;
    let cumulativeFluidL = 0;

    // NEW: Caffeine tracking - pre-race caffeine has already been metabolizing for 30 min
    // Caffeine peaks at 45-60 min, so 30 min pre-race = near peak at race start
    let currentCaffeine = calculateCaffeineRemaining(preRaceCaffeineMg, 30);
    let peakCaffeine = currentCaffeine;
    let peakCaffeineTime = 0;

    const timeline: GlycogenState[] = [];

    // Add start state
    timeline.push({
        timeSeconds: 0,
        distanceKm: 0,
        glycogenStoreG: currentGlycogen,
        bloodGlucoseG: 5, // Baseline
        pace: adjustedPaceMinKm,
        isBonking: false,
        fluidBalanceL: 0,
        sweatLossL: 0,
        fluidIntakeL: 0,
        caffeineMg: Math.round(currentCaffeine)
    });

    const sortedEvents = [...intakeEvents].sort((a, b) => a.distanceKm - b.distanceKm);
    let eventIndex = 0;

    while (currentDist < profile.distanceKm) {
        // Step forward
        currentTime += timeStepMinutes;

        // Apply Bonk Penalty if empty
        let effectiveSpeedKph = speedKph;
        let effectivePace = adjustedPaceMinKm;

        if (currentGlycogen <= 0) {
            // Severe slowdown: 25% slower
            effectiveSpeedKph *= 0.75;
            effectivePace /= 0.75;
        }

        const distInc = (effectiveSpeedKph * timeStepMinutes) / 60;
        currentDist += distInc;

        // --- Glycogen Burn ---
        // Burn depends on INTENSITY, but if we slow down due to fatigue/bonk, 
        // strictly speaking intensity drops, but efficiency drops too.
        // For simplicity, keep burn rate constant for now (struggling to maintain pace)
        // or reduce it? Usually you burn less if you go slower, but it feels harder.
        // Let's keep it constant as the "Demand" of trying to run. 
        // Actually, if you bonk, you CAN'T burn glycogen (none left), you burn fat.
        // But for the math of "deficit", we keep subtracting.
        let currentBurn = carbBurnPerMinuteG * timeStepMinutes;

        // --- Hydration: Sweat loss ---
        // Sweat rate might decrease if intensity drops, but let's assume stress is high.
        cumulativeSweatL += sweatPerMinuteL * timeStepMinutes;

        // --- Caffeine decay ---
        // Caffeine half-life ~5h, decay per step
        currentCaffeine = calculateCaffeineRemaining(currentCaffeine, timeStepMinutes);

        // --- Intake: Check if we passed any events in this step ---
        let intakeCarbs = 0;
        let intakeFluidL = 0;
        let intakeCaffeine = 0;

        while (eventIndex < sortedEvents.length && sortedEvents[eventIndex].distanceKm <= currentDist) {
            const evt = sortedEvents[eventIndex];
            if (evt.product) {
                intakeCarbs += evt.product.carbsG * evt.amount;
                intakeFluidL += (evt.product.liquidMl * evt.amount) / 1000;
                intakeCaffeine += evt.product.caffeineMg * evt.amount;
            }
            eventIndex++;
        }

        // Apply intake
        currentGlycogen += intakeCarbs;
        cumulativeFluidL += intakeFluidL;
        currentCaffeine += intakeCaffeine;

        // Track peak caffeine
        if (currentCaffeine > peakCaffeine) {
            peakCaffeine = currentCaffeine;
            peakCaffeineTime = currentTime;
        }

        // Subtract glycogen burn
        currentGlycogen -= currentBurn;

        // Check Bonk
        let isBonking = false;
        if (currentGlycogen <= 0) {
            if (crashTime === null) crashTime = currentTime * 60;
            currentGlycogen = 0; // Floor at 0 (visually), but keep counting deficit? 
            // Actually for logic we need to know it's empty.
            // But if we clamp to 0, how do we recover?
            // If intake comes, it adds positive.
            // So we should allow negative internally? 
            // No, the prompt says "isBonking" is true.
            // Effectively, if <=0, we are bonking.
            isBonking = true;
        }

        // Calculate fluid balance
        const fluidBalance = cumulativeFluidL - cumulativeSweatL;

        timeline.push({
            timeSeconds: currentTime * 60,
            distanceKm: currentDist,
            glycogenStoreG: Math.round(currentGlycogen),
            bloodGlucoseG: 5,
            pace: effectivePace, // Use effective pace
            isBonking,
            fluidBalanceL: Math.round(fluidBalance * 100) / 100,
            sweatLossL: Math.round(cumulativeSweatL * 100) / 100,
            fluidIntakeL: Math.round(cumulativeFluidL * 100) / 100,
            caffeineMg: Math.round(currentCaffeine)
        });
    }

    return {
        timeline,
        crashTime,
        finishTime: timeline[timeline.length - 1].timeSeconds,
        peakCaffeineMg: Math.round(peakCaffeine),
        peakCaffeineTimeMin: peakCaffeineTime
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
        const dist = (k > distanceKm) ? (distanceKm - (k - 1)) : 1;
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

    const locations = [0, ...dropbagKms].sort((a, b) => a - b);
    const logistics = [];

    for (let i = 0; i < locations.length; i++) {
        const startKm = locations[i];
        const endKm = locations[i + 1] || 9999; // 9999 represents finish/infinity

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

// --- NEW: Auto-Generate Intake Events ---

/**
 * Default gel and drink products for auto-generation.
 */
const DEFAULT_GEL: NutritionProduct = {
    name: "Gel (25g)",
    carbsG: 25,
    caffeineMg: 0,
    sodiumMg: 50,
    liquidMl: 0,
    isDrink: false
};

const DEFAULT_CAFFEINATED_GEL: NutritionProduct = {
    name: "Gel Koffein (25g)",
    carbsG: 25,
    caffeineMg: 75,
    sodiumMg: 50,
    liquidMl: 0,
    isDrink: false
};

const DEFAULT_DRINK: NutritionProduct = {
    name: "Sportdryck (40g/500ml)",
    carbsG: 40,
    caffeineMg: 0,
    sodiumMg: 200,
    liquidMl: 500,
    isDrink: true
};

// --- Weather Presets ---

export const WEATHER_PRESETS = [
    { id: 'chilly', label: 'Kyligt', temp: 5, humidity: 60, icon: '❄️' },
    { id: 'casual', label: 'Behagligt', temp: 15, humidity: 50, icon: '⛅' },
    { id: 'warm', label: 'Varmt', temp: 22, humidity: 60, icon: '☀️' },
    { id: 'hot', label: 'Hetta', temp: 28, humidity: 70, icon: '🔥' }
] as const;

export interface GenerateIntakeOptions {
    distanceKm: number;
    targetTimeMinutes: number;
    carbsPerHour: number;
    gelPercent: number; // 0-100
    drinkPercent: number; // 0-100 (should = 100 - gelPercent)
    includeCaffeine: boolean;
    caffeineInLastThird: boolean; // Only add caffeine in last portion of race
    customGel?: NutritionProduct;
    customDrink?: NutritionProduct;
}

/**
 * Generates evenly distributed intake events based on carb target.
 * Returns both intake events and a summary.
 */
export function generateIntakeEvents(options: GenerateIntakeOptions): {
    events: IntakeEvent[],
    summary: {
        totalCarbsG: number,
        totalLiquidMl: number,
        totalCaffeineMg: number,
        intakeCount: number,
        intervalMinutes: number
    }
} {
    const {
        distanceKm,
        targetTimeMinutes,
        carbsPerHour,
        gelPercent,
        drinkPercent,
        includeCaffeine,
        caffeineInLastThird,
        customGel,
        customDrink
    } = options;

    const gel = customGel || DEFAULT_GEL;
    const cafGel = DEFAULT_CAFFEINATED_GEL;
    const drink = customDrink || DEFAULT_DRINK;

    const events: IntakeEvent[] = [];

    // Calculate total carbs needed
    const totalHours = targetTimeMinutes / 60;
    const totalCarbsNeeded = carbsPerHour * totalHours;

    // Split between gel and drink
    const gelCarbs = totalCarbsNeeded * (gelPercent / 100);
    const drinkCarbs = totalCarbsNeeded * (drinkPercent / 100);

    // Calculate number of each
    // Use ceil for drink to assume at least one bottle if any drink pct requested (avoids 0ml bug)
    // Use round for gel
    const gelCount = gel.carbsG > 0 ? Math.round(gelCarbs / gel.carbsG) : 0;
    const drinkCount = drink.carbsG > 0 ? (drinkPercent > 0 ? Math.ceil(drinkCarbs / drink.carbsG) : 0) : 0;

    const totalIntakes = gelCount + drinkCount;
    if (totalIntakes === 0) {
        return {
            events: [],
            summary: {
                totalCarbsG: 0,
                totalLiquidMl: 0,
                totalCaffeineMg: 0,
                intakeCount: 0,
                intervalMinutes: 0
            }
        };
    }

    // Distribute evenly across race distance
    // Start after first km, end before last km
    const startKm = 5; // First intake at 5km
    const endKm = distanceKm - 2; // Last intake 2km before finish
    const intakeRange = endKm - startKm;
    const intervalKm = intakeRange / (totalIntakes - 1 || 1);

    // Alternate or interleave gel and drink
    // Strategy: Distribute both types evenly, interleaving
    let gelIndex = 0;
    let drinkIndex = 0;
    const lastThirdStart = distanceKm * 0.67;

    for (let i = 0; i < totalIntakes; i++) {
        const km = Math.round((startKm + i * intervalKm) * 10) / 10;

        // Decide if this is gel or drink
        // Simple round-robin, weighted by count
        const useGel = gelCount > 0 && (drinkCount === 0 || (gelIndex / gelCount) <= (drinkIndex / (drinkCount || 1)));

        if (useGel && gelIndex < gelCount) {
            // Determine if caffeinated
            // Caffeine peaks at ~45-60 min after intake, so start earlier (50% of race)
            // This ensures peak effect for the hardest part of the race (60-80% mark)
            const caffeineStartKm = distanceKm * 0.5; // Start caffeine at halfway
            const useCafGel = includeCaffeine && (!caffeineInLastThird || km >= caffeineStartKm);

            events.push({
                distanceKm: km,
                type: 'gel',
                amount: 1,
                product: useCafGel ? cafGel : gel
            });
            gelIndex++;
        } else if (drinkIndex < drinkCount) {
            events.push({
                distanceKm: km,
                type: 'drink',
                amount: 1,
                product: drink
            });
            drinkIndex++;
        }
    }

    // Calculate summary
    const totalCarbsG = events.reduce((sum, e) => sum + (e.product?.carbsG || 0) * e.amount, 0);
    const totalLiquidMl = events.reduce((sum, e) => sum + (e.product?.liquidMl || 0) * e.amount, 0);
    const totalCaffeineMg = events.reduce((sum, e) => sum + (e.product?.caffeineMg || 0) * e.amount, 0);
    const intervalMinutes = totalIntakes > 1 ? targetTimeMinutes / (totalIntakes - 1) : 0;

    return {
        events,
        summary: {
            totalCarbsG,
            totalLiquidMl,
            totalCaffeineMg,
            intakeCount: events.length,
            intervalMinutes: Math.round(intervalMinutes)
        }
    };
}

/**
 * Suggests carb source distribution based on weather.
 * Warmer = more drinks recommended.
 */
export function suggestCarbSourceDistribution(tempC: number): { gelPct: number, drinkPct: number, reason: string } {
    if (tempC >= 25) {
        return { gelPct: 30, drinkPct: 70, reason: 'Varmt väder – prioritera vätskerik energi' };
    }
    if (tempC >= 20) {
        return { gelPct: 50, drinkPct: 50, reason: 'Uppvärmt – balanserad mix rekommenderas' };
    }
    if (tempC >= 10) {
        return { gelPct: 70, drinkPct: 30, reason: 'Behagligt – gel-fokuserat fungerar bra' };
    }
    return { gelPct: 80, drinkPct: 20, reason: 'Kallt väder – minimal dryck krävs' };
}

// --- Hydration Summary ---

export interface HydrationSummary {
    totalSweatLossL: number;
    totalFluidIntakeL: number;
    netDeficitL: number;
    estimatedWeightLossKg: number;
    dehydrationPercent: number; // % of body weight
    hydrationStatus: 'good' | 'warning' | 'critical';
}

/**
 * Calculates hydration summary for the race.
 */
export function calculateHydrationSummary(
    runnerWeightKg: number,
    sweatRateLh: number,
    raceTimeMinutes: number,
    intakeEvents: IntakeEvent[]
): HydrationSummary {
    const raceHours = raceTimeMinutes / 60;
    const totalSweatLossL = sweatRateLh * raceHours;

    // Calculate fluid intake from drink events
    const totalFluidIntakeL = intakeEvents.reduce((sum, e) => {
        if (e.product?.isDrink && e.product.liquidMl) {
            return sum + (e.product.liquidMl * e.amount) / 1000;
        }
        return sum;
    }, 0);

    const netDeficitL = totalSweatLossL - totalFluidIntakeL;

    // Weight loss: ~1kg per liter of sweat (minus some from glycogen depletion)
    // Glycogen is ~4g water per g glycogen, so burning 500g glycogen releases ~2kg water
    // For simplicity: weight loss ≈ deficit * 0.9 (some water released from metabolism)
    const estimatedWeightLossKg = netDeficitL * 0.9;

    const dehydrationPercent = (netDeficitL / runnerWeightKg) * 100;

    let hydrationStatus: 'good' | 'warning' | 'critical' = 'good';
    if (dehydrationPercent >= 4) {
        hydrationStatus = 'critical';
    } else if (dehydrationPercent >= 2) {
        hydrationStatus = 'warning';
    }

    return {
        totalSweatLossL: Math.round(totalSweatLossL * 10) / 10,
        totalFluidIntakeL: Math.round(totalFluidIntakeL * 10) / 10,
        netDeficitL: Math.round(netDeficitL * 10) / 10,
        estimatedWeightLossKg: Math.round(estimatedWeightLossKg * 10) / 10,
        dehydrationPercent: Math.round(dehydrationPercent * 10) / 10,
        hydrationStatus
    };
}

// --- Energy Breakdown ---

/**
 * Calculates detailed energy breakdown for the race.
 */
export function calculateEnergyBreakdown(
    runnerWeightKg: number,
    distanceKm: number,
    targetTimeMinutes: number,
    intakeEvents: IntakeEvent[]
): EnergyBreakdown {
    const speedKph = distanceKm / (targetTimeMinutes / 60);
    const raceHours = targetTimeMinutes / 60;

    // Total kcal burned (1 kcal/kg/km approximation)
    const totalKcalBurned = runnerWeightKg * distanceKm;

    // Intensity estimate
    let intensity = 0.85;
    if (distanceKm < 10) intensity = 0.95;
    else if (distanceKm < 22) intensity = 0.90;
    else if (distanceKm < 45) intensity = 0.85;
    else intensity = 0.75;

    const carbRatio = getCarbRatio(intensity);
    const carbsKcal = totalKcalBurned * carbRatio;
    const fatKcal = totalKcalBurned * (1 - carbRatio);

    const carbsG = carbsKcal / 4; // 4 kcal per gram carbs
    const fatG = fatKcal / 9; // 9 kcal per gram fat

    const carbsIntakeG = intakeEvents.reduce((sum, e) => sum + (e.product?.carbsG || 0) * e.amount, 0);
    const netCarbBalance = carbsIntakeG - carbsG;

    return {
        totalKcalBurned: Math.round(totalKcalBurned),
        carbsKcal: Math.round(carbsKcal),
        fatKcal: Math.round(fatKcal),
        carbsG: Math.round(carbsG),
        fatG: Math.round(fatG),
        carbsIntakeG: Math.round(carbsIntakeG),
        netCarbBalance: Math.round(netCarbBalance)
    };
}

// --- Tempo Presets ---

export const TEMPO_PRESETS = [
    // Marathon
    { id: 'mara_elite', label: 'Mara Elite (Sub 2:30)', paceMinKm: '3:33', distanceKm: 42.2, targetSeconds: 9000 },
    { id: 'mara_sub3', label: 'Mara Sub 3:00', paceMinKm: '4:16', distanceKm: 42.2, targetSeconds: 10800 },
    { id: 'mara_sub330', label: 'Mara Sub 3:30', paceMinKm: '4:58', distanceKm: 42.2, targetSeconds: 12600 },
    { id: 'mara_sub4', label: 'Mara Sub 4:00', paceMinKm: '5:41', distanceKm: 42.2, targetSeconds: 14400 },
    { id: 'mara_sub430', label: 'Mara Sub 4:30', paceMinKm: '6:23', distanceKm: 42.2, targetSeconds: 16200 },
    { id: 'mara_sub5', label: 'Mara Sub 5:00', paceMinKm: '7:06', distanceKm: 42.2, targetSeconds: 18000 },
    // Half Marathon
    { id: 'half_sub130', label: 'Halv Sub 1:30', paceMinKm: '4:16', distanceKm: 21.1, targetSeconds: 5400 },
    { id: 'half_sub145', label: 'Halv Sub 1:45', paceMinKm: '4:58', distanceKm: 21.1, targetSeconds: 6300 },
    { id: 'half_sub2', label: 'Halv Sub 2:00', paceMinKm: '5:41', distanceKm: 21.1, targetSeconds: 7200 },
    // 10K  
    { id: '10k_sub40', label: '10K Sub 40 min', paceMinKm: '4:00', distanceKm: 10, targetSeconds: 2400 },
    { id: '10k_sub50', label: '10K Sub 50 min', paceMinKm: '5:00', distanceKm: 10, targetSeconds: 3000 },
    { id: '10k_sub60', label: '10K Sub 60 min', paceMinKm: '6:00', distanceKm: 10, targetSeconds: 3600 },
    // Ultra
    { id: 'ultra45_sub4', label: 'Ultravasan 45 Sub 4h', paceMinKm: '5:20', distanceKm: 45, targetSeconds: 14400 },
    { id: 'ultra90_sub10', label: 'Ultravasan 90 Sub 10h', paceMinKm: '6:40', distanceKm: 90, targetSeconds: 36000 }
] as const;

