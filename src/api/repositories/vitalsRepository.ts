import { kv } from "../kv.ts";
import { DailyVitals } from "../../models/types.ts";

export class VitalsRepository {
    async saveVitals(userId: string, date: string, vitals: DailyVitals): Promise<void> {
        await kv.set(["vitals", userId, date], vitals);
    }

    async getVitals(userId: string): Promise<Record<string, DailyVitals>> {
        const iter = kv.list<DailyVitals>({ prefix: ["vitals", userId] });
        const vitals: Record<string, DailyVitals> = {};
        for await (const entry of iter) {
            const date = entry.key[entry.key.length - 1] as string;
            vitals[date] = entry.value;
        }
        return vitals;
    }

    async getVitalsInRange(userId: string, start: string, end: string): Promise<Record<string, DailyVitals>> {
        const iter = kv.list<DailyVitals>({ 
            start: ["vitals", userId, start],
            end: ["vitals", userId, end + "z"] // Ensure inclusive end
        });
        const vitals: Record<string, DailyVitals> = {};
        for await (const entry of iter) {
            const date = entry.key[entry.key.length - 1] as string;
            vitals[date] = entry.value;
        }
        return vitals;
    }
}

export const vitalsRepo = new VitalsRepository();
