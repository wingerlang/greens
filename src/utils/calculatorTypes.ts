/**
 * Calculator Types
 * Common types for health and fitness calculations
 */

export type Gender = 'male' | 'female';

export type ActivityLevel =
    | 'sedentary'       // 1.2
    | 'lightly_active'  // 1.375
    | 'active'          // 1.55
    | 'very_active'     // 1.725
    | 'extra_active';   // 1.9

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
    'sedentary': 1.2,
    'lightly_active': 1.375,
    'active': 1.55,
    'very_active': 1.725,
    'extra_active': 1.9
};

// Aliases for compatibility if needed (e.g. 'light' -> 'lightly_active')
export const ACTIVITY_ALIASES: Record<string, ActivityLevel> = {
    'light': 'lightly_active',
    'moderate': 'active',
    // 'active' is same
    // 'very_active' is same
};

/**
 * Get multiplier safely handling aliases
 */
export function getActivityMultiplier(level: string): number {
    const key = (ACTIVITY_ALIASES[level] || level) as ActivityLevel;
    return ACTIVITY_MULTIPLIERS[key] || 1.2;
}
