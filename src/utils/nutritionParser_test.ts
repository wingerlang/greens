import { parseNutritionText, extractFromJSONLD, cleanProductName, extractPackagingWeight, extractBrand } from './nutritionParser.ts';

const testCases = [
    {
        name: "ICA Vegokebab",
        url: "https://handlaprivatkund.ica.se/stores/1003545/products/vegokebab-pannf%C3%A4rdig-275g-schysst-k%C3%A4k/2031687",
        h1: "Vegokebab pannfärdig 275g Schysst käk",
        title: "Vegokebab pannfärdig 275g Schysst käk | ICA",
        text: "Schysst käk. Vegokebab pannfärdig. Vikt: 275g. Ursprung: Sverige. Näringsvärde per 100g: Energi 200kcal, Protein 15g, Kolhydrater 5g, Fett 12g."
    }
];

const knownBrands = ["Schysst käk", "Zeta", "Garant", "ICA"];

console.log("--- Testing Smart Extraction ---\n");

testCases.forEach(tc => {
    console.log(`Case: ${tc.name}`);

    const cleanedName = cleanProductName(tc.title, tc.h1);
    console.log(`Cleaned Name: ${cleanedName}`);

    const weight = extractPackagingWeight(tc.text);
    console.log(`Extracted Weight: ${weight}g`);

    const brand = extractBrand(tc.text, knownBrands);
    console.log(`Extracted Brand: ${brand}`);

    const nutrition = parseNutritionText(tc.text);
    console.log(`Nutrition: ${JSON.stringify(nutrition)}`);

    console.log("");
});
