import { kv } from "../kv.ts";
import { Recipe } from "../../models/types.ts";

export class RecipeRepository {
    async saveRecipe(userId: string, recipe: Recipe): Promise<void> {
        await kv.set(["recipes", userId, recipe.id], recipe);
    }

    async getRecipe(userId: string, recipeId: string): Promise<Recipe | null> {
        const res = await kv.get<Recipe>(["recipes", userId, recipeId]);
        return res.value;
    }

    async getRecipes(userId: string): Promise<Recipe[]> {
        const iter = kv.list<Recipe>({ prefix: ["recipes", userId] });
        const recipes: Recipe[] = [];
        for await (const entry of iter) {
            recipes.push(entry.value);
        }
        return recipes;
    }

    async deleteRecipe(userId: string, recipeId: string): Promise<void> {
        await kv.delete(["recipes", userId, recipeId]);
    }
}

export const recipeRepo = new RecipeRepository();
