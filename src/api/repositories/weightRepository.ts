import { kv } from "../kv.ts";
import { WeightEntry } from "../../models/types.ts";

export class WeightRepository {
    async saveWeight(userId: string, entry: WeightEntry): Promise<void> {
        await kv.set(["weight", userId, entry.date, entry.id], entry);
    }

    async getWeightHistory(userId: string): Promise<WeightEntry[]> {
        const iter = kv.list<WeightEntry>({ prefix: ["weight", userId] });
        const history: WeightEntry[] = [];
        for await (const entry of iter) {
            history.push(entry.value);
        }
        // sort by date descending
        return history.sort((a, b) => b.date.localeCompare(a.date));
    }

    async deleteWeight(userId: string, date: string, id: string): Promise<void> {
        await kv.delete(["weight", userId, date, id]);
    }
}

export const weightRepo = new WeightRepository();
