import { kv } from "../kv.ts";
import { FoodItem } from "../../models/types.ts";

export class FoodRepository {
    async saveFood(food: FoodItem): Promise<void> {
        await kv.set(["foods", food.id], food);
        // Also index by name for search
        await kv.set(["foods_by_name", food.name.toLowerCase()], food.id);
    }

    async getFood(id: string): Promise<FoodItem | null> {
        const res = await kv.get<FoodItem>(["foods", id]);
        return res.value;
    }

    async deleteFood(id: string): Promise<void> {
        const food = await this.getFood(id);
        if (food) {
            await kv.delete(["foods", id]);
            await kv.delete(["foods_by_name", food.name.toLowerCase()]);
        }
    }

    async searchFoods(query: string, limit = 50): Promise<FoodItem[]> {
        const iter = kv.list<FoodItem>({ prefix: ["foods"] });
        const results: FoodItem[] = [];
        const lowQuery = query.toLowerCase();

        for await (const entry of iter) {
            if (entry.value.name.toLowerCase().includes(lowQuery)) {
                results.push(entry.value);
            }
            if (results.length >= limit) break;
        }
        return results;
    }

    async isSeeded(): Promise<boolean> {
        const res = await kv.get(["system", "seeded"]);
        return !!res.value;
    }

    async markAsSeeded(): Promise<void> {
        await kv.set(["system", "seeded"], true);
    }
}

export const foodRepo = new FoodRepository();
