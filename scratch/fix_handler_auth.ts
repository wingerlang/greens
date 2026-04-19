// Fix ALL handlers that do their own token extraction without cookie fallback
// Pattern: const token = req.headers.get("Authorization")?.replace("Bearer ", "");
// Replace with: cookie-aware extraction

const handlers = [
    'src/api/handlers/data.ts',
    'src/api/handlers/recipes.ts',
    'src/api/handlers/recalculateCalories.ts',
    'src/api/handlers/racePlans.ts',
    'src/api/handlers/raceDefinitions.ts',
    'src/api/handlers/quickMeals.ts',
    'src/api/handlers/plans.ts',
    'src/api/handlers/plannedActivities.ts',
    'src/api/handlers/periods.ts',
    'src/api/handlers/parser.ts',
    'src/api/handlers/goals.ts',
    'src/api/handlers/feed.ts',
    'src/api/handlers/exerciseEntries.ts',
];

let totalFixes = 0;

for (const file of handlers) {
    try {
        let content = Deno.readTextFileSync(file);
        
        // Replace the old pattern with cookie-aware extraction
        const oldPattern = `const token = req.headers.get("Authorization")?.replace("Bearer ", "");`;
        const newPattern = `let token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token || token === "mock" || token === "null" || token.length < 10) {
        token = req.headers.get("cookie")?.split("auth_token=")[1]?.split(";")[0] || null;
    }`;
        
        if (content.includes(oldPattern)) {
            content = content.replace(oldPattern, newPattern);
            Deno.writeTextFileSync(file, content);
            totalFixes++;
            console.log(`✅ Fixed ${file}`);
        } else {
            console.log(`⏭️  ${file}: pattern not found (may use different syntax)`);
        }
    } catch (e) {
        console.error(`❌ ${file}: ${(e as Error).message}`);
    }
}

console.log(`\nTotal handlers fixed: ${totalFixes}`);
