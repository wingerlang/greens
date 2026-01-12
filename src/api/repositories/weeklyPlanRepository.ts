import { kv } from "../kv.ts";
import { WeeklyPlan } from "../../models/types.ts";

export class WeeklyPlanRepository {

    // Key structure: ['weekly_plans', userId, weekStartDate]
    // Since weekStartDate is unique per week (YYYY-MM-DD of Monday), it serves as a good ID for the plan context.

    async savePlan(userId: string, plan: WeeklyPlan): Promise<void> {
        // Ensure the plan belongs to the weekStartDate used in key
        await kv.set(["weekly_plans", userId, plan.weekStartDate], plan);
    }

    async getPlan(userId: string, weekStartDate: string): Promise<WeeklyPlan | null> {
        const res = await kv.get<WeeklyPlan>(["weekly_plans", userId, weekStartDate]);
        return res.value;
    }

    async getPlans(userId: string): Promise<WeeklyPlan[]> {
        const iter = kv.list<WeeklyPlan>({ prefix: ["weekly_plans", userId] });
        const plans: WeeklyPlan[] = [];
        for await (const entry of iter) {
            plans.push(entry.value);
        }
        return plans;
    }

    async deletePlan(userId: string, weekStartDate: string): Promise<void> {
        await kv.delete(["weekly_plans", userId, weekStartDate]);
    }
}

export const weeklyPlanRepo = new WeeklyPlanRepository();
