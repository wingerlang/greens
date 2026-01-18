import { calculateItemNutrition } from '../src/utils/nutrition/calculations.ts';
import { type FoodItem } from '../src/models/types.ts';

// Mock FoodItem with Variants
const nocco: FoodItem = {
    id: 'nocco-1',
    name: 'Nocco',
    calories: 5, // Base (Standard 15 kcal per 330ml -> ~5 kcal per 100g)
    protein: 0.9,
    carbs: 0,
    fat: 0,
    unit: 'pcs',
    category: 'beverages',
    createdAt: '',
    updatedAt: '',
    extendedDetails: {
        caffeine: 55 // 55mg/100g (180mg/330ml)
    },
    variants: [
        {
            id: 'v-pear',
            name: 'Päron',
            // No macro overrides, default caffeine
        },
        {
            id: 'v-danish',
            name: 'Dansk (Low Caff)',
            caffeine: 32 // ~105mg / 330ml => ~32mg/100g
        },
        {
            id: 'v-sugar',
            name: 'With Sugar (Hypothetical)',
            nutrition: {
                calories: 40,
                carbs: 10
            }
        },
        {
            id: 'v-alcohol',
            name: 'With Alcohol',
            alcohol: 5.0 // 5%
        }
    ]
};

console.log("--- Testing Variant Logic ---");

// Test 1: Base Item (No Variant)
const base = calculateItemNutrition(nocco, 330, false);
console.log("Base Nocco (330g):");
console.log("  Calories:", base.nutrition.calories, "(Expected ~16-17)");
console.log("  Caffeine:", base.caffeine?.toFixed(1), "(Expected ~181.5)");
console.log("  Alcohol:", base.alcohol);

if (base.caffeine && Math.abs(base.caffeine - 181.5) < 1) console.log("✅ Base Caffeine Correct");
else console.error("❌ Base Caffeine Incorrect");


// Test 2: Standard Variant (Inherits Base)
const pear = calculateItemNutrition(nocco, 330, false, undefined, 'v-pear');
console.log("\nNocco Päron (330g):");
console.log("  Caffeine:", pear.caffeine?.toFixed(1), "(Expected ~181.5)");
if (pear.caffeine && Math.abs(pear.caffeine - 181.5) < 1) console.log("✅ Inherited Caffeine Correct");
else console.error("❌ Inherited Caffeine Incorrect");


// Test 3: Override Caffeine (Danish)
const danish = calculateItemNutrition(nocco, 330, false, undefined, 'v-danish');
console.log("\nNocco Danish (330g):");
console.log("  Caffeine:", danish.caffeine?.toFixed(1), "(Expected ~105.6)");
if (danish.caffeine && Math.abs(danish.caffeine - 105.6) < 1) console.log("✅ Overridden Caffeine Correct");
else console.error("❌ Overridden Caffeine Incorrect");


// Test 4: Override Macros (Sugar)
const sugar = calculateItemNutrition(nocco, 330, false, undefined, 'v-sugar');
console.log("\nNocco Sugar (330g):");
console.log("  Calories:", sugar.nutrition.calories, "(Expected ~132)");
console.log("  Carbs:", sugar.nutrition.carbs, "(Expected ~33)");
if (sugar.nutrition.calories === 132) console.log("✅ Overridden Macros Correct");
else console.error("❌ Overridden Macros Incorrect");


// Test 5: Alcohol Override
const booze = calculateItemNutrition(nocco, 330, false, undefined, 'v-alcohol');
console.log("\nNocco Alcohol (330g):");
console.log("  Alcohol:", booze.alcohol?.toFixed(1), "g/ml (Expected ~16.5)");
// 330 * 5 / 100 = 16.5
if (booze.alcohol && Math.abs(booze.alcohol - 16.5) < 0.1) console.log("✅ Alcohol Calculation Correct");
else console.error("❌ Alcohol Calculation Incorrect");

console.log("\n--- Verification Complete ---");
