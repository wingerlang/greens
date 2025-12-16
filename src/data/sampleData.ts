/**
 * Sample Data - Vegan Foods and Recipes
 * All nutritional values per 100g
 * @module data/sampleData
 */

import { type FoodItem, type Recipe } from '../models/types.ts';

const now = new Date().toISOString();

// ============================================
// Vegan Food Database (25+ items)
// ============================================

export const SAMPLE_FOOD_ITEMS: FoodItem[] = [
    // --- LEGUMES (Baljväxter) ---
    {
        id: 'food-linser',
        name: 'Linser',
        description: 'röda linser, gröna linser, beluga',
        calories: 340,
        protein: 24,
        carbs: 60,
        fat: 1.5,
        fiber: 8,
        unit: 'kg',
        category: 'legumes',
        storageType: 'pantry',
        pricePerUnit: 30,
        co2PerUnit: 0.4,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-kikartor',
        name: 'Kikärtor',
        description: 'torkade, konserverade',
        calories: 160,
        protein: 9,
        carbs: 27,
        fat: 2.5,
        fiber: 8,
        unit: 'kg',
        category: 'legumes',
        storageType: 'pantry',
        pricePerUnit: 25,
        co2PerUnit: 0.6,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-svartabonor',
        name: 'Svarta bönor',
        description: 'konserverade, torkade',
        calories: 130,
        protein: 9,
        carbs: 23,
        fat: 0.5,
        fiber: 8,
        unit: 'kg',
        category: 'legumes',
        storageType: 'pantry',
        pricePerUnit: 20,
        co2PerUnit: 0.5,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    // --- PROTEIN ---
    {
        id: 'food-tofu',
        name: 'Tofu',
        description: 'fast tofu, silkestofu',
        calories: 76,
        protein: 8,
        carbs: 2,
        fat: 4.8,
        fiber: 0.3,
        unit: 'kg',
        category: 'protein',
        storageType: 'fresh',
        pricePerUnit: 50,
        co2PerUnit: 0.8,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-tempeh',
        name: 'Tempeh',
        description: 'fermenterade sojabönor',
        calories: 195,
        protein: 20,
        carbs: 8,
        fat: 11,
        fiber: 0,
        unit: 'kg',
        category: 'protein',
        storageType: 'fresh',
        pricePerUnit: 80,
        co2PerUnit: 0.9,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-seitan',
        name: 'Seitan',
        description: 'vetegluten',
        calories: 370,
        protein: 75,
        carbs: 14,
        fat: 2,
        fiber: 0,
        unit: 'kg',
        category: 'protein',
        storageType: 'fresh',
        pricePerUnit: 90,
        co2PerUnit: 0.7,
        containsGluten: true,
        createdAt: now,
        updatedAt: now,
    },
    // --- GRAINS (Spannmål) ---
    {
        id: 'food-ris',
        name: 'Ris',
        description: 'jasminris, basmatiris, fullkornsris',
        calories: 350,
        protein: 7,
        carbs: 78,
        fat: 0.5,
        fiber: 1.8,
        unit: 'kg',
        category: 'grains',
        storageType: 'pantry',
        pricePerUnit: 20,
        co2PerUnit: 2.7,
        containsGluten: false,
        isCooked: false,
        defaultPortionGrams: 70, // raw
        gramsPerDl: 85,
        yieldFactor: 2.5,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-ris-kokt',
        name: 'Ris (kokt)',
        description: 'kokt jasmin- eller basmatiris',
        calories: 130, // Approx for cooked
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        fiber: 0.4,
        unit: 'kg',
        category: 'grains',
        storageType: 'fresh',
        pricePerUnit: 10, // cheaper per kg cooked? irrelevant
        co2PerUnit: 1.0,
        containsGluten: false,
        isCooked: true,
        defaultPortionGrams: 175,
        gramsPerDl: 60, // fluffier
        yieldFactor: 1,
        linkedItemId: 'food-ris',
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-pasta',
        name: 'Pasta',
        description: 'spaghetti, penne, fusilli',
        calories: 350,
        protein: 12,
        carbs: 72,
        fat: 1.5,
        fiber: 3,
        unit: 'kg',
        category: 'grains',
        storageType: 'pantry',
        pricePerUnit: 15,
        co2PerUnit: 1.1,
        containsGluten: true,
        isCooked: false,
        defaultPortionGrams: 75,
        gramsPerDl: 35, // pasta shapes vary, but 35g/dl for penne/fusilli approx
        yieldFactor: 2.2,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-havregryn',
        name: 'Havregryn',
        description: 'grova, fina, glutenfria',
        calories: 340,
        protein: 10,
        carbs: 70,
        fat: 7,
        fiber: 10,
        unit: 'kg',
        category: 'grains',
        storageType: 'pantry',
        pricePerUnit: 15,
        co2PerUnit: 0.6,
        containsGluten: true,
        isCooked: false,
        defaultPortionGrams: 40, // standard porridge portion
        gramsPerDl: 40,
        yieldFactor: 1, // distinct usage mostly
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-quinoa',
        name: 'Quinoa',
        description: 'vit, röd, svart',
        calories: 360,
        protein: 12,
        carbs: 70,
        fat: 2,
        fiber: 5,
        unit: 'kg',
        category: 'grains',
        storageType: 'pantry',
        pricePerUnit: 60,
        co2PerUnit: 1.0,
        containsGluten: false,
        isCooked: false,
        defaultPortionGrams: 60,
        gramsPerDl: 85,
        yieldFactor: 3,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-brod',
        name: 'Bröd',
        description: 'fullkorn, limpa, rågbröd',
        calories: 260,
        protein: 8,
        carbs: 48,
        fat: 3,
        fiber: 6,
        unit: 'pcs',
        category: 'grains',
        storageType: 'fresh',
        pricePerUnit: 30,
        co2PerUnit: 0.9,
        containsGluten: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-couscous',
        name: 'Couscous',
        description: 'vanlig, fullkorn',
        calories: 376,
        protein: 13,
        carbs: 77,
        fat: 1,
        fiber: 5,
        unit: 'kg',
        category: 'grains',
        storageType: 'pantry',
        pricePerUnit: 25,
        co2PerUnit: 0.9,
        containsGluten: true,
        createdAt: now,
        updatedAt: now,
    },
    // --- VEGETABLES (Grönsaker) ---
    {
        id: 'food-potatis',
        name: 'Potatis',
        description: 'kokt, bakad, mos',
        calories: 77,
        protein: 2,
        carbs: 17,
        fat: 0.1,
        fiber: 2.2,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'fresh',
        pricePerUnit: 15,
        co2PerUnit: 0.3,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-morotter',
        name: 'Morötter',
        description: 'färska, frysta',
        calories: 41,
        protein: 0.9,
        carbs: 10,
        fat: 0.2,
        fiber: 2.8,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'fresh',
        pricePerUnit: 15,
        co2PerUnit: 0.2,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-lok',
        name: 'Lök',
        description: 'gul lök, rödlök',
        calories: 40,
        protein: 1.1,
        carbs: 9,
        fat: 0.1,
        fiber: 1.7,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'pantry',
        pricePerUnit: 10,
        co2PerUnit: 0.2,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-vitlok',
        name: 'Vitlök',
        description: 'klyftad, pressad',
        calories: 149,
        protein: 6.4,
        carbs: 33,
        fat: 0.5,
        fiber: 2.1,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'pantry',
        pricePerUnit: 80,
        co2PerUnit: 0.3,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-spenat',
        name: 'Spenat',
        description: 'färsk, fryst',
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
        fiber: 2.2,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'fresh',
        pricePerUnit: 30,
        co2PerUnit: 0.3,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-broccoli',
        name: 'Broccoli',
        description: 'färsk, fryst',
        calories: 34,
        protein: 2.8,
        carbs: 7,
        fat: 0.4,
        fiber: 2.6,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'fresh',
        pricePerUnit: 25,
        co2PerUnit: 0.4,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-tomater',
        name: 'Tomater',
        description: 'färska, krossade, passerade',
        calories: 18,
        protein: 0.9,
        carbs: 3.9,
        fat: 0.2,
        fiber: 1.2,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'fresh',
        pricePerUnit: 25,
        co2PerUnit: 1.4,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-paprika',
        name: 'Paprika',
        description: 'röd, gul, grön',
        calories: 31,
        protein: 1,
        carbs: 6,
        fat: 0.3,
        fiber: 2.1,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'fresh',
        pricePerUnit: 40,
        co2PerUnit: 0.8,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-wokgronsaker',
        name: 'Wokgrönsaker',
        description: 'fryst mix, asiatisk mix',
        calories: 30,
        protein: 2,
        carbs: 5,
        fat: 0.3,
        fiber: 2,
        unit: 'kg',
        category: 'vegetables',
        storageType: 'frozen',
        pricePerUnit: 35,
        co2PerUnit: 0.5,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    // --- FATS (Fetter) ---
    {
        id: 'food-olivolja',
        name: 'Olivolja',
        description: 'extra virgin, mild',
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        fiber: 0,
        unit: 'l',
        category: 'fats',
        storageType: 'pantry',
        pricePerUnit: 80,
        co2PerUnit: 3.2,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-kokosmjolk',
        name: 'Kokosmjölk',
        description: 'burk, light',
        calories: 197,
        protein: 2.2,
        carbs: 2.8,
        fat: 21,
        fiber: 0,
        unit: 'l',
        category: 'fats',
        storageType: 'pantry',
        pricePerUnit: 30,
        co2PerUnit: 0.6,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-sesamolja',
        name: 'Sesamolja',
        description: 'rostad, använd sparsamt',
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        fiber: 0,
        unit: 'l',
        category: 'fats',
        storageType: 'pantry',
        pricePerUnit: 120,
        co2PerUnit: 2.5,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    // --- OTHER ---
    {
        id: 'food-soja',
        name: 'Sojasås',
        description: 'ljus, mörk, tamari',
        calories: 53,
        protein: 5,
        carbs: 4,
        fat: 0,
        fiber: 0,
        unit: 'l',
        category: 'other',
        storageType: 'pantry',
        pricePerUnit: 40,
        co2PerUnit: 0.8,
        containsGluten: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-havremjolk',
        name: 'Havremjölk',
        description: 'iKaffe, original',
        calories: 42,
        protein: 0.3,
        carbs: 8,
        fat: 1,
        fiber: 0.5,
        unit: 'l',
        category: 'beverages',
        storageType: 'fresh',
        pricePerUnit: 20,
        co2PerUnit: 0.4,
        containsGluten: true,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-currypasta',
        name: 'Currypasta',
        description: 'röd, grön, gul',
        calories: 120,
        protein: 2,
        carbs: 8,
        fat: 9,
        fiber: 1,
        unit: 'kg',
        category: 'other',
        storageType: 'pantry',
        pricePerUnit: 100,
        co2PerUnit: 0.5,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-banan',
        name: 'Banan',
        description: 'färsk, fryst',
        calories: 89,
        protein: 1.1,
        carbs: 23,
        fat: 0.3,
        fiber: 2.6,
        unit: 'kg',
        category: 'fruits',
        storageType: 'fresh',
        pricePerUnit: 20,
        co2PerUnit: 0.7,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'food-bar',
        name: 'Bär',
        description: 'blåbär, hallon, jordgubbar',
        calories: 50,
        protein: 0.7,
        carbs: 12,
        fat: 0.3,
        fiber: 2.4,
        unit: 'kg',
        category: 'fruits',
        storageType: 'frozen',
        pricePerUnit: 60,
        co2PerUnit: 0.5,
        containsGluten: false,
        createdAt: now,
        updatedAt: now,
    },
];

// ============================================
// Sample Recipes (10 st)
// ============================================

export const SAMPLE_RECIPES: Recipe[] = [
    {
        id: 'recipe-1',
        name: 'Stekt Ris med Tofu',
        description: 'Snabb och mättande vardagsrätt',
        servings: 4,
        prepTime: 10,
        cookTime: 15,
        mealType: 'dinner',
        ingredients: [],
        instructions: [],
        ingredientsText: `4 port ris (gärna kallt)
400g fast tofu
1 påse wokgrönsaker
2 msk sojasås
1 msk sesamolja
2 vitlöksklyftor`,
        instructionsText: `Pressa vätskan ur tofun med hushållspapper. Tärna den.
Stek tofun gyllene i olja på hög värme. Lägg åt sidan.
I samma panna: tillsätt grönsaker och pressad vitlök. Stek tills tinat/mjukt.
Vänd ner riset och stek allt tillsammans på hög värme tills riset är varmt och lite krispigt.
Häll över soja och rör om. Blanda i tofun på slutet.`,
        totalWeight: 1200,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-2',
        name: 'Linsgryta med Potatis',
        description: 'Värmande och nyttig gryta',
        servings: 4,
        prepTime: 10,
        cookTime: 30,
        mealType: 'dinner',
        ingredients: [],
        instructions: [],
        ingredientsText: `300g röda linser
500g potatis
1 burk krossade tomater
1 gul lök
3 vitlöksklyftor
2 tsk curry
1 dl kokosmjölk
1 msk olivolja`,
        instructionsText: `Skala och tärna potatisen. Hacka lök och vitlök.
Fräs lök i olivolja tills mjuk. Tillsätt vitlök och curry, fräs 1 min.
Tillsätt linser, potatis, tomater och 4 dl vatten.
Koka upp och låt sjuda 25 min tills linser och potatis är mjuka.
Rör i kokosmjölken. Smaka av med salt och peppar.`,
        totalWeight: 1500,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-3',
        name: 'Pasta med Kikärtor',
        description: 'Italiensk-inspirerad snabbrätt',
        servings: 4,
        prepTime: 5,
        cookTime: 15,
        mealType: 'lunch',
        ingredients: [],
        instructions: [],
        ingredientsText: `400g pasta
400g kikärtor (konserv)
1 burk krossade tomater
2 vitlöksklyftor
2 msk olivolja
1 tsk torkad oregano`,
        instructionsText: `Koka pastan enligt förpackningen.
Fräs vitlök i olivolja. Tillsätt tomater och oregano.
Låt sjuda 10 min. Rör ner kikärtorna.
Blanda pastan med såsen. Servera med färsk basilika.`,
        totalWeight: 1100,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-4',
        name: 'Overnight Oats',
        description: 'Förberedd frukost, kallt eller varmt',
        servings: 1,
        prepTime: 5,
        cookTime: 0,
        mealType: 'breakfast',
        ingredients: [],
        instructions: [],
        ingredientsText: `50g havregryn
150ml havremjölk
1 banan
50g frysta bär`,
        instructionsText: `Blanda havregryn och havremjölk i en burk.
Ställ i kylen över natten.
Toppa med skivad banan och bär på morgonen.`,
        totalWeight: 300,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-5',
        name: 'Grön Curry',
        description: 'Thailändsk klassiker med grönsaker',
        servings: 4,
        prepTime: 10,
        cookTime: 20,
        mealType: 'dinner',
        ingredients: [],
        instructions: [],
        ingredientsText: `400ml kokosmjölk
2 msk grön currypasta
400g tofu
1 paprika
200g broccoli
2 msk sojasås
4 port ris`,
        instructionsText: `Koka riset enligt förpackningen.
Fräs currypastan i lite olja. Häll i kokosmjölken.
Skär tofu och grönsaker i bitar. Lägg i grytan.
Låt sjuda 15 min. Smaka av med soja.
Servera med riset.`,
        totalWeight: 1400,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-6',
        name: 'Bönburgare',
        description: 'Hemmagjorda vegoburgare',
        servings: 4,
        prepTime: 15,
        cookTime: 10,
        mealType: 'dinner',
        ingredients: [],
        instructions: [],
        ingredientsText: `400g svarta bönor
100g havregryn
1 lök
2 vitlöksklyftor
1 tsk spiskummin
1 msk olivolja`,
        instructionsText: `Mosa bönorna grovt med en gaffel.
Hacka löken fint och fräs tillsammans med vitlök.
Blanda allt med havregryn och kryddor.
Forma till biffar och stek i olja ca 5 min per sida.`,
        totalWeight: 600,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-7',
        name: 'Quinoasallad',
        description: 'Frisk och nyttig sallad',
        servings: 4,
        prepTime: 15,
        cookTime: 15,
        mealType: 'lunch',
        ingredients: [],
        instructions: [],
        ingredientsText: `200g quinoa
1 burk kikärtor
1 paprika
1 gurka
100g spenat
2 msk olivolja
1 citron (juice)`,
        instructionsText: `Koka quinoan enligt förpackningen. Låt svalna.
Skär paprika och gurka i små tärningar.
Blanda allt med kikärtor och spenat.
Ringla över olivolja och citronsaft. Salta och peppra.`,
        totalWeight: 800,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-8',
        name: 'Morotssoppa',
        description: 'Len och värmande soppa',
        servings: 4,
        prepTime: 10,
        cookTime: 25,
        mealType: 'lunch',
        ingredients: [],
        instructions: [],
        ingredientsText: `500g morötter
1 lök
2 vitlöksklyftor
1 tsk ingefära
1 dl kokosmjölk
1 msk olivolja`,
        instructionsText: `Skala och skär morötterna i bitar.
Fräs lök och vitlök i olivolja. Tillsätt ingefära.
Lägg i morötterna och täck med vatten.
Koka tills mjukt (ca 20 min). Mixa slätt.
Rör i kokosmjölken och värm upp.`,
        totalWeight: 900,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-9',
        name: 'Tempeh Stir-Fry',
        description: 'Asiatisk tempeh med grönsaker',
        servings: 2,
        prepTime: 10,
        cookTime: 15,
        mealType: 'dinner',
        ingredients: [],
        instructions: [],
        ingredientsText: `200g tempeh
1 påse wokgrönsaker
2 msk sojasås
1 msk sesamolja
1 vitlöksklyfta
2 port ris`,
        instructionsText: `Koka riset. Skär tempeh i strimlor.
Stek tempeh i sesamolja tills gyllene.
Tillsätt grönsaker och vitlök. Stek på hög värme.
Häll över soja och servera med riset.`,
        totalWeight: 700,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-10',
        name: 'Couscous Bowl',
        description: 'Snabb lunch med medelhavstema',
        servings: 2,
        prepTime: 10,
        cookTime: 5,
        mealType: 'lunch',
        ingredients: [],
        instructions: [],
        ingredientsText: `150g couscous
1 burk kikärtor
1 paprika
50g spenat
2 msk olivolja
1 citron`,
        instructionsText: `Häll kokande vatten över couscousen. Låt stå 5 min.
Skär paprika i bitar.
Fluffa couscousen med en gaffel.
Lägg på kikärtor, paprika och spenat.
Ringla över olivolja och citronsaft.`,
        totalWeight: 500,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 'recipe-stress-test',
        name: 'The Ultimate Stress Test',
        description: 'TEST: Komplex rätt med timers, återanvändning och enheter.',
        servings: 4,
        prepTime: 30,
        cookTime: 45,
        mealType: 'dinner',
        ingredients: [],
        instructions: [],
        ingredientsText: `4 port ris
200g tofu
2 msk sojasås
1 lök
2 vitlöksklyftor
1 burk kikärtor
1 dl havregrädde
1 tsk sriracha
0.5 dl vatten`,
        instructionsText: `Koka riset enligt förpackningen.
Tärna tofun fint. Hacka löken.
Stek tofun i lite olja tills gyllene (ca 5 min). Lägg åt sidan.
I samma panna: Fräs den hackade löken tills mjuk.
Tillsätt vitlök och kikärtor. Stek i 2 min.
Häll i den stekta tofun och sojasås.
Tillsätt havregrädde, sriracha och vatten.
Låt puttra i 5 minuter.
Servera med riset.`,
        totalWeight: 1000,
        createdAt: now,
        updatedAt: now,
    },
];
