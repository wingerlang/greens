import { analyticsRepository } from './src/api/repositories/analyticsRepository.ts';

async function testStats() {
    console.log("Starting stats fetch...");
    const start = performance.now();
    try {
        const stats = await analyticsRepository.getStats(7);
        const duration = performance.now() - start;
        console.log(`Stats fetched in ${duration.toFixed(2)}ms`);
        console.log("Stats Preview:", JSON.stringify(stats, null, 2).slice(0, 500) + "...");
    } catch (err) {
        console.error("Error fetching stats:", err);
    }
}

testStats().then(() => Deno.exit());
