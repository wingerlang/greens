const kv = await Deno.openKv("./guardian.db");

const iter = kv.list({ prefix: [] }); // Start with empty prefix to see keys first or scan all
let count = 0;
for await (const entry of iter) {
    const key = entry.key;
    const value = entry.value as any;

    // Check if it's an activity or contains splits
    if (value && (value.splits_standard || value.laps || value.splits_laps)) {
        const splits = value.laps || value.splits_laps || value.splits_standard;
        if (splits && splits.length >= 2) {
            const first = splits[0];
            const second = splits[1];

            const match1 = Math.abs(first.distance - 2500) < 500;
            const match2 = Math.abs(second.distance - 510) < 200;

            if (match1 && match2) {
                console.log("\n--- FOUND MATCHING ACTIVITY ---");
                console.log("Key:", key);
                console.log("Value Structure:", Object.keys(value));
                if (value.name) console.log("Title:", value.name);
                if (value.description) console.log("Description:", value.description);
                console.log("Splits:");
                splits.forEach((s: any, i: number) => {
                    const pace = s.moving_time / (s.distance / 1000 || 1);
                    const min = Math.floor(pace / 60);
                    const sec = Math.round(pace % 60);
                    console.log(`  Lap ${s.split || i+1}: Dist=${s.distance}m, Time=${s.moving_time}s, Pace=${min}:${sec.toString().padStart(2, '0')}/km`);
                });
                count++;
            }
        }
    }
}
console.log(`\nScan complete. Found ${count} matches.`);
