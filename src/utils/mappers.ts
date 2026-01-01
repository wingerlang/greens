import { UniversalActivity, ExerciseEntry, PlannedActivity } from '../models/types.ts';

export function mapUniversalToLegacyEntry(a: UniversalActivity): ExerciseEntry | null {
    if (!a || !a.performance) return null;
    return {
        id: a.id,
        date: a.date,
        type: (a.performance?.activityType || a.plan?.activityType || (a.performance?.source?.source === 'strava' ? 'running' : 'other')) as any,
        durationMinutes: a.performance.durationMinutes,
        intensity: 'moderate', // default
        caloriesBurned: a.performance.calories,
        distance: a.performance.distanceKm,
        createdAt: a.createdAt,
        externalId: a.performance.source?.externalId,
        prCount: a.performance.prCount || 0,
        platform: a.performance.source?.source === 'strava' ? 'strava' : undefined,
        heartRateAvg: a.performance.avgHeartRate,
        heartRateMax: a.performance.maxHeartRate,
        elevationGain: a.performance.elevationGain,
        subType: a.performance.subType || (a.plan?.activityCategory === 'INTERVALS' ? 'interval' : undefined),
        tonnage: undefined, // UniversalActivity doesn't strictly track tonnage yet in performance
        notes: a.performance.notes
    };
}


export function mapUniversalToPlanned(u: UniversalActivity): PlannedActivity {
    return {
        id: u.id,
        date: u.date,
        // If it has a plan, use it. If it's pure Strava, make it a "Completed Plan"
        type: (u.plan?.activityType || 'RUN') as 'RUN', // Defaulting for now
        category: u.plan?.activityCategory || (u.performance?.source?.source === 'strava' ? 'EASY' : 'EASY'),
        title: u.plan?.title || u.performance?.notes || 'Importerat Pass',
        description: u.plan?.description || '',
        structure: u.plan?.structure || { warmupKm: 0, mainSet: [], cooldownKm: 0 },
        targetPace: u.plan?.targetPace || '',
        targetHrZone: u.plan?.targetHrZone || 0,
        estimatedDistance: u.plan?.distanceKm || u.performance?.distanceKm || 0,

        status: u.status as PlannedActivity['status'],
        actualDistance: u.performance?.distanceKm,
        actualTimeSeconds: u.performance?.durationMinutes ? u.performance.durationMinutes * 60 : undefined,
    };
}
