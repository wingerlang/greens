import { kv } from "../kv.ts";
import { MealEntry } from "../../models/types.ts";

export class MealRepository {
    async saveMeal(userId: string, meal: MealEntry): Promise<void> {
        // Primary key: [meals, userId, date, id]
        // This allows range queries by date for a specific user
        await kv.set(["meals", userId, meal.date, meal.id], meal);
    }

    async getMealsByDate(userId: string, date: string): Promise<MealEntry[]> {
        const iter = kv.list<MealEntry>({ prefix: ["meals", userId, date] });
        const meals: MealEntry[] = [];
        for await (const entry of iter) {
            meals.push(entry.value);
        }
        return meals;
    }

    async getMealsInRange(userId: string, startDate: string, endDate: string): Promise<MealEntry[]> {
        const iter = kv.list<MealEntry>({
            start: ["meals", userId, startDate],
            end: ["meals", userId, endDate + "\uffff"]
        });
        const meals: MealEntry[] = [];
        for await (const entry of iter) {
            meals.push(entry.value);
        }
        return meals;
    }

    async deleteMeal(userId: string, date: string, id: string): Promise<void> {
        await kv.delete(["meals", userId, date, id]);
    }
}

export const mealRepo = new MealRepository();
