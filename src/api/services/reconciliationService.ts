import { UniversalActivity } from '../../models/types.ts';
import { activityRepo } from '../repositories/activityRepository.ts';
import { createUniversalFromStrava, mapStravaToPerformance, StravaActivity } from '../strava.ts';

/**
 * Reconciliation Service
 * Handles the logic of merging external activity data (Strava) with planned activities.
 */
export class ReconciliationService {

    /**
     * Reconcile a list of Strava activities for a user.
     * Iterates through Strava activities and:
     * 1. Checks if already imported (via secondary index).
     * 2. If new, looks for a matching Planned activity on the same date.
     * 3. Merges or Creates accordingly.
     */
    async reconcileStravaActivities(userId: string, stravaActivities: StravaActivity[]): Promise<{
        imported: number;
        merged: number;
        skipped: number;
    }> {
        let imported = 0;
        let merged = 0;
        let skipped = 0;

        for (const stravaActivity of stravaActivities) {
            const externalId = stravaActivity.id.toString();

            // 1. Check if already exists
            const existing = await activityRepo.getActivityByExternalId(userId, 'strava', externalId);
            if (existing) {
                // Already imported. We could update it here if needed, but for now skip.
                skipped++;
                continue;
            }

            const dateISO = stravaActivity.start_date_local.split('T')[0];

            // 2. Fetch potential matches (Planned activities for this day)
            // We fetch the full day's activities.
            const dayActivities = await activityRepo.getActivitiesByDateRange(userId, dateISO, dateISO);
            const candidates = dayActivities.filter(a => a.status === 'PLANNED' && !a.performance);

            // 3. Find Best Match
            const match = this.findBestMatch(stravaActivity, candidates);

            if (match) {
                // MERGE
                await this.mergeActivity(match, stravaActivity);
                merged++;
            } else {
                // IMPORT AS NEW
                const newActivity = createUniversalFromStrava(stravaActivity, userId);
                await activityRepo.saveActivity(newActivity);
                imported++;
            }
        }

        return { imported, merged, skipped };
    }

    /**
     * Matching Logic
     * Returns the best candidate or null.
     */
    private findBestMatch(stravaActivity: StravaActivity, candidates: UniversalActivity[]): UniversalActivity | null {
        if (candidates.length === 0) return null;

        const stravaDistKm = stravaActivity.distance / 1000;
        const stravaType = stravaActivity.type?.toLowerCase(); // 'run', 'ride'

        // Score candidates
        const scored = candidates.map(c => {
            let score = 0;

            // Type Match (Critical)
            // Note: Our UniversalActivity plan uses 'running', Strava uses 'Run'. 
            // Simple check for now.
            const planType = c.plan?.activityType;
            if (planType === 'running' && (stravaType === 'run' || stravaType === 'trailrun')) score += 10;
            else if (planType === 'cycling' && (stravaType === 'ride' || stravaType === 'virtualride')) score += 10;
            else return { candidate: c, score: -100 }; // Wrong sport

            // Distance Match
            if (c.plan?.distanceKm) {
                const diffKm = Math.abs(c.plan.distanceKm - stravaDistKm);
                const diffPercent = diffKm / c.plan.distanceKm;

                if (diffPercent < 0.10) score += 5; // Within 10%
                else if (diffPercent < 0.25) score += 2; // Within 25%
            }

            return { candidate: c, score };
        });

        // best match must have positive score
        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score > 0) return scored[0].candidate;

        return null;
    }

    /**
     * Merge logic: Update existing Planned activity with Performance data
     */
    private async mergeActivity(target: UniversalActivity, source: StravaActivity) {
        // Update status and performance
        target.status = 'COMPLETED';
        target.performance = mapStravaToPerformance(source);
        target.updatedAt = new Date().toISOString();

        // Save
        await activityRepo.saveActivity(target);
    }
}

export const reconciliationService = new ReconciliationService();
