import { UniversalActivity } from '../../models/types.ts';
import { activityRepo } from '../repositories/activityRepository.ts';
import { createUniversalFromStrava, mapStravaToPerformance, StravaActivity, getAllStravaActivities } from '../strava.ts';
import { FeedRepository } from '../repositories/feedRepository.ts';
import { getUserById } from '../db/user.ts';

export interface SyncDiffReport {
    newActivities: StravaActivity[];
    changedActivities: { strava: StravaActivity; existing: UniversalActivity; changes: string[] }[];
    matchedCount: number;
    totalStrava: number;
}

/**
 * Reconciliation Service
 * Handles the logic of merging external activity data (Strava) with planned activities.
 */
export class ReconciliationService {

    /**
     * Scan Strava activities and report differences without saving.
     */
    async scanStravaActivities(userId: string, accessToken: string, options: { fromDate?: string } = {}): Promise<SyncDiffReport> {
        // 1. Fetch Local Activities
        const localActivities = await activityRepo.getAllActivities(userId);
        const localMap = new Map<string, UniversalActivity>();

        // Map by External ID (strava_12345)
        localActivities.forEach(a => {
            if (a.performance?.source?.source === 'strava' && a.performance.source.externalId) {
                localMap.set(a.performance.source.externalId, a);
            }
        });

        // 2. Fetch All Strava Activities (filtered by date if provided)
        const fetchOptions: { after?: number } = {};
        if (options.fromDate) {
            fetchOptions.after = Math.floor(new Date(options.fromDate).getTime() / 1000);
        }

        const stravaActivities = await getAllStravaActivities(accessToken, fetchOptions);

        // 3. Diff
        const report: SyncDiffReport = {
            newActivities: [],
            changedActivities: [],
            matchedCount: 0,
            totalStrava: stravaActivities.length
        };

        for (const s of stravaActivities) {
            const externalId = s.id.toString();
            const existing = localMap.get(externalId);

            if (!existing) {
                report.newActivities.push(s);
            } else {
                // Check for significant differences (e.g. Elapsed Time fix)
                const changes: string[] = [];

                // Compare Duration (Elapsed vs stored)
                const stravaDurationMin = Math.round(s.elapsed_time / 60);
                if (Math.abs(stravaDurationMin - (existing.performance?.durationMinutes || 0)) > 1) {
                    changes.push(`Duration: ${existing.performance?.durationMinutes} -> ${stravaDurationMin} min`);
                }

                if (changes.length > 0) {
                    report.changedActivities.push({ strava: s, existing, changes });
                } else {
                    report.matchedCount++;
                }
            }
        }

        return report;
    }

    /**
     * Import or Update specific activities
     */
    async syncActivities(
        userId: string,
        activitiesToSync: StravaActivity[],
        options: { forceUpdate?: boolean } = {}
    ): Promise<{ created: number; updated: number; failed: number }> {
        let created = 0;
        let updated = 0;
        let failed = 0;
        const user = await getUserById(userId);

        for (const stravaActivity of activitiesToSync) {
            try {
                const externalId = stravaActivity.id.toString();
                const existing = await activityRepo.getActivityByExternalId(userId, 'strava', externalId);

                if (!existing) {
                    // CREATE NEW
                    // Try to match with Plan first (Legacy logic)
                    const dateISO = stravaActivity.start_date_local.split('T')[0];
                    const candidates = await activityRepo.getActivitiesByDateRange(userId, dateISO, dateISO);
                    const planMatch = this.findBestMatch(stravaActivity, candidates.filter(c => c.status === 'PLANNED'));

                    if (planMatch) {
                        await this.mergeActivity(planMatch, stravaActivity);
                        created++; // Count as created/synced
                    } else {
                        const newActivity = createUniversalFromStrava(stravaActivity, userId);
                        await activityRepo.saveActivity(newActivity);
                        created++;
                    }
                    // Emit feed event for new stuff
                    await this.emitStravaFeedEvent(userId, stravaActivity, user?.privacy);

                } else if (options.forceUpdate) {
                    // UPDATE EXISTING
                    // Protect Merge Info?
                    // If activity is merged (has `mergeInfo`), we verify if we should touch it.
                    // Actually, if we update performance data from Strava, the merge is still valid (Planned + Strava Perf).
                    // We just update the `performance` section.

                    // Update performance data
                    const freshPerformance = mapStravaToPerformance(stravaActivity);

                    // Maintain existing sub-fields if needed? 
                    // Usually fresh mapped data is better.

                    existing.performance = {
                        ...existing.performance,
                        ...freshPerformance,
                        // Preserve any manually added notes?
                        notes: existing.performance?.notes || freshPerformance.notes
                    };
                    existing.updatedAt = new Date().toISOString();

                    await activityRepo.saveActivity(existing);
                    updated++;
                }
            } catch (err) {
                console.error(`Failed to sync activity ${stravaActivity.id}`, err);
                failed++;
            }
        }

        return { created, updated, failed };
    }

    /**
     * Reconcile a list of Strava activities for a user (Legacy/Auto mode)
     */
    async reconcileStravaActivities(userId: string, stravaActivities: StravaActivity[]): Promise<{
        imported: number;
        merged: number;
        skipped: number;
    }> {
        const report = await this.scanStravaActivities(userId, '', { fromDate: stravaActivities[0]?.start_date }); // Roughly
        // ... (We could reimplement this using syncActivities, but keep legacy for now if needed)
        // Actually, let's keep the existing logic intact for now or forward to sync?

        // Re-implementing logic to be safe and compatible with previous code
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
        // Only emit if recent (last 3 days)
        const date = new Date(activity.start_date_local);
        const now = new Date();
        const daysDiff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
        if (daysDiff > 3) return;

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
