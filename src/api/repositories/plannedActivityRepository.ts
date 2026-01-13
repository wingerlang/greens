import { kv } from "../kv.ts";
import { PlannedActivity } from "../../models/types.ts";

export class PlannedActivityRepository {

    // Key structure: ['planned_activities', userId, activityId]

    async saveActivity(userId: string, activity: PlannedActivity): Promise<void> {
        await kv.set(["planned_activities", userId, activity.id], activity);
    }

    async saveActivities(userId: string, activities: PlannedActivity[]): Promise<void> {
        const atomic = kv.atomic();
        for (const activity of activities) {
            atomic.set(["planned_activities", userId, activity.id], activity);
        }
        await atomic.commit();
    }

    async getActivity(userId: string, activityId: string): Promise<PlannedActivity | null> {
        const res = await kv.get<PlannedActivity>(["planned_activities", userId, activityId]);
        return res.value;
    }

    async getActivities(userId: string): Promise<PlannedActivity[]> {
        const iter = kv.list<PlannedActivity>({ prefix: ["planned_activities", userId] });
        const activities: PlannedActivity[] = [];
        for await (const entry of iter) {
            activities.push(entry.value);
        }
        return activities;
    }

    async deleteActivity(userId: string, activityId: string): Promise<void> {
        await kv.delete(["planned_activities", userId, activityId]);
    }
}

export const plannedActivityRepo = new PlannedActivityRepository();
