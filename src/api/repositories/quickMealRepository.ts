import { kv } from "../kv.ts";
import { QuickMeal } from "../../models/types.ts";

export class QuickMealRepository {
    async saveQuickMeal(userId: string, meal: QuickMeal): Promise<void> {
        // Key: [quick_meals, userId, id]
        // This allows listing all quick meals for a user
        await kv.set(["quick_meals", userId, meal.id], { ...meal, userId });
    }

    async getQuickMeals(userId: string): Promise<QuickMeal[]> {
        const iter = kv.list<QuickMeal>({ prefix: ["quick_meals", userId] });
        const meals: QuickMeal[] = [];
        for await (const entry of iter) {
            meals.push(entry.value);
        }
        return meals;
    }

    async deleteQuickMeal(userId: string, id: string): Promise<void> {
        await kv.delete(["quick_meals", userId, id]);
    }
}

export const quickMealRepo = new QuickMealRepository();
