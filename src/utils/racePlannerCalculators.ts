
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

export type SweatProfile = 'low' | 'medium' | 'high' | 'custom';

export interface RunnerProfile {
    weightKg: number;
    maxHr: number;
    restingHr: number;
    sweatProfile: SweatProfile;
    customSweatRateLh?: number;
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

export interface NutritionStrategy {
    carbsPerHour: number; // 40, 60, 90, 120
    drinkRatio: number; // 0.0 to 1.0 (0 = all gel, 1 = all drink)
    useCaffeine: boolean;
}

// --- Constants ---

export const SWEAT_RATES: Record<SweatProfile, number> = {
    low: 0.8,
    medium: 1.2,
    high: 1.8,
    custom: 1.2
};

export const STANDARD_PRODUCTS = {
    GEL: { name: "Gel (Standard)", carbsG: 25, caffeineMg: 0, sodiumMg: 20, liquidMl: 0, isDrink: false },
    GEL_CAF: { name: "Gel (Caffeine)", carbsG: 25, caffeineMg: 100, sodiumMg: 20, liquidMl: 0, isDrink: false },
    DRINK: { name: "Sport Drink (500ml)", carbsG: 40, caffeineMg: 0, sodiumMg: 50, liquidMl: 500, isDrink: true },
    WATER: { name: "Water (250ml)", carbsG: 0, caffeineMg: 0, sodiumMg: 0, liquidMl: 250, isDrink: true }
};

// --- Weather Adjustment ---

export function calculateWeatherPenaltyFactor(tempC: number, humidity: number): number {
    if (tempC <= 15) return 1.0;
    const excessTemp = tempC - 15;
    const humidityCorrection = 0.8 + (0.4 * (humidity / 100));
    const totalPenaltyPct = excessTemp * 0.015 * humidityCorrection;
    return 1 + totalPenaltyPct;
}

// --- Logic ---

export function estimateKcalBurnRate(weightKg: number, speedKph: number): number {
    return (weightKg * speedKph) / 60;
}

export function getCarbRatio(intensityPct: number): number {
    if (intensityPct < 0.5) return 0.2;
    if (intensityPct >= 1.0) return 1.0;
    const ratio = (1.6 * intensityPct) - 0.6;
    return Math.max(0.1, Math.min(1.0, ratio));
}

export function getSweatRate(profile: RunnerProfile): number {
    if (profile.sweatProfile === 'custom' && profile.customSweatRateLh) {
        return profile.customSweatRateLh;
    }
    return SWEAT_RATES[profile.sweatProfile] || 1.2;
}

export interface SimState {
    timeSeconds: number;
    distanceKm: number;
    glycogenStoreG: number;
    fluidDeficitL: number;
    caffeineMg: number;
    weightLossKg: number;
    pace: number;
    isBonking: boolean;
}

/**
 * Simulates the race including Glycogen, Hydration, Caffeine.
 */
export function simulateRace(
    profile: RaceProfile,
    runner: RunnerProfile,
    intakeEvents: IntakeEvent[],
    initialGlycogen: number = 500,
    weatherPenalty: number = 1.0,
    paceAdjustmentFactor: number = 1.0 // User tuning (0.9 = faster, 1.1 = slower)
): {
    timeline: SimState[],
    crashTime: number | null,
    finishTime: number,
    totalFluidLossL: number,
    totalFluidIntakeL: number,
    finalWeightLossKg: number
} {
    const timeStepMinutes = 5;

    // Effective Pace
    const basePaceMinKm = (profile.targetTimeSeconds / 60) / profile.distanceKm;
    const weatherPace = basePaceMinKm * weatherPenalty;
    const finalPace = weatherPace * paceAdjustmentFactor;

    const speedKph = 60 / finalPace;

    // Intensity Model
    // Adjust intensity based on the ratio of Final Pace vs Base Pace (A-Goal)
    // If running slower (factor > 1), intensity drops.
    // If factor is 1.1 (10% slower), intensity roughly drops by same ratio?
    let baseIntensity = 0.85;
    if (profile.distanceKm < 10) baseIntensity = 0.98;
    else if (profile.distanceKm < 22) baseIntensity = 0.92;
    else if (profile.distanceKm < 45) baseIntensity = 0.85;
    else baseIntensity = 0.70;

    // Adjust intensity: Intensity is inversely proportional to pace
    const intensity = baseIntensity * (basePaceMinKm / finalPace);

    const kcalPerMinute = estimateKcalBurnRate(runner.weightKg, speedKph);
    const carbRatio = getCarbRatio(intensity);
    const carbBurnPerMinuteG = (kcalPerMinute * carbRatio) / 4;
    const sweatRateLh = getSweatRate(runner);
    const sweatPerMinuteL = sweatRateLh / 60;

    let currentGlycogen = initialGlycogen;
    let currentFluidDeficit = 0;
    let currentCaffeine = 0; // Active plasma caffeine
    let currentTime = 0;
    let currentDist = 0;
    let crashTime: number | null = null;
    let totalFluidIntake = 0;

    const timeline: SimState[] = [];

    // Caffeine Half-Life ~5 hours. Decay constant k.
    // C(t) = C0 * e^(-kt). Half life t1/2 = ln(2)/k => k = ln(2)/5.
    const kCaf = Math.log(2) / (5 * 60); // per minute

    // Initial state
    timeline.push({
        timeSeconds: 0,
        distanceKm: 0,
        glycogenStoreG: currentGlycogen,
        fluidDeficitL: 0,
        caffeineMg: 0,
        weightLossKg: 0,
        pace: finalPace,
        isBonking: false
    });

    const sortedEvents = [...intakeEvents].sort((a, b) => a.distanceKm - b.distanceKm);
    let eventIndex = 0;

    while (currentDist < profile.distanceKm) {
        currentTime += timeStepMinutes;
        const distInc = (speedKph * timeStepMinutes) / 60;
        currentDist += distInc;

        // Glycogen Burn
        currentGlycogen -= (carbBurnPerMinuteG * timeStepMinutes);

        // Fluid Loss
        const stepSweat = sweatPerMinuteL * timeStepMinutes;
        currentFluidDeficit += stepSweat;

        // Caffeine Decay
        currentCaffeine = currentCaffeine * Math.exp(-kCaf * timeStepMinutes);

        // Intake Processing
        let intakeCarbs = 0;
        let intakeFluid = 0;
        let intakeCaffeine = 0;

        while(eventIndex < sortedEvents.length && sortedEvents[eventIndex].distanceKm <= currentDist) {
            const evt = sortedEvents[eventIndex];
            if (evt.product) {
                intakeCarbs += evt.product.carbsG * evt.amount;
                intakeFluid += (evt.product.liquidMl || 0) * evt.amount / 1000; // ml to L
                intakeCaffeine += evt.product.caffeineMg * evt.amount;
            }
            eventIndex++;
        }

        currentGlycogen += intakeCarbs;
        currentFluidDeficit -= intakeFluid;
        currentCaffeine += intakeCaffeine;
        totalFluidIntake += intakeFluid;

        // Floor Deficit (cannot have negative deficit -> hydrated)
        // Actually, you can be hyperhydrated but for this model we floor at 0 deficit (max hydration).
        // Let's allow negative to show "sloshing" risk?
        // No, let's keep it simple: 0 is fully hydrated. Positive is deficit.
        if (currentFluidDeficit < 0) currentFluidDeficit = 0;

        // Bonk Check
        let isBonking = false;
        if (currentGlycogen <= 0) {
            if (crashTime === null) crashTime = currentTime * 60;
            currentGlycogen = 0;
            isBonking = true;
        }

        // Weight Loss (Sweat Deficit + Glycogen Burned + Fat Burned?)
        // Glycogen binds 3-4g water. So burning 500g glycogen releases ~2kg water?
        // That water is available for hydration internally.
        // For simple scale weight: Fluid Deficit (L ~ kg) is the main driver.
        // Let's just track Fluid Deficit as proxy for acute weight loss.
        const estWeightLoss = currentFluidDeficit;

        timeline.push({
            timeSeconds: currentTime * 60,
            distanceKm: currentDist,
            glycogenStoreG: Math.round(currentGlycogen),
            fluidDeficitL: Math.round(currentFluidDeficit * 100) / 100,
            caffeineMg: Math.round(currentCaffeine),
            weightLossKg: Math.round(estWeightLoss * 10) / 10,
            pace: finalPace,
            isBonking
        });
    }

    return {
        timeline,
        crashTime,
        finishTime: timeline[timeline.length-1].timeSeconds,
        totalFluidLossL: timeline[timeline.length-1].fluidDeficitL + totalFluidIntake, // Roughly total sweat
        totalFluidIntakeL: totalFluidIntake,
        finalWeightLossKg: timeline[timeline.length-1].weightLossKg
    };
}

// --- Generator ---

export function generateNutritionPlan(
    distanceKm: number,
    targetTimeSeconds: number, // Total time
    strategy: NutritionStrategy
): IntakeEvent[] {
    const hours = targetTimeSeconds / 3600;
    const totalCarbsNeeded = strategy.carbsPerHour * hours;

    // Ratios (Carb contribution)
    const drinkCarbs = totalCarbsNeeded * strategy.drinkRatio;
    const gelCarbs = totalCarbsNeeded * (1 - strategy.drinkRatio);

    // Products
    // Drink: Standard 40g per 500ml bottle
    const drinkCount = Math.round(drinkCarbs / 40);
    // Gel: Standard 25g
    const gelCount = Math.round(gelCarbs / 25);

    const events: IntakeEvent[] = [];

    // Distribute Drinks (Regular intervals)
    if (drinkCount > 0) {
        const drinkIntervalKm = distanceKm / (drinkCount + 1);
        for(let i=1; i<=drinkCount; i++) {
            events.push({
                distanceKm: Math.round(i * drinkIntervalKm * 10) / 10,
                type: 'drink',
                amount: 1,
                product: STANDARD_PRODUCTS.DRINK
            });
        }
    }

    // Distribute Gels
    if (gelCount > 0) {
        const gelIntervalKm = distanceKm / (gelCount + 1);
        for(let i=1; i<=gelCount; i++) {
            // Caffeine Strategy: If enabled, every 3rd gel is Caffeine?
            // Or just load at start + end?
            // Simple: Every other?
            // Let's make the last gel caffeinated for kick, and one in middle.
            let product = STANDARD_PRODUCTS.GEL;
            if (strategy.useCaffeine) {
                // If index is odd?
                if (i % 2 !== 0) product = STANDARD_PRODUCTS.GEL_CAF;
            }

            events.push({
                distanceKm: Math.round(i * gelIntervalKm * 10) / 10,
                type: 'gel',
                amount: 1,
                product: product
            });
        }
    }

    // Add Water Events?
    // We should assume water stations every X km.
    // For now, let's just add generic water every 5km if drinkRatio is low?
    if (strategy.drinkRatio < 0.5) {
        const stations = Math.floor(distanceKm / 5);
        for(let i=1; i<=stations; i++) {
            events.push({
                distanceKm: i * 5,
                type: 'drink',
                amount: 1,
                product: STANDARD_PRODUCTS.WATER
            });
        }
    }

    return events.sort((a,b) => a.distanceKm - b.distanceKm);
}

// --- Splits ---

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
            const progress = k / distanceKm;
            const factor = 1.05 - (0.10 * progress);
            splitPace = avgPace * factor;
        } else if (strategy === 'positive') {
            const progress = k / distanceKm;
            const factor = 0.95 + (0.10 * progress);
            splitPace = avgPace * factor;
        }

        const dist = (k > distanceKm) ? (distanceKm - (k-1)) : 1;
        const time = splitPace * dist;

        cumulative += time;

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

// --- Dropbag ---

export function calculateDropbagLogistics(
    intakeEvents: IntakeEvent[],
    dropbagKms: number[]
): { location: string, items: Record<string, number> }[] {
    const locations = [0, ...dropbagKms].sort((a,b) => a-b);
    const logistics = [];

    for (let i = 0; i < locations.length; i++) {
        const startKm = locations[i];
        const endKm = locations[i+1] || 9999;

        const segmentEvents = intakeEvents.filter(e => e.distanceKm >= startKm && e.distanceKm < endKm);
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
