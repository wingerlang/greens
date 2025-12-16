/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { findSmartSwaps } from "../src/utils/smartSwaps.ts";
import { FoodItem, FoodCategory } from "../src/models/types.ts";
import { ParsedIngredient } from "../src/utils/ingredientParser.ts";

// Mock Data
const MOCK_FOODS: FoodItem[] = [
    {
        id: "1", name: "Premium Beef", category: "protein", pricePerUnit: 200, co2PerUnit: 30,
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, unit: "kg", createdAt: "", updatedAt: ""
    },
    {
        id: "2", name: "Budget Lentils", category: "protein", pricePerUnit: 40, co2PerUnit: 2,
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, unit: "kg", createdAt: "", updatedAt: ""
    },
    {
        id: "3", name: "Fancy Cheese", category: "dairy-alt", pricePerUnit: 150, co2PerUnit: 15,
        calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, unit: "kg", createdAt: "", updatedAt: ""
    },
];

Deno.test("findSmartSwaps - suggests cheaper and eco-friendly alternative", () => {
    const ingredient: ParsedIngredient = {
        name: "Premium Beef",
        quantity: 1,
        unit: "kg",
        originalText: "1 kg Premium Beef"
    };

    const suggestions = findSmartSwaps([ingredient], MOCK_FOODS);

    assertEquals(suggestions.length, 1);
    assertEquals(suggestions[0].suggestion.name, "Budget Lentils");
    assertEquals(suggestions[0].originalItem.name, "Premium Beef"); // New Check
    assertEquals(suggestions[0].reason, "both"); // Saves both price (160kr) and CO2 (28kg)
});

Deno.test("findSmartSwaps - ignores minor differences", () => {
    // If the difference isn't > 30%, it shouldn't suggest
    const cheapBeef: FoodItem = { ...MOCK_FOODS[0], id: "4", name: "Cheap Beef", pricePerUnit: 180 };
    const foods = [...MOCK_FOODS, cheapBeef];

    const ingredient: ParsedIngredient = {
        name: "Premium Beef",
        quantity: 1,
        unit: "kg",
        originalText: "1 kg Premium Beef"
    };

    // 200 vs 180 is only 10% saving, threshold is 30%
    const suggestions = findSmartSwaps([ingredient], foods);
    const hasCheapBeef = suggestions.some(s => s.suggestion.name === "Cheap Beef");

    assertEquals(hasCheapBeef, false);
});
