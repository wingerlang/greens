export * from './common.ts';
export * from './user.ts';
export * from './nutrition.ts';
export * from './planning.ts';
export * from './activity.ts';
export * from './goals.ts';
export * from './health.ts';
export * from './social.ts';
export * from './coach.ts';
export * from './persistence.ts';

// Re-export specific utils that were previously in types.ts (if any)
// types.ts had: generateId, getISODate, getWeekStartDate, getWeekdayFromDate
// These are now in common.ts and utils/date.ts
// But since we export * from common.ts, generateId is covered.
// getISODate etc are in date.ts which is NOT in models.
// So we need to re-export them here if we want to maintain backward compatibility
// for files importing them from types.ts

import { getISODate, getWeekStartDate, getWeekdayFromDate } from '../utils/date.ts';
export { getISODate, getWeekStartDate, getWeekdayFromDate };
