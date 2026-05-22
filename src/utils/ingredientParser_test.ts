/// <reference lib="deno.ns" />
import { assertEquals, assert, assertNotEquals } from "@std/assert";
import {
    parseIngredientLine,
    parseIngredients,
    matchToFoodItem,
    calculateIngredientNutrition,
    calculateRecipeEstimate,
    parseRecipeTimes,
    calculateWeighedPortion,
    getIngredientSuggestions
} from "./ingredientParser.ts";
import type { FoodItem } from "../models/types.ts";

// Create comprehensive mock food items database
const mockFoodItems: FoodItem[] = [
    {
        id: "tofu",
        name: "Tofu",
        description: "Fast plantebasert soya-tofu",
        aliases: ["ekologisk tofu", "fast tofu"],
        calories: 120,
        protein: 12,
        carbs: 2,
        fat: 7,
        fiber: 2,
        iron: 3.0,
        calcium: 150,
        zinc: 1.5,
        pricePerUnit: 40, // 40 kr per kg
        co2PerUnit: 1.5,  // 1.5 kg CO2 per kg
        proteinCategory: "legume",
        seasons: ["spring", "summer", "autumn", "winter"],
        unit: "g",
        category: "protein",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "oats",
        name: "Havregryn",
        description: "Hela fiberrika havregryn",
        aliases: ["havre"],
        calories: 370,
        protein: 13,
        carbs: 60,
        fat: 7,
        fiber: 10,
        iron: 4.5,
        zinc: 3.0,
        pricePerUnit: 20,
        co2PerUnit: 0.8,
        proteinCategory: "grain",
        seasons: ["spring", "summer", "autumn", "winter"],
        unit: "g",
        category: "grains",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "turmeric",
        name: "Gurkmeja",
        calories: 300,
        protein: 8,
        carbs: 60,
        fat: 10,
        pricePerUnit: 150,
        co2PerUnit: 2.0,
        unit: "g",
        category: "spices",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "pepper",
        name: "Svartpeppar",
        calories: 250,
        protein: 10,
        carbs: 50,
        fat: 3,
        pricePerUnit: 200,
        co2PerUnit: 2.5,
        unit: "g",
        category: "spices",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "orange",
        name: "Apelsin",
        calories: 47,
        protein: 0.9,
        carbs: 11,
        fat: 0.1,
        vitaminC: 50,
        pricePerUnit: 25,
        co2PerUnit: 0.5,
        unit: "g",
        category: "fruits",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "spinach",
        name: "Spenat",
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
        iron: 2.7,
        vitaminC: 28,
        pricePerUnit: 60,
        co2PerUnit: 0.3,
        unit: "g",
        category: "vegetables",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "avocado",
        name: "Avocado",
        aliases: ["avokado"],
        calories: 160,
        protein: 2,
        carbs: 9,
        fat: 15,
        vitaminA: 140,
        pricePerUnit: 80,
        co2PerUnit: 1.2,
        unit: "g",
        category: "fats",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "carrot",
        name: "Morot",
        aliases: ["morötter"],
        calories: 41,
        protein: 0.9,
        carbs: 9.6,
        fat: 0.2,
        vitaminA: 835,
        pricePerUnit: 15,
        co2PerUnit: 0.2,
        unit: "g",
        category: "vegetables",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "broccoli",
        name: "Broccoli",
        calories: 34,
        protein: 2.8,
        carbs: 7,
        fat: 0.4,
        vitaminC: 89,
        pricePerUnit: 40,
        co2PerUnit: 0.5,
        unit: "g",
        category: "vegetables",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "mustard",
        name: "Senap",
        calories: 66,
        protein: 4,
        carbs: 6,
        fat: 4,
        pricePerUnit: 50,
        co2PerUnit: 0.6,
        unit: "g",
        category: "condiments",
        createdAt: "",
        updatedAt: ""
    },
    {
        id: "garlic",
        name: "Vitlök",
        calories: 149,
        protein: 6.4,
        carbs: 33,
        fat: 0.5,
        pricePerUnit: 100,
        co2PerUnit: 0.4,
        unit: "g",
        category: "vegetables",
        createdAt: "",
        updatedAt: ""
    }
];

// ============================================
// parseIngredientLine Tests
// ============================================

