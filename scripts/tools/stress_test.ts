
const BASE_URL = "http://localhost:3000";
const TOTAL_USERS = 10;

// Simulate "Users" with persistent cookies
const users = Array.from({ length: TOTAL_USERS }, (_, i) => ({
    id: `user-${i}`,
    cookies: new Map<string, string>()
}));

async function runUserRequest(user: any) {
    const headers = new Headers();
    // Reconstruct Cookie header
    const cookieHeader = Array.from(user.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookieHeader) headers.set("Cookie", cookieHeader);

    try {
        const start = performance.now();
        // Use a path that hits the backend
        const res = await fetch(`${BASE_URL}/api/health`, {
            headers,
            redirect: "manual"
        });
        const duration = performance.now() - start;

        // Parse Set-Cookie
        // Note: fetch API merges multiple Set-Cookie headers into one string with comma separation?
        // Or Deno iterates? res.headers.get("set-cookie") returns string.
        const setCookie = res.headers.get("set-cookie");
        if (setCookie) {
            // Basic parsing
            const parts = setCookie.split(',').map(s => s.trim()); // Naive split, cookies can contain commas in date
            // Better: just look for G_NODE
            const match = setCookie.match(/G_NODE=([^;]+)/);
            if (match) {
                user.cookies.set("G_NODE", match[1]);
                // console.log(`[${user.id}] Assigned to ${match[1]}`);
            }
        }

        // await res.text(); // Consume body
        return { status: res.status, duration };
    } catch (e) {
        return { error: e };
    }
}

async function startStressTest() {
    console.log("=== Guardian Stress Test Tool ===");
    console.log(`Simulating ${TOTAL_USERS} concurrent users.`);
    console.log("Ramping up load to trigger auto-scaling...");

    let targetRps = 5;
    let totalSent = 0;

    // Ramp up logic
    const rampInterval = setInterval(() => {
        if (targetRps < 200) {
            targetRps += 10;
            console.log(`\n>>> Increasing Load: Target ${targetRps} RPS`);
        }
    }, 10000); // Increase every 10s

    // Traffic Loop
    while (true) {
        const batchStart = performance.now();
        const promises = [];

        // Launch requests for this second
        for (let i = 0; i < targetRps; i++) {
            const user = users[Math.floor(Math.random() * users.length)];
            promises.push(runUserRequest(user));
        }

        await Promise.all(promises);
        totalSent += targetRps;

        const batchDuration = performance.now() - batchStart;

        // Wait remainder of second
        if (batchDuration < 1000) {
            await new Promise(r => setTimeout(r, 1000 - batchDuration));
        }

        // Visualization in terminal
        const msg = `\r[Stress] Sending ${targetRps} RPS | Total: ${totalSent} | Last Batch: ${batchDuration.toFixed(0)}ms`;
        await Deno.stdout.write(new TextEncoder().encode(msg));
    }
}

startStressTest();
