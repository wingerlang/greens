import { analyticsRepository } from './src/api/repositories/analyticsRepository.ts';

try {
    console.log("Testing stats...");
    const stats = await analyticsRepository.getStats(30);
    console.log("Stats OK:", stats.popularPages.length, "popular pages");

    console.log("Testing users...");
    const users = await analyticsRepository.getUserActivityStats(30);
    console.log("Users OK:", users.length, "users");

    console.log("Testing omnibox...");
    const omnibox = await analyticsRepository.getOmniboxStats(30);
    console.log("Omnibox OK:", omnibox.topNavigations.length, "navs");
} catch (e) {
    console.error("Error running aggregations:", e);
}
