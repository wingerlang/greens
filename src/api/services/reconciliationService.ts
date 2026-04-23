import { UniversalActivity } from '../../models/types.ts';
import { activityRepo } from '../repositories/activityRepository.ts';
import { 
    createUniversalFromStrava, 
    mapStravaToPerformance, 
    StravaActivity, 
    getAllStravaActivities, 
    calculateStravaCalories, 
    getStravaActivityDetail,
    mapStravaType
} from '../strava.ts';
import { FeedRepository } from '../repositories/feedRepository.ts';
import { getUserById } from '../db/user.ts';
import { getUserData } from '../db/data.ts';

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

                // Compare Duration (Moving vs stored)
                const stravaDurationMin = (s.moving_time || s.elapsed_time) / 60;
                const existingDuration = existing.performance?.durationMinutes || 0;
                if (Math.abs(stravaDurationMin - existingDuration) > 0.1) {
                    changes.push(`Duration: ${existingDuration.toFixed(1)} -> ${stravaDurationMin.toFixed(1)} min`);
                }

                // Compare Description (important for power parsing)
                if ((s.description || "") !== (existing.performance?.notes || "")) {
                    changes.push(`Beskrivning ändrad`);
                }
                
                // Compare Title
                if (s.name !== (existing.plan?.title || existing.performance?.source?.externalId)) {
                    // Check if it's a generic name or something
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
        options: { forceUpdate?: boolean, accessToken?: string } = {}
    ): Promise<{ created: number; updated: number; failed: number }> {
        let created = 0;
        let updated = 0;
        let failed = 0;
        const user = await getUserById(userId);
        const userData = await getUserData(userId) as any;
        const latestWeight = userData?.weightEntries?.[0]?.weight;

        for (const stravaActivity of activitiesToSync) {
            try {
                const externalId = stravaActivity.id.toString();
                const existing = await activityRepo.getActivityByExternalId(userId, 'strava', externalId);

                if (!existing) {
                    // CREATE NEW
                    // FETCH DETAIL IF RUN (for best_efforts & splits)
                    let detailedActivity = stravaActivity;
                    const activityType = mapStravaType(stravaActivity.type, stravaActivity.name, stravaActivity.description);
                    if (options.accessToken && activityType === 'running' && !stravaActivity.best_efforts) {
                        const detail = await getStravaActivityDetail(stravaActivity.id, options.accessToken);
                        if (detail) detailedActivity = detail;
                    }

                    const dateISO = detailedActivity.start_date_local.split('T')[0];
                    const candidates = await activityRepo.getActivitiesByDateRange(userId, dateISO, dateISO);
                    const planMatch = this.findBestMatch(detailedActivity, candidates.filter(c => c.status === 'PLANNED'));

                    if (planMatch) {
                        await this.mergeActivity(planMatch, detailedActivity, user?.settings);
                        created++;
                    } else {
                        const newActivity = createUniversalFromStrava(detailedActivity, userId, user?.settings, latestWeight);
                        await activityRepo.saveActivity(newActivity);
                        created++;
                    }
                    // Emit feed event for new stuff
                    await this.emitStravaFeedEvent(userId, detailedActivity, user?.privacy);

                } else if (options.forceUpdate) {
                    // UPDATE EXISTING
                    let detailedActivity = stravaActivity;
                    const activityType = mapStravaType(stravaActivity.type, stravaActivity.name, stravaActivity.description);
                    if (options.accessToken && activityType === 'running' && !stravaActivity.best_efforts) {
                        const detail = await getStravaActivityDetail(stravaActivity.id, options.accessToken);
                        if (detail) detailedActivity = detail;
                    }

                    const freshPerformance = mapStravaToPerformance(detailedActivity, user?.settings, latestWeight);

                    existing.performance = {
                        ...existing.performance,
                        ...freshPerformance,
                        // Favors fresh notes if forceUpdate is true (syncing changes from Strava)
                        notes: freshPerformance.notes || existing.performance?.notes,
                        subType: existing.performance?.subType || freshPerformance.subType,
                        excludeFromStats: existing.performance?.excludeFromStats
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
        const userData = await getUserData(userId) as any;
        const latestWeight = userData?.weightEntries?.[0]?.weight;
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
                await this.mergeActivity(match, stravaActivity, user?.settings);
                merged++;
                await this.emitStravaFeedEvent(userId, stravaActivity, user);
            } else {
                // IMPORT AS NEW
                const newActivity = createUniversalFromStrava(stravaActivity, userId, user?.settings, latestWeight);
                await activityRepo.saveActivity(newActivity);
                imported++;
                await this.emitStravaFeedEvent(userId, stravaActivity, user);
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
        const stravaDurationMin = (stravaActivity.moving_time || stravaActivity.elapsed_time) / 60;
        const stravaType = mapStravaType(stravaActivity.type, stravaActivity.name, stravaActivity.description);
        const stravaTitleLower = (stravaActivity.name || '').toLowerCase();

        const scored = candidates.map(c => {
            let score = 0;
            const planType = c.plan?.activityType;
            const planTitleLower = (c.plan?.title || '').toLowerCase();

            // 1. TYPE MATCH (Strong signal)
            if (planType === stravaType) {
                // Base score for correct type is now enough to trigger match if no other signals
                score += 20; 
            } else if (
                (planType === 'running' && (stravaType === 'running' || stravaType === 'walking')) ||
                (planType === 'cardio' && (stravaType === 'running' || stravaType === 'cycling' || stravaType === 'other')) ||
                (planType === 'strength' && (stravaType === 'other'))
            ) {
                // Approximate type match
                score += 10;
            } else {
                // Type mismatch penalty
                score -= 10;
            }

            // 2. TITLE SIMILARITY
            const titleMatchScore = this.calculateTitleSimilarity(stravaTitleLower, planTitleLower);
            score += titleMatchScore * 30;

            // 3. DURATION MATCH
            if (c.plan?.durationMinutes && stravaDurationMin > 0) {
                const diffMin = Math.abs(c.plan.durationMinutes - stravaDurationMin);
                const diffPercent = diffMin / c.plan.durationMinutes;
                
                // Be lenient with over-performing (extension)
                if (diffPercent < 0.15) score += 15;
                else if (diffPercent < 0.40) score += 8;
                else if (stravaDurationMin > c.plan.durationMinutes && diffPercent < 0.60) {
                    // User ran longer than planned - this is often a match
                    score += 5;
                }
            }

            // 4. DISTANCE MATCH
            if (c.plan?.distanceKm && stravaDistKm > 0) {
                const diffKm = Math.abs(c.plan.distanceKm - stravaDistKm);
                const diffPercent = diffKm / c.plan.distanceKm;

                if (diffPercent < 0.15) score += 15;
                else if (diffPercent < 0.40) score += 8;
                else if (stravaDistKm > c.plan.distanceKm && diffPercent < 0.60) {
                    // User ran further than planned (like 8km -> 10.9km)
                    score += 5;
                }
            }
            
            // 5. UNIQUENESS BOOST
            // If this is the only plan of this type, give it a tiny boost
            const sameTypePlans = candidates.filter(cand => cand.plan?.activityType === stravaType);
            if (sameTypePlans.length === 1 && planType === stravaType) {
                score += 5;
            }

            return { candidate: c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        
        // Threshold check
        if (scored[0].score >= 18) return scored[0].candidate;
        return null;
    }

    /**
     * Helper to calculate similarity between two titles using word overlap
     */
    private calculateTitleSimilarity(titleA: string, titleB: string): number {
        if (!titleA || !titleB) return 0;
        
        const wordsA = new Set(titleA.split(/[\s:,\-_()]+/).filter(w => w.length > 2));
        const wordsB = new Set(titleB.split(/[\s:,\-_()]+/).filter(w => w.length > 2));
        
        if (wordsA.size === 0 || wordsB.size === 0) return 0;
        
        let matches = 0;
        wordsA.forEach(w => {
            if (wordsB.has(w)) matches++;
        });
        
        return matches / Math.max(wordsA.size, wordsB.size);
    }

    /**
     * Merge logic
     */
    private async mergeActivity(target: UniversalActivity, source: StravaActivity, userSettings?: any) {
        target.status = 'COMPLETED';
        target.performance = mapStravaToPerformance(source, userSettings);
        target.updatedAt = new Date().toISOString();
        await activityRepo.saveActivity(target);
    }

    /**
     * Helper to emit a feed event for a Strava activity
     */
    private async emitStravaFeedEvent(userId: string, activity: StravaActivity, user: any) {
        const privacy = user?.privacy;
        const userSettings = user?.settings;
        const userData = await getUserData(userId) as any;
        const latestWeight = userData?.weightEntries?.[0]?.weight;
        // Only emit if recent (last 3 days)
        const date = new Date(activity.start_date_local);
        const now = new Date();
        const daysDiff = (now.getTime() - date.getTime()) / (1000 * 3600 * 24);
        if (daysDiff > 3) return;

        const typeLabel = (activity.type).replace('Run', 'Löpning').replace('Ride', 'Cykling').replace('Walk', 'Promenad');
        const distanceKm = activity.distance ? (Math.round(activity.distance / 10) / 100) : 0;
        const durationMinFormatted = ((activity.moving_time || activity.elapsed_time) / 60).toFixed(1);
        const durationMin = (activity.moving_time || activity.elapsed_time) / 60;

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
            summary: `${distanceKm ? `${distanceKm.toFixed(1)} km • ` : ''}${durationMinFormatted} min`,
            payload: {
                type: 'WORKOUT_CARDIO',
                // @ts-ignore: Payload structure may vary slightly between models
                exerciseType: appType,
                duration: durationMin,
                distance: distanceKm,
                calories: calculateStravaCalories(activity, userSettings, latestWeight).calories,
                intensity: 'moderate'
            },
            visibility: visibility as any,
            timestamp: activity.start_date_local,
            metrics: [
                { label: 'Tid', value: durationMin, unit: 'min', icon: '⏱️' },
                ...(distanceKm ? [{ label: 'Distans', value: distanceKm.toFixed(1), unit: 'km', icon: '📍' }] : []),
                { label: 'Energi', value: Math.round(calculateStravaCalories(activity, userSettings, latestWeight).calories), unit: 'kcal', icon: '🔥' }
            ]
        });
    }

    /**
     * Backfill missing best efforts for running activities
     */
    async backfillBestEfforts(userId: string, accessToken: string, year: string): Promise<{ updated: number; skipped: number; failed: number }> {
        const activities = await activityRepo.getAllActivities(userId);
        const toBackfill = activities.filter(a => 
            a.date.startsWith(year) && 
            a.performance?.activityType === 'running' && 
            (!a.performance?.bestEfforts || a.performance.bestEfforts.length === 0) &&
            a.performance?.source?.source === 'strava'
        );

        let updated = 0;
        let skipped = 0;
        let failed = 0;

        for (const activity of toBackfill) {
            try {
                const stravaId = parseInt(activity.performance?.source?.externalId || '', 10);
                if (isNaN(stravaId)) {
                    skipped++;
                    continue;
                }

                const detail = await getStravaActivityDetail(stravaId, accessToken);
                if (detail && detail.best_efforts) {
                    const freshPerformance = mapStravaToPerformance(detail);
                    activity.performance = {
                        ...activity.performance,
                        ...freshPerformance,
                        // Preserve overrides
                        notes: activity.performance?.notes || freshPerformance.notes,
                        subType: activity.performance?.subType || freshPerformance.subType,
                        excludeFromStats: activity.performance?.excludeFromStats
                    } as any;
                    activity.updatedAt = new Date().toISOString();
                    await activityRepo.saveActivity(activity);
                    updated++;
                } else {
                    skipped++;
                }
                
                // Rate limit protection
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                console.error(`Backfill failed for activity ${activity.id}`, err);
                failed++;
            }
        }

        return { updated, skipped, failed };
    }
}

export const reconciliationService = new ReconciliationService();
