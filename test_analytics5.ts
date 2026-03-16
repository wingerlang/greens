import { analyticsRepository } from './src/api/repositories/analyticsRepository.ts';

const stats = await analyticsRepository.getStats(30);

console.log("\n--- Popular Pages detail ---");
stats.popularPages.forEach(p => {
    console.log(`Path: [${p.path}], Count: ${p.count}`);
});

const omnibox = await analyticsRepository.getOmniboxStats(30);
console.log("\n--- Omnibox Navs detail ---");
omnibox.topNavigations.forEach(p => {
    console.log(`Path: [${p.path}], Count: ${p.count}`);
});