Deno.test("ingredientParser - parseIngredientLine - standard formats", () => {
    // Exact match with unit
    const res1 = parseIngredientLine("400g tofu");
    assert(res1 !== null);
    assertEquals(res1.quantity, 400);
    assertEquals(res1.unit, "g");
    assertEquals(res1.name, "tofu");

    // Space between number and unit
    const res2 = parseIngredientLine("3 dl havregryn");
    assert(res2 !== null);
    assertEquals(res2.quantity, 3);
    assertEquals(res2.unit, "dl");
    assertEquals(res2.name, "havregryn");

    // Swedish units map correctly
    const res3 = parseIngredientLine("2 msk gurkmeja");
    assert(res3 !== null);
    assertEquals(res3.quantity, 2);
    assertEquals(res3.unit, "msk");
    assertEquals(res3.name, "gurkmeja");

    const res4 = parseIngredientLine("1 klyfta vitlök");
    assert(res4 !== null);
    assertEquals(res4.quantity, 1);
    assertEquals(res4.unit, "pcs"); // klyfta -> pcs
    assertEquals(res4.name, "vitlök");
});

Deno.test("ingredientParser - parseIngredientLine - decimal quantities", () => {
    // Dot decimal
    const res1 = parseIngredientLine("1.5 kg morot");
    assert(res1 !== null);
    assertEquals(res1.quantity, 1.5);
    assertEquals(res1.unit, "kg");

    // Comma decimal
    const res2 = parseIngredientLine("2,5 port havregryn");
    assert(res2 !== null);
    assertEquals(res2.quantity, 2.5);
    assertEquals(res2.unit, "portion");
});

Deno.test("ingredientParser - parseIngredientLine - no quantity or unit", () => {
    // Standard text line
    const res1 = parseIngredientLine("En nypa salt och peppar");
    assert(res1 !== null);
    assertEquals(res1.quantity, 1);
    assertEquals(res1.unit, "pcs");
    assertEquals(res1.name, "En nypa salt och peppar");

    // Numbers only should be ignored (no ingredient name)
    const res2 = parseIngredientLine("123");
    assertEquals(res2, null);

    const res3 = parseIngredientLine("  ");
    assertEquals(res3, null);
});

Deno.test("ingredientParser - parseIngredients - bulk input", () => {
    const bulkText = `
        400g Tofu
        3 dl Havregryn
        
        2 msk Gurkmeja
    `;
    const list = parseIngredients(bulkText);
    assertEquals(list.length, 3);
    assertEquals(list[0].name, "Tofu");
    assertEquals(list[1].name, "Havregryn");
    assertEquals(list[2].name, "Gurkmeja");
});

// ============================================
// matchToFoodItem Tests
// ============================================

Deno.test("ingredientParser - matchToFoodItem - match strategies", () => {
    // Exact match
    const parsed1 = { quantity: 1, unit: "g", name: "Tofu", originalText: "" };
    const item1 = matchToFoodItem(parsed1, mockFoodItems);
    assert(item1 !== null);
    assertEquals(item1.id, "tofu");

    // Alias exact match
    const parsed2 = { quantity: 1, unit: "g", name: "ekologisk tofu", originalText: "" };
    const item2 = matchToFoodItem(parsed2, mockFoodItems);
    assert(item2 !== null);
    assertEquals(item2.id, "tofu");

    // Partial start match
    const parsed3 = { quantity: 1, unit: "g", name: "Tofublock", originalText: "" };
    const item3 = matchToFoodItem(parsed3, mockFoodItems);
    assert(item3 !== null);
    assertEquals(item3.id, "tofu");

    // Very short names should not aggressively match
    const parsedShort = { quantity: 1, unit: "g", name: "T", originalText: "" };
    const itemShort = matchToFoodItem(parsedShort, mockFoodItems);
    assertEquals(itemShort, null);
});

// ============================================
// calculateIngredientNutrition Tests
// ============================================

Deno.test("ingredientParser - calculateIngredientNutrition", () => {
    const parsed = { quantity: 200, unit: "g", name: "Tofu", originalText: "" };
    const tofu = mockFoodItems.find(f => f.id === "tofu")!;

    const result = calculateIngredientNutrition(parsed, tofu);
    // Tofu protein: 12g/100g. 200g Tofu -> 24g protein
    assertEquals(result.nutrition.protein, 24);
    // Calories: 120/100g -> 240
    assertEquals(result.nutrition.calories, 240);
    // Price: 40kr/kg. 200g -> 0.2kg * 40 = 8kr
    assertEquals(result.price, 8);
    // CO2: 1.5kg/kg. 200g -> 0.2 * 1.5 = 0.3kg
    assertEquals(result.co2, 0.3);
});

// ============================================
// calculateRecipeEstimate Tests (Including Synergies)
// ============================================

Deno.test("ingredientParser - calculateRecipeEstimate - basic recipe", () => {
    const ingredientsText = `
        200g Tofu
        100g Havregryn
    `;

    // Legume (tofu) + Grain (havregryn) = complete protein
    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems);
    assertEquals(estimate.matchedCount, 2);
    assertEquals(estimate.totalCount, 2);
    // Tofu (200g): Cal: 240, Prot: 24
    // Oats (100g): Cal: 370, Prot: 13
    // Total: Cal: 610, Prot: 37
    assertEquals(estimate.calories, 610);
    assertEquals(estimate.protein, 37);
    assertEquals(estimate.isCompleteProtein, true);
    assert(estimate.tags.includes("complete-protein"));
});

