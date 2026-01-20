
import { calculateWilks } from '../../../utils/strengthCalculators.ts';

// ==========================================
// SCORING CONFIGURATION
// ==========================================
// We normalize everything to a 0-100 "Beast Score" scale.
// 100 represents Elite/National Level performance.
// 50 represents a fit intermediate.

const COOPER_MAX_M = 3600; // 3600m in 12 min is ~3:20/km pace (Elite/High Level)
const COOPER_MIN_M = 1500; // Walking/Jogging

const WILKS_MAX = 500; // Elite Powerlifter
const WILKS_MIN = 0;

const SINCLAIR_MAX = 380; // National Level Weightlifter
const SINCLAIR_MIN = 0;

const HYROX_BEST_SEC = 57 * 60; // 57 mins (Elite)
const HYROX_BASELINE_SEC = 120 * 60; // 2 hours (Novice/Cutoff)

// ==========================================
// UTILITIES
// ==========================================

function normalize(value: number, min: number, max: number): number {
    if (value <= min) return 0;
    if (value >= max) return 100;
    return Math.round(((value - min) / (max - min)) * 100);
}

// ==========================================
// CALCULATORS
// ==========================================

export function calculateCooperScore(distanceMeters: number): number {
    return normalize(distanceMeters, COOPER_MIN_M, COOPER_MAX_M);
}

export function calculateStrengthScore(bwKg: number, totalKg: number, gender: 'male' | 'female'): number {
    const wilks = calculateWilks(bwKg, totalKg, gender);
    return normalize(wilks, WILKS_MIN, WILKS_MAX);
}

// Sinclair Coefficient (2017-2020 cycle approx)
export function calculateSinclair(bwKg: number, totalKg: number, gender: 'male' | 'female'): number {
    if (bwKg <= 0 || totalKg <= 0) return 0;

    // Coefficients for 2017-2020
    const A = gender === 'male' ? 0.751945030 : 0.783497476;
    const b = gender === 'male' ? 175.508 : 153.655;

    let coeff = 1.0;
    if (bwKg < b) {
        const exponent = A * Math.pow(Math.log10(bwKg / b), 2);
        coeff = Math.pow(10, exponent);
    }

    return totalKg * coeff;
}

export function calculateWeightliftingScore(bwKg: number, totalKg: number, gender: 'male' | 'female'): number {
    const sinclair = calculateSinclair(bwKg, totalKg, gender);
    return normalize(sinclair, SINCLAIR_MIN, SINCLAIR_MAX);
}

export function calculateHyroxScore(timeSeconds: number): number {
    if (!timeSeconds || timeSeconds <= 0) return 0;

    // Inverted scale: Less time is better
    // If time < Best, score 100.
    // If time > Baseline, score 0.

    if (timeSeconds <= HYROX_BEST_SEC) return 100;
    if (timeSeconds >= HYROX_BASELINE_SEC) return 0;

    const range = HYROX_BASELINE_SEC - HYROX_BEST_SEC;
    const diff = HYROX_BASELINE_SEC - timeSeconds; // How much faster than baseline?

    return Math.round((diff / range) * 100);
}

export function getBeastTier(score: number): string {
    if (score >= 90) return 'TITAN';
    if (score >= 75) return 'ELITE';
    if (score >= 60) return 'ADVANCED';
    if (score >= 45) return 'ATHLETE';
    if (score >= 30) return 'INTERMEDIATE';
    if (score >= 15) return 'NOVICE';
    return 'ROOKIE';
}
