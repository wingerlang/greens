import { kv } from "./src/api/kv.ts";
import { analyticsRepository } from "./src/api/repositories/analyticsRepository.ts";

async function run() {
    const stats = await analyticsRepository.getStats(30);
    console.log("Popular paths:", stats.popularPages.filter(p => p.path === '/calories' || p.count > 0));

    const omni = await analyticsRepository.getOmniboxStats(30);
    console.log("Omni Navigations:", omni.topNavigations.filter(p => p.path === '/calories' || p.count > 0));
    console.log("Omni Total:", omni.topNavigations);
}

run().catch(console.error);