Deno.test("ingredientParser - calculateRecipeEstimate - iron + vitamin C synergy", () => {
    const ingredientsText = `
        100g Spenat
        100g Apelsin
    `;

    // Spinach iron: 2.7mg/100g. Orange vitaminC: 50mg/100g.
    // Total iron: 2.7 > 2. Total vitC: 78 > 20 -> Synergy triggers!
    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems);
    const ironVitCSynergy = estimate.synergies.find(s => s.id === "iron-vitc");
    assert(ironVitCSynergy !== undefined);
    assertEquals(ironVitCSynergy.name, "Järnupptag-Boost");
});

Deno.test("ingredientParser - calculateRecipeEstimate - fat + vitamin A synergy", () => {
    const ingredientsText = `
        100g Avocado
        100g Morot
    `;

    // Avocado fat: 15g. Carrot vitaminA: 835.
    // Total fat > 10. Total vitA > 500 -> Synergy triggers!
    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems);
    const fatVitASynergy = estimate.synergies.find(s => s.id === "fat-vita");
    assert(fatVitASynergy !== undefined);
    assertEquals(fatVitASynergy.name, "Närings-Unlock");
});

Deno.test("ingredientParser - calculateRecipeEstimate - turmeric + black pepper synergy", () => {
    const ingredientsText = `
        10g Gurkmeja
        5g Svartpeppar
    `;

    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems);
    const turmericPepper = estimate.synergies.find(s => s.id === "turmeric-pepper");
    assert(turmericPepper !== undefined);
    assertEquals(turmericPepper.name, "Bio-Boost");
});

Deno.test("ingredientParser - calculateRecipeEstimate - sulforaphane activation", () => {
    const ingredientsText = `
        200g Broccoli
        10g Senap
    `;

    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems);
    const sulforaphane = estimate.synergies.find(s => s.id === "sulforaphane");
    assert(sulforaphane !== undefined);
    assertEquals(sulforaphane.name, "Sulforafan-Aktivering");
});

Deno.test("ingredientParser - calculateRecipeEstimate - allium mineral bridge", () => {
    const ingredientsText = `
        200g Spenat
        10g Vitlök
    `;

    // Spenat iron: 2.7 * 2 = 5.4mg (> 3mg)
    // Vitlök is an Allium -> Synergy triggers!
    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems);
    const alliumBridge = estimate.synergies.find(s => s.id === "allium-minerals");
    assert(alliumBridge !== undefined);
    assertEquals(alliumBridge.name, "Mineral-Brygga");
});

Deno.test("ingredientParser - calculateRecipeEstimate - ingredient swap", () => {
    const ingredientsText = `
        200g Tofu
    `;

    // Swap tofu to oats
    const swaps = { "tofu": "oats" };

    const estimate = calculateRecipeEstimate(ingredientsText, mockFoodItems, swaps);
    // Oats calories per 100g = 370. For 200g Oats = 740.
    assertEquals(estimate.calories, 740);
    assertEquals(estimate.protein, 26); // 13 * 2
});

// ============================================
// Recipe Times & Portions Tests
// ============================================

Deno.test("ingredientParser - parseRecipeTimes", () => {
    const name = "Snabblagad tofupanna";
    const instructions = `
        Förbered tofu och hacka i 5 min.
        Stek sedan tofun i pannan i 10 min.
        Låt sedan puttra i ugnen i 20 min.
    `;

    const times = parseRecipeTimes(name, instructions);
    // prep & stek: 5 + 10 = 15 min active
    // ugn & puttra: 20 min passive
    assertEquals(times.activeTime, 15);
    assertEquals(times.passiveTime, 20);
});

Deno.test("ingredientParser - calculateWeighedPortion", () => {
    // 1200 kcal total weight of 600g. If portion is 200g:
    // 200/600 * 1200 = 400 kcal
    const calories = calculateWeighedPortion(1200, 600, 200);
    assertEquals(calories, 400);

    assertEquals(calculateWeighedPortion(100, 0, 50), 0);
});

// ============================================
// Autocomplete Suggestions Tests
// ============================================

Deno.test("ingredientParser - getIngredientSuggestions", () => {
    // Query "tof" should suggest Tofu
    const suggs = getIngredientSuggestions("tof", mockFoodItems);
    assert(suggs.length > 0);
    assertEquals(suggs[0].id, "tofu");

    // Empty or short query
    assertEquals(getIngredientSuggestions("t", mockFoodItems).length, 0);
});
