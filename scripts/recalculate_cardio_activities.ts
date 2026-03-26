/// <reference lib="deno.ns" />
import { calculateHeartRateCalories } from "../src/utils/analytics.ts";

const kv = await Deno.openKv("./greens.db");

console.log("Starting recalculation of cardio activities that were mapped to strength...");

// 1. Load User Profiles to get weight/age/gender (we'll just use a fallback if not found, or prompt)
// We'll iterate all user_profiles to make it generic
const usersIter = kv.list({ prefix: ["user_profiles"] });
const usersMap = new Map<string, any>();
for await (const entry of usersIter) {
    const userId = entry.key[1] as string;
    usersMap.set(userId, entry.value);
}

const settingsIter = kv.list({ prefix: ["settings"] }); // Or user_settings? We'll check fallback
const settingsMap = new Map<string, any>();
for await (const entry of settingsIter) {
    const userId = entry.key[1] as string;
    settingsMap.set(userId, entry.value);
}

let updatedCount = 0;

const iter = kv.list({ prefix: ["activities"] });
for await (const entry of iter) {
    const activity = entry.value as any;
    if (!activity) continue;

    const perf = activity.performance;
    const plan = activity.plan;
    const title = (plan?.title || activity.title || "").toLowerCase();
    const type = perf?.activityType || plan?.activityType || "";

    const matchesCardio = title.includes("cardio") || title.includes("cross") || title.includes("elliptical") || title.includes("trainer") || title.includes("rowing");

    if (type === "strength" && matchesCardio) {
        console.log(`Found matching activity: "${plan?.title || activity.title}" (${activity.id})`);

        // Upgrade type
        if (perf) perf.activityType = "cardio";
        if (plan) plan.activityType = "cardio";

        const hr = perf?.avgHeartRate;
        const durationMin = perf?.durationMinutes || 0;

        if (hr && durationMin > 0) {
            const userId = entry.key[1] as string;
            const profile = usersMap.get(userId) || {};
            const settings = settingsMap.get(userId) || {};

            const weight = profile.weight || settings.weight || 75;
            const birthYear = profile.birthYear || settings.birthYear || 1990;
            const age = new Date().getFullYear() - birthYear;
            const gender = profile.gender || settings.gender || "male";

            const { kcalPerMin, formula } = calculateHeartRateCalories(hr, weight, age, gender);

            // Apply sanity limits (cardio: 4 to 11)
            const limitedKcalPerMin = Math.max(4, Math.min(11, kcalPerMin));
            const total = Math.round(limitedKcalPerMin * durationMin);

            let breakdown = `Formel: ${formula}\nIndata:\n- Puls: ${hr.toFixed(0)} bpm\n- Vikt: ${weight} kg\n- Ålder: ${age} år\n- Tid: ${durationMin.toFixed(1)} min\nResultat: ~${limitedKcalPerMin.toFixed(2)} kcal/min`;
            
            if (Math.abs(kcalPerMin - limitedKcalPerMin) > 0.1) {
                 breakdown += `\n\nNotering: Begränsat från ${kcalPerMin.toFixed(1)} till ${limitedKcalPerMin.toFixed(1)} kcal/min (rimliga gränser för cardio: 4-11 kcal/min).`;
            }

            if (perf) {
                perf.caloriesBurned = total;
                perf.calorieBreakdown = breakdown;
            } else {
                activity.caloriesBurned = total;
                activity.calorieBreakdown = breakdown;
            }

            // Save back
            await kv.set(entry.key, activity);
            updatedCount++;
            console.log(` -> Recalculated: ${total} kcal. Type updated to 'cardio'.`);
        } else {
            console.log(` -> Skipped: Missing HR or duration.`);
        }
    }
}

console.log(`Done! Updated ${updatedCount} activities.`);
await kv.close();
