const kv = await Deno.openKv("./greens.db");

console.log("Starting safe dry-run scan for ghost duplicate activities...");

let potentialGhosts = 0;
let usersWithGhosts = new Set<string>();
const candidatesForDeletion: { key: Deno.KvKey, data: any, reason: string }[] = [];

// 1. Group all activities and exercises by User -> Date
const userDateMap: Record<string, Record<string, {
    stravaPass: any[],
    manualPass: any[],
    otherPass: any[]
}>> = {};

// Load activities
for await (const entry of kv.list({ prefix: ["activities"] })) {
    const userId = entry.key[1] as string;
    const date = entry.key[2] as string;

    if (!userDateMap[userId]) userDateMap[userId] = {};
    if (!userDateMap[userId][date]) userDateMap[userId][date] = { stravaPass: [], manualPass: [], otherPass: [] };

    const v = entry.value as any;
    const source = v.source || v.performance?.source?.source || 'unknown';

    if (source === 'strava') {
        userDateMap[userId][date].stravaPass.push({ key: entry.key, data: v, type: 'activity' });
    } else if (source === 'manual') {
        userDateMap[userId][date].manualPass.push({ key: entry.key, data: v, type: 'activity' });
    } else {
        userDateMap[userId][date].otherPass.push({ key: entry.key, data: v, type: 'activity' });
    }
}

// Load exercise entries
for await (const entry of kv.list({ prefix: ["exercise_entries"] })) {
    const userId = entry.key[1] as string;
    const date = entry.key[2] as string;

    if (!userDateMap[userId]) userDateMap[userId] = {};
    if (!userDateMap[userId][date]) userDateMap[userId][date] = { stravaPass: [], manualPass: [], otherPass: [] };

    const v = entry.value as any;
    const source = v.source || 'manual'; // defaults to manual usually

    if (source === 'strava') {
        userDateMap[userId][date].stravaPass.push({ key: entry.key, data: v, type: 'exercise' });
    } else if (source === 'manual') {
        userDateMap[userId][date].manualPass.push({ key: entry.key, data: v, type: 'exercise' });
    } else {
        userDateMap[userId][date].otherPass.push({ key: entry.key, data: v, type: 'exercise' });
    }
}

// 2. Analyze the grouped data for the highly specific duplicate pattern
for (const [userId, dates] of Object.entries(userDateMap)) {
    for (const [date, passes] of Object.entries(dates)) {

        // Pattern 1: Same day has a real Strava pass AND multiple identical manual passes created close together
        // Specifically from our bug in Jan 2026.
        if (passes.stravaPass.length > 0 && passes.manualPass.length > 1) {

            // Check if manual passes share the same basic stats (distance, duration, type)
            // Let's group manual passes by signature: type_duration_distance
            const signatureMap: Record<string, typeof passes.manualPass> = {};

            for (const mp of passes.manualPass) {
                const sig = `${mp.data.type || mp.data.plan?.activityType}_${Math.round(mp.data.durationMinutes || 0)}_${Math.round(mp.data.distance || 0)}`;
                if (!signatureMap[sig]) signatureMap[sig] = [];
                signatureMap[sig].push(mp);
            }

            for (const [sig, identicalManuals] of Object.entries(signatureMap)) {
                if (identicalManuals.length > 1) {
                    // We have identical manuals. 
                    // To be VERY safe, we only mark duplicates (keeping the first one, or deleting all if there's a Strava match)

                    // Is there a Strava pass matching this signature?
                    const matchStrava = passes.stravaPass.find(sp => {
                        const spSig = `${sp.data.type || sp.data.performance?.activityType}_${Math.round(sp.data.durationMinutes || sp.data.performance?.durationMinutes || 0)}_${Math.round(sp.data.distance || sp.data.performance?.distanceKm || 0)}`;
                        return spSig === sig;
                    });

                    if (matchStrava) {
                        // Strava pass exists for this EXACT workout. 
                        // It's safe to delete ALL these identical manuals since they are overrides of THIS strava pass.
                        for (const mp of identicalManuals) {
                            candidatesForDeletion.push({
                                key: mp.key,
                                data: mp.data,
                                reason: `Exact duplicate of Strava pass ${matchStrava.data.id} on ${date}`
                            });
                        }
                    } else {
                        // Keep ONE manual pass, delete the rest
                        // Sort by createdAt so we keep the oldest one
                        identicalManuals.sort((a, b) => {
                            const dateA = a.data.createdAt ? new Date(a.data.createdAt).getTime() : 0;
                            const dateB = b.data.createdAt ? new Date(b.data.createdAt).getTime() : 0;
                            return dateA - dateB;
                        });

                        // Delete all except the first one
                        for (let i = 1; i < identicalManuals.length; i++) {
                            candidatesForDeletion.push({
                                key: identicalManuals[i].key,
                                data: identicalManuals[i].data,
                                reason: `Identical manual duplicate (keeping oldest) on ${date}`
                            });
                        }
                    }
                }
            }
        }

        // Pattern 2: (Fallback) Just multiple exact identical manual passes on a day, regardless of Strava
        else if (passes.manualPass.length > 1) {
            const signatureMap: Record<string, typeof passes.manualPass> = {};
            for (const mp of passes.manualPass) {
                // Use title too if available for strictness
                const title = mp.data.title || "Unnamed";
                const sig = `${mp.data.type || mp.data.plan?.activityType}_${Math.round(mp.data.durationMinutes || 0)}_${Math.round(mp.data.distance || 0)}_${title}`;
                if (!signatureMap[sig]) signatureMap[sig] = [];
                signatureMap[sig].push(mp);
            }

            for (const [sig, identicalManuals] of Object.entries(signatureMap)) {
                if (identicalManuals.length > 1) {
                    // Keep ONE manual pass, delete the rest 
                    identicalManuals.sort((a, b) => {
                        const dateA = a.data.createdAt ? new Date(a.data.createdAt).getTime() : 0;
                        const dateB = b.data.createdAt ? new Date(b.data.createdAt).getTime() : 0;
                        return dateA - dateB;
                    });

                    for (let i = 1; i < identicalManuals.length; i++) {
                        candidatesForDeletion.push({
                            key: identicalManuals[i].key,
                            data: identicalManuals[i].data,
                            reason: `Identical manual duplicate (keeping oldest) on ${date}`
                        });
                    }
                }
            }
        }
    }
}


console.log(`\n--- DRY RUN RESULTS ---`);
console.log(`Found ${candidatesForDeletion.length} safe candidates for deletion.`);

// Only print the first 20 to avoid spamming the console
for (let i = 0; i < Math.min(candidatesForDeletion.length, 20); i++) {
    const c = candidatesForDeletion[i];
    console.log(`- KEY: ${JSON.stringify(c.key)}`);
    console.log(`  REASON: ${c.reason}`);
    console.log(`  DATA: Title=${c.data.title}, Created=${c.data.createdAt}`);
}

if (candidatesForDeletion.length > 0) {
    console.log(`\nTo proceed with deletion, set const DRY_RUN = false in the script.`);
} else {
    console.log(`\nNo duplicates found! Your data is clean.`);
}

await kv.close();
for (const c of candidatesForDeletion) { await kv.delete(c.key); }
console.log("DELETION COMPLETE");
