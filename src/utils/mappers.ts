import { UniversalActivity, ExerciseEntry, PlannedActivity } from '../models/types.ts';

export function mapUniversalToLegacyEntry(a: UniversalActivity): ExerciseEntry | null {
    if (!a || !a.performance) return null;
    let finalType = (a.performance?.activityType || a.plan?.activityType || (a.performance?.source?.source === 'strava' ? 'running' : 'other')) as any;
    const titleObj = a.plan?.title || a.performance?.notes || '';

    // Retroactive fix for existing "Cardio: xxx" workouts AND Strava activities incorrectly saved as strength
    if (finalType === 'strength' || finalType === 'workout' || finalType === 'other' || finalType === 'cardio') {
        const lowerTitle = titleObj.toLowerCase();
        const isFromStrava = a.performance?.source?.source === 'strava';
        const hasCardioPrefix = /^cardio\b/i.test(titleObj);

        if (hasCardioPrefix || isFromStrava) {
            if (lowerTitle.includes('cycl') || lowerTitle.includes('cyk') || lowerTitle.includes('bike') || lowerTitle.includes('ride')) finalType = 'cycling';
            else if (lowerTitle.includes('run') || lowerTitle.includes('löp')) finalType = 'running';
            else if (lowerTitle.includes('walk') || lowerTitle.includes('gång')) finalType = 'walking';
            else if (hasCardioPrefix) finalType = 'cardio';
        }
    }

    return {
        id: a.id,
        date: a.date,
        type: finalType,
        durationMinutes: a.performance.durationMinutes,
        intensity: 'moderate', // default
        caloriesBurned: a.performance.calories,
        calorieBreakdown: a.performance.calorieBreakdown,
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
        title: a.plan?.title || a.performance?.notes || (a.performance?.source?.externalId ? 'Strava Activity' : undefined), // Use notes as title if plan title missing
        // If we moved notes to title, should we clear notes? User said "irrelevant". 
        // But notes might simply contain the title. safely keep it for now or duplicate.
        // Actually, if title IS notes, maybe clear notes? Let's keep duplicate for safety unless it looks ugly.
        // User said: "Det som ligger under 'ANTECKNING' är det riktiga namnet."
        averageWatts: a.performance.averageWatts,
        maxWatts: a.performance.maxWatts,
        averageSpeed: a.performance.averageSpeed,
        startTime: a.performance.startTimeLocal ? a.performance.startTimeLocal.split('T')[1]?.substring(0, 5) : undefined,
        notes: a.performance.notes !== a.plan?.title ? a.performance.notes : undefined,
        excludeFromStats: a.performance.excludeFromStats,
        hyroxStats: (a.performance as any).hyroxStats,
        source: a.performance.source?.source || 'unknown',
        splits: a.performance.splits,
        laps: a.performance.laps,
        raceDetails: a.raceDetails || a.performance.raceDetails || a.plan?.raceDetails,
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
        raceDetails: u.raceDetails || u.plan?.raceDetails || u.performance?.raceDetails,
    };
}
