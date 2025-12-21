/// <reference lib="deno.ns" />
import { expect } from "https://deno.land/std@0.208.0/expect/mod.ts";
import { calculateRecipeEstimate } from "../src/utils/ingredientParser.ts";
import { SAMPLE_FOOD_ITEMS } from "../src/data/sampleData.ts";

Deno.test("Synergy: Iron + Vitamin C", () => {
    const ingredients = "100g spenat\n1 citron";
    const result = calculateRecipeEstimate(ingredients, SAMPLE_FOOD_ITEMS);

    const ironC = result.synergies.find(s => s.id === 'iron-vitc');
    expect(ironC).toBeDefined();
    expect(ironC?.name).toBe("Järnupptag-Boost");
});

Deno.test("Synergy: Fat + Vitamin A", () => {
    const ingredients = "200g morot\n1 msk olivolja";
    const result = calculateRecipeEstimate(ingredients, SAMPLE_FOOD_ITEMS);

    const fatA = result.synergies.find(s => s.id === 'fat-vita');
    expect(fatA).toBeDefined();
    expect(fatA?.name).toBe("Närings-Unlock");
});

Deno.test("Synergy: Turmeric + Black Pepper", () => {
    const ingredients = "1 tsk gurkmeja\n0.5 tsk svartpeppar";
    const result = calculateRecipeEstimate(ingredients, SAMPLE_FOOD_ITEMS);

    const bioBoost = result.synergies.find(s => s.id === 'turmeric-pepper');
    expect(bioBoost).toBeDefined();
});

Deno.test("Synergy: Allium + Minerals", () => {
    const ingredients = "100g röda linser\n2 vitlöksklyftor";
    const result = calculateRecipeEstimate(ingredients, SAMPLE_FOOD_ITEMS);

    const bridge = result.synergies.find(s => s.id === 'allium-minerals');
    expect(bridge).toBeDefined();
});
