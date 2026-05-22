import { foodRepo } from "../repositories/foodRepository.ts";
import { FoodItem } from "../../models/types.ts";

export interface FileSystemInterface {
    rename(oldPath: string, newPath: string): Promise<void>;
    remove(path: string): Promise<void>;
}

export class FoodService {
    private repo: typeof foodRepo;
    private fs: FileSystemInterface;

    constructor(
        repo: typeof foodRepo = foodRepo,
        fs: FileSystemInterface = {
            rename: async (oldPath, newPath) => {
                await Deno.rename(oldPath, newPath);
            },
            remove: async (path) => {
                await Deno.remove(path);
            }
        }
    ) {
        this.repo = repo;
        this.fs = fs;
    }

    async searchFoods(query: string): Promise<FoodItem[]> {
        return await this.repo.searchFoods(query);
    }

    async getFood(id: string): Promise<FoodItem | null> {
        return await this.repo.getFood(id);
    }

    async createFood(item: FoodItem): Promise<FoodItem> {
        // Handle Image Moving (Temp -> Permanent)
        if (item.imageUrl && item.imageUrl.startsWith("uploads/temp/")) {
            const oldPath = item.imageUrl;
            const newPath = oldPath.replace("uploads/temp/", "uploads/food-images/");
            try {
                await this.fs.rename(oldPath, newPath);
                item.imageUrl = newPath;
            } catch (e) {
                console.error("Failed to move image:", e);
                // Keep temp URL to avoid data loss on error
            }
        }

        await this.repo.saveFood(item);
        return item;
    }

    async updateFood(id: string, updates: Partial<FoodItem>): Promise<FoodItem | null> {
        const existing = await this.repo.getFood(id);
        if (!existing) return null;

        const updatedItem = { ...existing, ...updates };

        // Handle Image Moving
        if (updatedItem.imageUrl && updatedItem.imageUrl.startsWith("uploads/temp/")) {
            const oldPath = updatedItem.imageUrl;
            const newPath = oldPath.replace("uploads/temp/", "uploads/food-images/");
            try {
                await this.fs.rename(oldPath, newPath);
                updatedItem.imageUrl = newPath;

                // Delete old image if it existed and was different
                if (existing.imageUrl && existing.imageUrl !== updatedItem.imageUrl && existing.imageUrl.startsWith("uploads/")) {
                    try {
                        await this.fs.remove(existing.imageUrl);
                    } catch (e) {
                        console.error("Failed to remove old image:", e);
                    }
                }
            } catch (e) {
                console.error("Failed to move image:", e);
            }
        }

        await this.repo.saveFood(updatedItem);
        return updatedItem;
    }

    async deleteFood(id: string): Promise<boolean> {
        const existing = await this.repo.getFood(id);
        if (!existing) return false;

        await this.repo.deleteFood(id);
        return true;
    }
}

export const foodService = new FoodService();
