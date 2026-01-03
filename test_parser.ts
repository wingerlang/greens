import { parseNutritionText, extractPackagingWeight } from './src/utils/nutritionParser.ts';

const testCases = [
    {
        name: "Portion size with 'storlek'",
        text: "Produktnamn: Pizzakit. Storlek: 320g. Näringsvärde per 100g: Protein 8.5g, Fett 4.2g, Kolhydrater 22g, Fiber 1.5g.",
        expectedWeight: 320,
        expectedMacros: { protein: 8.5, fat: 4.2, carbs: 22, fiber: 1.5 }
    },
    {
        name: "Ingredients extraction",
        text: "Ingredienser: Vetemjöl, vatten, rapsolja, jäst, salt. Näringsvärde: 250 kcal.",
        expectedIngredients: "Vetemjöl, vatten, rapsolja, jäst, salt.",
        expectedCalories: 250
    },
    {
        name: "Complex portion size",
        text: "Portionsstorlek: 150 ml. Innehållsförteckning: Havabas, socker, kakao.",
        expectedWeight: 150,
        expectedIngredients: "Havabas, socker, kakao."
    }
];

console.log("Starting tests...");

testCases.forEach((tc, i) => {
    const parsed = parseNutritionText(tc.text);
    const weight = extractPackagingWeight(tc.text);

    console.log(`\nTest Case ${i + 1}: ${tc.name}`);

    if (tc.expectedWeight !== undefined) {
        console.log(`Weight: ${weight} (Expected: ${tc.expectedWeight}) - ${weight === tc.expectedWeight ? "✅" : "❌"}`);
    }

    if (tc.expectedMacros) {
        const macrosMatch = Object.entries(tc.expectedMacros).every(([k, v]) => parsed[k as keyof typeof parsed] === v);
        console.log(`Macros: ${JSON.stringify(parsed)} (Expected: ${JSON.stringify(tc.expectedMacros)}) - ${macrosMatch ? "✅" : "❌"}`);
    }

    if (tc.expectedIngredients) {
        const ingredientsMatch = parsed.ingredients?.includes(tc.expectedIngredients);
        console.log(`Ingredients: ${parsed.ingredients} (Expected: ${tc.expectedIngredients}) - ${ingredientsMatch ? "✅" : "❌"}`);
    }

    if (tc.expectedCalories !== undefined) {
        console.log(`Calories: ${parsed.calories} (Expected: ${tc.expectedCalories}) - ${parsed.calories === tc.expectedCalories ? "✅" : "❌"}`);
    }
});
