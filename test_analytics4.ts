import { analyticsRepository } from './src/api/repositories/analyticsRepository.ts';

const stats = await analyticsRepository.getStats(30);

console.log("\n--- Popular Pages ---");
console.log(stats.popularPages.slice(0, 10));

const omnibox = await analyticsRepository.getOmniboxStats(30);
console.log("\n--- Omnibox Navs ---");
console.log(omnibox.topNavigations.slice(0, 10));
console.log("\nSample contextual nav keys:", Object.keys(omnibox.contextualNavigations).slice(0, 5));
