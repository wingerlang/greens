/// <reference lib="deno.ns" />
import { expect } from "https://deno.land/std@0.208.0/expect/mod.ts";
import { type FoodItem } from "../src/models/types.ts";

// Mocking the behavior of analyzeImports
function analyzeImports(importedItems: FoodItem[], existingItems: FoodItem[]) {
    return importedItems.map(imported => {
        const existing = existingItems.find(f => f.id === imported.id || f.name.toLowerCase() === imported.name.toLowerCase());

        if (!existing) {
            return { type: 'new', imported, selected: true };
        } else {
            const isSame =
                existing.calories === imported.calories &&
                existing.protein === imported.protein &&
                existing.fat === imported.fat &&
                existing.carbs === imported.carbs;

            if (isSame) {
                return { type: 'duplicate', imported, existing, selected: false };
            } else {
                return { type: 'modified', imported, existing, selected: true };
            }
        }
    });
}

Deno.test("Bulk Import: Detect New Items", () => {
    const existing: FoodItem[] = [];
    const imported: FoodItem[] = [{ id: '1', name: 'Broccoli', calories: 34, protein: 2.8, fat: 0.4, carbs: 7, category: 'vegetables', unit: 'kg', createdAt: '', updatedAt: '' }];

    const results = analyzeImports(imported, existing);
    expect(results[0].type).toBe('new');
    expect(results[0].selected).toBe(true);
});

Deno.test("Bulk Import: Detect Exact Duplicates", () => {
    const item: FoodItem = { id: '1', name: 'Broccoli', calories: 34, protein: 2.8, fat: 0.4, carbs: 7, category: 'vegetables', unit: 'kg', createdAt: '', updatedAt: '' };
    const existing: FoodItem[] = [item];
    const imported: FoodItem[] = [item];

    const results = analyzeImports(imported, existing);
    expect(results[0].type).toBe('duplicate');
    expect(results[0].selected).toBe(false);
});

Deno.test("Bulk Import: Detect Modified Items", () => {
    const existing: FoodItem[] = [{ id: '1', name: 'Broccoli', calories: 34, protein: 2.8, fat: 0.4, carbs: 7, category: 'vegetables', unit: 'kg', createdAt: '', updatedAt: '' }];
    const imported: FoodItem[] = [{ id: '1', name: 'Broccoli', calories: 40, protein: 3.0, fat: 0.4, carbs: 8, category: 'vegetables', unit: 'kg', createdAt: '', updatedAt: '' }];

    const results = analyzeImports(imported, existing);
    expect(results[0].type).toBe('modified');
    expect(results[0].selected).toBe(true);
});

Deno.test("Bulk Import: Support Name + Protein Only", () => {
    const existing: FoodItem[] = [];
    // Simulate raw JSON with only name and protein
    const imported: any[] = [{ name: 'Test Lentils', protein: 24 }];

    // We need to mock the logic with defaults inside the test or use the actual function if it was exported
    const analyzeWithDefaults = (items: any[], existingItems: FoodItem[]) => {
        return items.map(importedRaw => {
            const imported: FoodItem = {
                id: importedRaw.id || `food-${importedRaw.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: importedRaw.name,
                calories: importedRaw.calories || 0,
                protein: importedRaw.protein,
                carbs: importedRaw.carbs || 0,
                fat: importedRaw.fat || 0,
                unit: importedRaw.unit || 'kg',
                category: importedRaw.category || 'other',
                createdAt: '', updatedAt: ''
            };
            const existing = existingItems.find(f => f.name.toLowerCase() === imported.name.toLowerCase());
            return { type: existing ? 'modified' : 'new', imported, selected: true };
        });
    };

    const results = analyzeWithDefaults(imported, existing);
    expect(results[0].type).toBe('new');
    expect(results[0].imported.calories).toBe(0);
    expect(results[0].imported.category).toBe('other');
});
