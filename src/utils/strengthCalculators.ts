/**
 * Strength Calculators for Powerlifting and General Strength
 */

/**
 * Wilks Coefficient (Old standard, still widely used for personal comparison)
 */
export function calculateWilks(weightKg: number, totalKg: number, gender: 'male' | 'female'): number {
    if (weightKg <= 0 || totalKg <= 0) return 0;

    const coeffs = gender === 'male' ? {
        a: -216.0475144,
        b: 16.2606339,
        c: -0.002388645,
        d: -0.00113732,
        e: 0.00000701863,
        f: -0.00000001291
    } : {
        a: 594.31747775,
        b: -27.238425364,
        c: 0.82112226871,
        d: -0.00930733913,
        e: 0.00004731582,
        f: -0.00000009054
    };

    const x = weightKg;
    const denominator = coeffs.a +
        coeffs.b * x +
        coeffs.c * Math.pow(x, 2) +
        coeffs.d * Math.pow(x, 3) +
        coeffs.e * Math.pow(x, 4) +
        coeffs.f * Math.pow(x, 5);

    const coeff = 500 / denominator;
    return totalKg * coeff;
}

/**
 * IPF GL Points (New standard used by International Powerlifting Federation)
 */
export function calculateIPFPoints(weightKg: number, totalKg: number, gender: 'male' | 'female', type: 'raw' | 'equipped' = 'raw'): number {
    if (weightKg <= 0 || totalKg <= 0) return 0;

    // Constants for IPF GL Point formula
    const maleRaw = { a: 1199.72839, b: 1025.18162, c: 0.00921 };
    const femaleRaw = { a: 610.32796, b: 1045.59282, c: 0.03048 };

    const constants = gender === 'male' ? maleRaw : femaleRaw;

    // Formula: Points = Total * 100 / (A - B * e^(-C * W))
    const denominator = constants.a - constants.b * Math.exp(-constants.c * weightKg);
    return (totalKg * 100) / denominator;
}

/**
 * Estimated 1RM using Epley formula (more reliable for high reps than Brzycki)
 */
export function estimate1RM(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps <= 0) return 0;
    // Epley formula: 1RM = weight * (1 + reps / 30)
    // Capping reps at 12 to avoid unrealistic numbers from endurance sets
    const effectiveReps = Math.min(reps, 12);
    return weight * (1 + effectiveReps / 30);
}

export function calculateAverage1RM(weight: number, reps: number) {
    if (reps === 1) return {
        average: weight,
        epley: weight,
        brzycki: weight,
        lander: weight,
        lombardi: weight,
        mayhew: weight,
        oconner: weight,
        wathan: weight
    };

    // Formulas
    const epley = weight * (1 + reps / 30);
    const brzycki = weight * (36 / (37 - reps));
    const lander = (100 * weight) / (101.3 - 2.67123 * reps);
    const lombardi = weight * Math.pow(reps, 0.10);
    const mayhew = (100 * weight) / (52.2 + (41.9 * Math.exp(-0.055 * reps)));
    const oconner = weight * (1 + 0.025 * reps);
    const wathan = (100 * weight) / (48.8 + (53.8 * Math.exp(-0.075 * reps)));

    const all = [epley, brzycki, lander, lombardi, mayhew, oconner, wathan];
    const sum = all.reduce((a, b) => a + b, 0);
    const average = sum / all.length;

    return {
        average: Math.round(average * 10) / 10,
        epley: Math.round(epley * 10) / 10,
        brzycki: Math.round(brzycki * 10) / 10,
        lander: Math.round(lander * 10) / 10,
        lombardi: Math.round(lombardi * 10) / 10,
        mayhew: Math.round(mayhew * 10) / 10,
        oconner: Math.round(oconner * 10) / 10,
        wathan: Math.round(wathan * 10) / 10
    };
}

export interface Plate {
    weight: number;
    count: number;
    color?: string; // e.g., 'red', 'blue'
}

export function calculatePlateLoading(
    targetWeight: number,
    barWeight: number = 20,
    availablePlates: number[] = [25, 20, 15, 10, 5, 2.5, 1.25]
): { plates: Plate[]; remainder: number } {
    if (targetWeight <= barWeight) return { plates: [], remainder: 0 };

    let neededPerSide = (targetWeight - barWeight) / 2;
    const loadedPlates: Plate[] = [];

    // Sort available plates descending
    const sortedPlates = [...availablePlates].sort((a, b) => b - a);

    for (const plate of sortedPlates) {
        if (neededPerSide >= plate) {
            const count = Math.floor(neededPerSide / plate);
            if (count > 0) {
                loadedPlates.push({ weight: plate, count: count });
                neededPerSide -= count * plate;
                neededPerSide = Math.round(neededPerSide * 1000) / 1000; // Fix float precision
            }
        }
    }

    return {
        plates: loadedPlates,
        remainder: neededPerSide * 2 // Total remaining weight
    };
}
