import { kv } from "../kv.ts";
import { UniversalActivity } from "../../models/types.ts";

/**
 * Keys used in KV store:
 * Activities: ['activities', userId, dateISO, activityId] -> UniversalActivity
 * Index (Source): ['idx_activities_source', userId, source, externalId] -> activityKey (['activities', ...])
 */

export class ActivityRepository {
  /**
   * Save or update an activity.
   * Automatically manages the source index if externalId exists.
   */
  async saveActivity(activity: UniversalActivity): Promise<void> {
    const primaryKey = [
      "activities",
      activity.userId,
      activity.date,
      activity.id,
    ];

    const atomic = kv.atomic();

    // 1. Save Primary Data
    atomic.set(primaryKey, activity);

    // 2. Manage Secondary Index (Source -> Activity)
    if (
      activity.performance?.source?.externalId &&
      activity.performance.source.source !== "manual"
    ) {
      const indexKey = [
        "idx_activities_source",
        activity.userId,
        activity.performance.source.source,
        activity.performance.source.externalId,
      ];
      atomic.set(indexKey, primaryKey);
    }

    const res = await atomic.commit();
    if (!res.ok) {
      throw new Error("Failed to save activity (KV commit error)");
    }
  }

  /**
   * Get a single activity by ID
   */
  async getActivity(
    userId: string,
    date: string,
    activityId: string,
  ): Promise<UniversalActivity | null> {
    const key = ["activities", userId, date, activityId];
    const res = await kv.get<UniversalActivity>(key);
    return res.value;
  }

  /**
   * Get activities for a date range
   */
  async getActivitiesByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<UniversalActivity[]> {
    const prefix = ["activities", userId];
    // KV list orders lexicographically, so dateISO works perfectly.
    // We use the start and end keys to bound the range.
    const iter = kv.list<UniversalActivity>({
      start: [...prefix, startDate],
      end: [...prefix, endDate + "\uffff"], // Inclusive of the end date
    });

    const activities: UniversalActivity[] = [];
    for await (const entry of iter) {
      activities.push(entry.value);
    }
    return activities;
  }

  /**
   * Get ALL activities for a user (efficient stream)
   */
  async getAllActivities(userId: string): Promise<UniversalActivity[]> {
    const prefix = ["activities", userId];
    const iter = kv.list<UniversalActivity>({ prefix });
    const activities: UniversalActivity[] = [];
    for await (const entry of iter) {
      activities.push(entry.value);
    }
    return activities;
  }

  /**
   * Find an activity by its external ID (e.g., Strava ID)
   * Uses secondary index.
   */
  async getActivityByExternalId(
    userId: string,
    source: string,
    externalId: string,
  ): Promise<UniversalActivity | null> {
    const indexKey = ["idx_activities_source", userId, source, externalId];
    const indexRes = await kv.get<string[]>(indexKey);

    if (!indexRes.value) return null;

    // Follow the pointer
    const activityRes = await kv.get<UniversalActivity>(indexRes.value);
    return activityRes.value;
  }

  /**
   * Delete an activity and clean up indexes
   */
  async deleteActivity(activity: UniversalActivity): Promise<void> {
    const primaryKey = [
      "activities",
      activity.userId,
      activity.date,
      activity.id,
    ];
    const atomic = kv.atomic().delete(primaryKey);

    // Remove index if it exists
    if (activity.performance?.source?.externalId) {
      const indexKey = [
        "idx_activities_source",
        activity.userId,
        activity.performance.source.source,
        activity.performance.source.externalId,
      ];
      atomic.delete(indexKey);
    }

    await atomic.commit();
  }
}

export const activityRepo = new ActivityRepository();
