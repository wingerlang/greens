
// @ts-ignore
const kv = await Deno.openKv("./greens.db");

console.log("Opening KV store...");

// 1. List Users
console.log("\n--- USERS ---");
const userIter = kv.list({ prefix: ["users"] });
const userIds: string[] = [];
for await (const entry of userIter) {
    const user = entry.value as any;
    console.log(`User: ${user.username} (ID: ${user.id})`);
    userIds.push(user.id);
}

// 2. Scan Meals
console.log("\n--- MEALS SCAN ---");
for (const userId of userIds) {
    console.log(`Scanning meals for user ${userId}...`);
    const mealIter = kv.list({ prefix: ["meals", userId] });
    let count = 0;
    let estimateCount = 0;

    for await (const entry of mealIter) {
        const meal = entry.value as any;
        count++;

        // precise logging for target item
        const hasTarget = meal.items.some((i: any) =>
            (i.estimateDetails && i.estimateDetails.name.toLowerCase().includes("smörgås")) ||
            (i.name && i.name.toLowerCase().includes("smörgås")) ||
            JSON.stringify(i).toLowerCase().includes("smörgås")
        );

        const isEstimate = meal.items.some((i: any) => i.type === 'estimate');

        if (isEstimate) estimateCount++;

        if (hasTarget) {
            console.log("PLEASE FOUND IT:", JSON.stringify(meal, null, 2));
        }
    }
    console.log(`User ${userId}: Total Meals: ${count}, Estimates: ${estimateCount}`);
}

kv.close();
