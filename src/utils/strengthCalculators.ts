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
 * Estimated 1RM using Brzycki formula
 */
export function estimate1RM(weight: number, reps: number): number {
    if (reps === 1) return weight;
    if (reps <= 0) return 0;
    // Brzycki formula: 1RM = weight * (36 / (37 - reps))
    // Or simpler: weight * (1 + reps/30)
    return weight * (36 / (37 - Math.min(reps, 30)));
}
