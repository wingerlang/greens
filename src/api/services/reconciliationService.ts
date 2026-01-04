import { UniversalActivity } from '../../models/types.ts';
import { activityRepo } from '../repositories/activityRepository.ts';
import { createUniversalFromStrava, mapStravaToPerformance, StravaActivity } from '../strava.ts';
import { FeedRepository } from '../repositories/feedRepository.ts';
import { getUserById } from '../db/user.ts';

/**
 * Reconciliation Service
 * Handles the logic of merging external activity data (Strava) with planned activities.
 */
export class ReconciliationService {

    /**
     * Reconcile a list of Strava activities for a user.
     */
    async reconcileStravaActivities(userId: string, stravaActivities: StravaActivity[]): Promise<{
        imported: number;
        merged: number;
        skipped: number;
    }> {
        let imported = 0;
        let merged = 0;
        let skipped = 0;

        const user = await getUserById(userId);
        const privacy = user?.privacy;

        for (const stravaActivity of stravaActivities) {
            const externalId = stravaActivity.id.toString();

            // 1. Check if already exists
            const existing = await activityRepo.getActivityByExternalId(userId, 'strava', externalId);
            if (existing) {
                skipped++;
                continue;
            }

            const dateISO = stravaActivity.start_date_local.split('T')[0];

            // 2. Fetch potential matches (Planned activities for this day)
            const dayActivities = await activityRepo.getActivitiesByDateRange(userId, dateISO, dateISO);
            const candidates = dayActivities.filter(a => a.status === 'PLANNED' && !a.performance);

            // 3. Find Best Match
            const match = this.findBestMatch(stravaActivity, candidates);

            if (match) {
                // MERGE
                await this.mergeActivity(match, stravaActivity);
                merged++;
                await this.emitStravaFeedEvent(userId, stravaActivity, privacy);
            } else {
                // IMPORT AS NEW
                const newActivity = createUniversalFromStrava(stravaActivity, userId);
                await activityRepo.saveActivity(newActivity);
                imported++;
                await this.emitStravaFeedEvent(userId, stravaActivity, privacy);
            }
        }

        return { imported, merged, skipped };
    }

    /**
     * Matching Logic
     */
    private findBestMatch(stravaActivity: StravaActivity, candidates: UniversalActivity[]): UniversalActivity | null {
        if (candidates.length === 0) return null;

        const stravaDistKm = stravaActivity.distance / 1000;
        const stravaType = stravaActivity.type?.toLowerCase();

        const scored = candidates.map(c => {
            let score = 0;
            const planType = c.plan?.activityType;
            if (planType === 'running' && (stravaType === 'run' || stravaType === 'trailrun')) score += 10;
            else if (planType === 'cycling' && (stravaType === 'ride' || stravaType === 'virtualride')) score += 10;
            else return { candidate: c, score: -100 };

            if (c.plan?.distanceKm) {
                const diffKm = Math.abs(c.plan.distanceKm - stravaDistKm);
                const diffPercent = diffKm / c.plan.distanceKm;
                if (diffPercent < 0.10) score += 5;
                else if (diffPercent < 0.25) score += 2;
            }
            return { candidate: c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score > 0) return scored[0].candidate;
        return null;
    }

    /**
     * Merge logic
     */
    private async mergeActivity(target: UniversalActivity, source: StravaActivity) {
        target.status = 'COMPLETED';
        target.performance = mapStravaToPerformance(source);
        target.updatedAt = new Date().toISOString();
        await activityRepo.saveActivity(target);
    }

    /**
     * Helper to emit a feed event for a Strava activity
     */
    private async emitStravaFeedEvent(userId: string, activity: StravaActivity, privacy: any) {
        const typeLabel = (activity.type).replace('Run', 'Löpning').replace('Ride', 'Cykling').replace('Walk', 'Promenad');
        const distanceKm = activity.distance ? (Math.round(activity.distance / 10) / 100) : 0;
        const durationMin = Math.round(activity.elapsed_time / 60);

        const mapping: Record<string, string> = {
            'Run': 'running', 'TrailRun': 'running', 'VirtualRun': 'running',
            'Ride': 'cycling', 'VirtualRide': 'cycling', 'GravelRide': 'cycling',
            'MountainBikeRide': 'cycling', 'Swim': 'swimming', 'Walk': 'walking',
            'Hike': 'walking', 'WeightTraining': 'strength', 'Yoga': 'yoga'
        };

        const appType = mapping[activity.type] || 'other';

        let visibility = 'PUBLIC';
        if (privacy?.sharing?.training) {
            visibility = privacy.sharing.training;
        }

        await FeedRepository.createEvent({
            userId,
            type: 'WORKOUT_CARDIO',
            title: activity.name || typeLabel,
            summary: `${distanceKm ? `${distanceKm.toFixed(1)} km • ` : ''}${durationMin} min`,
            payload: {
                type: 'WORKOUT_CARDIO',
                // @ts-ignore: Payload structure may vary slightly between models
                exerciseType: appType,
                duration: durationMin,
                distance: distanceKm,
                calories: activity.calories || (durationMin * 8),
                intensity: 'moderate'
            },
            visibility: visibility as any,
            timestamp: activity.start_date_local,
            metrics: [
                { label: 'Tid', value: durationMin, unit: 'min', icon: '⏱️' },
                ...(distanceKm ? [{ label: 'Distans', value: distanceKm.toFixed(1), unit: 'km', icon: '📍' }] : []),
                { label: 'Energi', value: Math.round(activity.calories || (durationMin * 8)), unit: 'kcal', icon: '🔥' }
            ]
        });
    }
}

export const reconciliationService = new ReconciliationService();
