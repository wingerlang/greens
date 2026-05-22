import { assertEquals, assert } from "@std/assert";
import { FoodService, FileSystemInterface } from "../../src/api/services/foodService.ts";
import { FoodItem } from "../../src/models/types.ts";
import { FoodRepository } from "../../src/api/repositories/foodRepository.ts";

// Create concrete Mock Repository
class MockFoodRepository extends FoodRepository {
    public foods = new Map<string, FoodItem>();
    public saveCalled = false;
    public deleteCalled = false;

    override async saveFood(food: FoodItem): Promise<void> {
        this.saveCalled = true;
        this.foods.set(food.id, food);
    }

    override async getFood(id: string): Promise<FoodItem | null> {
        return this.foods.get(id) || null;
    }

    override async deleteFood(id: string): Promise<void> {
        this.deleteCalled = true;
        const food = this.foods.get(id);
        if (food) {
            food.deletedAt = new Date().toISOString();
        }
    }

    override async searchFoods(query: string): Promise<FoodItem[]> {
        const results: FoodItem[] = [];
        for (const item of this.foods.values()) {
            if (!item.deletedAt && item.name.toLowerCase().includes(query.toLowerCase())) {
                results.push(item);
            }
        }
        return results;
    }
}

// Create concrete Mock FileSystem
class MockFileSystem implements FileSystemInterface {
    public renameCalls: { oldPath: string; newPath: string }[] = [];
    public removeCalls: string[] = [];
    public throwOnRename = false;

    async rename(oldPath: string, newPath: string): Promise<void> {
        if (this.throwOnRename) {
            throw new Error("Disk Full");
        }
        this.renameCalls.push({ oldPath, newPath });
    }

    async remove(path: string): Promise<void> {
        this.removeCalls.push(path);
    }
}

const mockFoodItem: FoodItem = {
    id: "food-1",
    name: "Avocado",
    calories: 160,
    protein: 2,
    carbs: 9,
    fat: 15,
    unit: "pcs",
    category: "fruits",
    createdAt: "",
    updatedAt: ""
};

Deno.test("FoodService - searchFoods and getFood delegating properly", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    await mockRepo.saveFood(mockFoodItem);

    const searchRes = await service.searchFoods("avoc");
    assertEquals(searchRes.length, 1);
    assertEquals(searchRes[0].id, "food-1");

    const getRes = await service.getFood("food-1");
    assert(getRes !== null);
    assertEquals(getRes?.name, "Avocado");
});

Deno.test("FoodService - createFood: standard flow (no image)", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    const created = await service.createFood({ ...mockFoodItem });
    assertEquals(created.id, "food-1");
    assert(mockRepo.saveCalled);
    assertEquals(mockFs.renameCalls.length, 0);
});

Deno.test("FoodService - createFood: with image in temp directory", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    const itemWithTempImage: FoodItem = {
        ...mockFoodItem,
        imageUrl: "uploads/temp/some-random-uuid.png"
    };

    const created = await service.createFood(itemWithTempImage);
    assertEquals(created.imageUrl, "uploads/food-images/some-random-uuid.png");
    assertEquals(mockFs.renameCalls.length, 1);
    assertEquals(mockFs.renameCalls[0].oldPath, "uploads/temp/some-random-uuid.png");
    assertEquals(mockFs.renameCalls[0].newPath, "uploads/food-images/some-random-uuid.png");
    assert(mockRepo.saveCalled);
});

Deno.test("FoodService - createFood: handling rename error safely", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    mockFs.throwOnRename = true;
    const service = new FoodService(mockRepo as any, mockFs);

    const itemWithTempImage: FoodItem = {
        ...mockFoodItem,
        imageUrl: "uploads/temp/some-random-uuid.png"
    };

    const created = await service.createFood(itemWithTempImage);
    // Should keep temp URL as fallback rather than crashing
    assertEquals(created.imageUrl, "uploads/temp/some-random-uuid.png");
    assert(mockRepo.saveCalled);
});

Deno.test("FoodService - updateFood: not found returns null", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    const res = await service.updateFood("non-existent", { name: "New Name" });
    assertEquals(res, null);
});

Deno.test("FoodService - updateFood: standard updates", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    await mockRepo.saveFood({ ...mockFoodItem });

    const updated = await service.updateFood("food-1", { calories: 180, name: "Super Avocado" });
    assert(updated !== null);
    assertEquals(updated?.calories, 180);
    assertEquals(updated?.name, "Super Avocado");
    assertEquals(updated?.protein, 2); // Unmodified field should be retained from merge
});

Deno.test("FoodService - updateFood: updates image and removes old image", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    const existingItem: FoodItem = {
        ...mockFoodItem,
        imageUrl: "uploads/food-images/old-image.png"
    };
    await mockRepo.saveFood(existingItem);

    const updated = await service.updateFood("food-1", {
        imageUrl: "uploads/temp/new-image-temp.png"
    });

    assert(updated !== null);
    assertEquals(updated?.imageUrl, "uploads/food-images/new-image-temp.png");

    // Check rename of new image
    assertEquals(mockFs.renameCalls.length, 1);
    assertEquals(mockFs.renameCalls[0].oldPath, "uploads/temp/new-image-temp.png");
    assertEquals(mockFs.renameCalls[0].newPath, "uploads/food-images/new-image-temp.png");

    // Check removal of old image
    assertEquals(mockFs.removeCalls.length, 1);
    assertEquals(mockFs.removeCalls[0], "uploads/food-images/old-image.png");
});

Deno.test("FoodService - deleteFood", async () => {
    const mockRepo = new MockFoodRepository();
    const mockFs = new MockFileSystem();
    const service = new FoodService(mockRepo as any, mockFs);

    await mockRepo.saveFood({ ...mockFoodItem });

    const deleteNonExistent = await service.deleteFood("non-existent");
    assertEquals(deleteNonExistent, false);

    const deleteExistent = await service.deleteFood("food-1");
    assertEquals(deleteExistent, true);
    assert(mockRepo.deleteCalled);

    const deletedItem = await mockRepo.getFood("food-1");
    assert(deletedItem?.deletedAt !== undefined);
});
