import { kv } from "../kv.ts";
import { TrainingPeriod } from "../../models/types.ts";

export const periodRepo = {
    async getPeriods(userId: string): Promise<TrainingPeriod[]> {
        const iter = kv.list<TrainingPeriod>({ prefix: ["periods", userId] });
        const periods: TrainingPeriod[] = [];
        for await (const res of iter) {
            periods.push(res.value);
        }
        // Sort by start date desc
        return periods.sort((a, b) => b.startDate.localeCompare(a.startDate));
    },

    async savePeriod(userId: string, period: TrainingPeriod): Promise<void> {
        await kv.set(["periods", userId, period.id], period);
    },

    async deletePeriod(userId: string, periodId: string): Promise<void> {
        await kv.delete(["periods", userId, periodId]);
    }
};
