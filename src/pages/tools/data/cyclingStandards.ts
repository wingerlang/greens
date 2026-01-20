export interface PowerStandard {
    level: string;
    wKg5s: number;
    wKg1m: number;
    wKg5m: number;
    wKgFtp: number;
}

// Based on Andrew Coggan's Power Profile (Simplified)
export const CYCLING_POWER_PROFILE: { male: PowerStandard[]; female: PowerStandard[] } = {
    male: [
        { level: 'World Class', wKg5s: 24.0, wKg1m: 11.5, wKg5m: 7.6, wKgFtp: 6.0 },
        { level: 'Pro / Elite', wKg5s: 20.0, wKg1m: 10.0, wKg5m: 6.5, wKgFtp: 5.2 },
        { level: 'Excellent (Cat 1/2)', wKg5s: 16.0, wKg1m: 8.5, wKg5m: 5.5, wKgFtp: 4.5 },
        { level: 'Good (Cat 3/4)', wKg5s: 13.0, wKg1m: 7.0, wKg5m: 4.5, wKgFtp: 3.8 },
        { level: 'Moderate', wKg5s: 11.0, wKg1m: 6.0, wKg5m: 3.5, wKgFtp: 3.0 },
        { level: 'Fair', wKg5s: 9.0, wKg1m: 5.0, wKg5m: 3.0, wKgFtp: 2.5 },
        { level: 'Untrained', wKg5s: 7.0, wKg1m: 4.0, wKg5m: 2.5, wKgFtp: 2.0 }
    ],
    female: [
        { level: 'World Class', wKg5s: 19.5, wKg1m: 9.5, wKg5m: 6.4, wKgFtp: 5.3 },
        { level: 'Pro / Elite', wKg5s: 16.5, wKg1m: 8.0, wKg5m: 5.5, wKgFtp: 4.5 },
        { level: 'Excellent (Cat 1/2)', wKg5s: 13.5, wKg1m: 7.0, wKg5m: 4.5, wKgFtp: 3.8 },
        { level: 'Good (Cat 3/4)', wKg5s: 11.0, wKg1m: 6.0, wKg5m: 3.5, wKgFtp: 3.2 },
        { level: 'Moderate', wKg5s: 9.0, wKg1m: 5.0, wKg5m: 2.8, wKgFtp: 2.5 },
        { level: 'Fair', wKg5s: 7.5, wKg1m: 4.0, wKg5m: 2.3, wKgFtp: 2.0 },
        { level: 'Untrained', wKg5s: 6.0, wKg1m: 3.0, wKg5m: 1.8, wKgFtp: 1.5 }
    ]
};

export interface AssaultBikeStandard {
    level: string;
    oneMinCals: number;
    tenMinCals: number;
    twentyMinCals: number; // Approximate
}

// Estimates based on competitive Crossfit standards
export const ASSAULT_BIKE_STANDARDS: { male: AssaultBikeStandard[]; female: AssaultBikeStandard[] } = {
    male: [
        { level: 'Elite', oneMinCals: 70, tenMinCals: 190, twentyMinCals: 350 },
        { level: 'Advanced', oneMinCals: 55, tenMinCals: 160, twentyMinCals: 300 },
        { level: 'Intermediate', oneMinCals: 40, tenMinCals: 130, twentyMinCals: 240 },
        { level: 'Beginner', oneMinCals: 25, tenMinCals: 90, twentyMinCals: 160 }
    ],
    female: [
        { level: 'Elite', oneMinCals: 50, tenMinCals: 150, twentyMinCals: 280 },
        { level: 'Advanced', oneMinCals: 40, tenMinCals: 125, twentyMinCals: 230 },
        { level: 'Intermediate', oneMinCals: 30, tenMinCals: 100, twentyMinCals: 180 },
        { level: 'Beginner', oneMinCals: 18, tenMinCals: 70, twentyMinCals: 120 }
    ]
};
