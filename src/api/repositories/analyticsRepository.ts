import { kv } from '../kv.ts';
import { PageView, InteractionEvent, AnalyticsStats } from '../../models/types.ts';

/**
 * Analytics Repository - Handles storage of usage data
 * Uses Deno KV for high-speed write/read
 */

const KEY_PREFIX = {
    PAGE_VIEW: 'analytics_page_view',
    EVENT: 'analytics_event'
};

export const analyticsRepository = {
    /**
     * Log a new page view
     */
    async logPageView(view: PageView): Promise<void> {
        await kv.set([KEY_PREFIX.PAGE_VIEW, view.timestamp, view.id], view);
    },

    /**
     * Log a user interaction
     */
    async logEvent(event: InteractionEvent): Promise<void> {
        await kv.set([KEY_PREFIX.EVENT, event.timestamp, event.id], event);
    },

    /**
     * Get aggregated stats for the dashboard
     */
    async getStats(daysBack = 30): Promise<AnalyticsStats> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const pageViews: PageView[] = [];
        const events: InteractionEvent[] = [];

        // Fetch Page Views and Events in parallel scans
        const fetchViews = async () => {
            for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] }, { reverse: true })) {
                if (entry.value.timestamp >= cutoffStr) {
                    pageViews.push(entry.value);
                } else {
                    break; // Timestamp is indexed, we can stop early
                }
            }
        };

        const fetchEvents = async () => {
            for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] }, { reverse: true })) {
                if (entry.value.timestamp >= cutoffStr) {
                    events.push(entry.value);
                } else {
                    break; // Timestamp is indexed, we can stop early
                }
            }
        };

        await Promise.all([fetchViews(), fetchEvents()]);

        // --- Aggregation Logic ---

        // 1. Popular Pages
        const pageMap = new Map<string, { count: number; totalTime: number }>();
        pageViews.forEach(v => {
            const current = pageMap.get(v.path) || { count: 0, totalTime: 0 };
            current.count++;
            if (v.durationSeconds && v.durationSeconds < 3600) { // Ignore outliers > 1h
                current.totalTime += v.durationSeconds;
            }
            pageMap.set(v.path, current);
        });

        const popularPages = Array.from(pageMap.entries()).map(([path, data]) => ({
            path,
            count: data.count,
            avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0
        })).sort((a, b) => b.count - a.count).slice(0, 20);

        // 2. Popular Interactions
        const eventMap = new Map<string, number>();
        events.forEach(e => {
            if (!e.label) return;
            const key = `${e.target}: ${e.label}`; // e.g. "button: Save"
            eventMap.set(key, (eventMap.get(key) || 0) + 1);
        });

        const popularInteractions = Array.from(eventMap.entries()).map(([label, count]) => ({
            label,
            count
        })).sort((a, b) => b.count - a.count).slice(0, 20);

        // 3. Active Users (Last 24h)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        const yesterdayStr = yesterday.toISOString();
        const activeUserIds = new Set<string>();

        pageViews.forEach(v => {
            if (v.timestamp >= yesterdayStr) activeUserIds.add(v.userId);
        });

        // 4. Module Engagement (Phase 2)
        const moduleStats: Record<string, number> = {
            'Kalorier': 0,
            'Träning': 0,
            'Planering': 0,
            'Profil & Social': 0,
            'Admin': 0,
            'Övrigt': 0
        };

        const categorizePath = (path: string) => {
            if (path.startsWith('/calories') || path.startsWith('/database')) return 'Kalorier';
            if (path.startsWith('/exercise') || path.startsWith('/strength')) return 'Träning';
            if (path.startsWith('/planera') || path.startsWith('/planning')) return 'Planering';
            if (path.startsWith('/profile') || path.startsWith('/social') || path.startsWith('/settings')) return 'Profil & Social';
            if (path.startsWith('/admin')) return 'Admin';
            return 'Övrigt';
        };

        events.forEach(e => {
            const mod = categorizePath(e.path || '/');
            moduleStats[mod]++;
        });

        // 5. Session Depth (Phase 2)
        const sessionDepth = pageViews.length > 0 ? Number((events.length / pageViews.length).toFixed(2)) : 0;

        // 6. Conversion Stats (Phase 2)
        // Note: For performance, we'll fetch these once and cache or handle as separate calls if slow.
        // For now, let's look at the basic plan compliance.
        let plannedMeals = 0;
        let loggedMeals = 0;
        let plannedTraining = 0;
        let completedTraining = 0;

        const cutoffDateStr = cutoff.toISOString().split('T')[0];

        // Fetch Weekly Plans
        for await (const entry of kv.list<any>({ prefix: ["weekly_plans"] })) {
            const plan = entry.value;
            if (plan.weekStartDate >= cutoffDateStr && plan.meals) {
                Object.values(plan.meals).forEach((day: any) => {
                    Object.values(day).forEach((meal: any) => {
                        if (meal?.recipeId) {
                            plannedMeals++;
                            if (meal.loggedToCalories) loggedMeals++;
                        }
                    });
                });
            }
        }

        // Fetch Activities
        for await (const entry of kv.list<any>({ prefix: ["activities"] })) {
            const act = entry.value;
            if (act.date >= cutoffDateStr) {
                if (act.status === 'PLANNED') plannedTraining++;
                if (act.status === 'COMPLETED') completedTraining++;
            }
        }

        // 7. Device Breakdown
        const deviceMap = new Map<string, number>();
        pageViews.forEach(v => {
            let device = 'Desktop';
            const ua = v.userAgent || '';
            if (/mobile/i.test(ua)) device = 'Mobile';
            if (/tablet/i.test(ua)) device = 'Tablet';
            deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
        });

        const browserMap = new Map<string, number>();
        pageViews.forEach(v => {
            let browser = 'Other';
            const ua = v.userAgent || '';
            if (/chrome/i.test(ua)) browser = 'Chrome';
            else if (/firefox/i.test(ua)) browser = 'Firefox';
            else if (/safari/i.test(ua)) browser = 'Safari';
            else if (/edg/i.test(ua)) browser = 'Edge';
            browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
        });

        return {
            totalPageViews: pageViews.length,
            totalEvents: events.length,
            popularPages,
            popularInteractions,
            activeUsers24h: activeUserIds.size,
            moduleStats,
            sessionDepth,
            conversionStats: {
                meals: { planned: plannedMeals, logged: loggedMeals },
                training: { planned: plannedTraining, completed: completedTraining }
            },
            deviceBreakdown: Object.fromEntries(deviceMap),
            browserBreakdown: Object.fromEntries(browserMap)
        };
    },

    /**
     * Get filtered events for raw event log
     */
    async getEventsFiltered({ userId, type, daysBack = 7, limit = 100 }: { userId?: string, type?: string, daysBack?: number, limit?: number }) {
        const events: InteractionEvent[] = [];
        const pageViews: PageView[] = [];

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        // Simplified scan (in real app, use secondary indexes or more precise key ranges)
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] }, { reverse: true })) {
            const e = entry.value;
            if (e.timestamp < cutoffStr) break;
            if (userId && e.userId !== userId) continue;
            if (type && e.type !== type) continue;
            events.push(e);
            if (events.length >= limit) break;
        }

        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] }, { reverse: true })) {
            const p = entry.value;
            if (p.timestamp < cutoffStr) break;
            if (userId && p.userId !== userId) continue;
            pageViews.push(p);
            if (pageViews.length >= limit) break;
        }

        return { events: events.slice(0, limit), pageViews: pageViews.slice(0, limit) };
    },

    /**
     * Get sessions grouped by ID
     */
    async getSessions(daysBack = 7): Promise<any[]> {
        const sessions = new Map<string, any>();
        const cutoff = new Date(Date.now() - daysBack * 86400000).getTime();
        const cutoffStr = new Date(cutoff).toISOString();

        // 1. Collect all PageViews
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] }, { reverse: true })) {
            const view = entry.value;
            if (view.timestamp < cutoffStr) break;

            if (!sessions.has(view.sessionId)) {
                sessions.set(view.sessionId, {
                    sessionId: view.sessionId,
                    userId: view.userId,
                    startTime: view.timestamp,
                    endTime: view.timestamp,
                    eventCount: 0,
                    viewCount: 0,
                    pathFlow: [],
                    userAgent: view.userAgent
                });
            }

            const session = sessions.get(view.sessionId);
            session.viewCount++;
            session.pathFlow.push(view.path);
            if (view.timestamp < session.startTime) session.startTime = view.timestamp;
            if (view.timestamp > session.endTime) session.endTime = view.timestamp;
        }

        // 2. Collect all Events
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] }, { reverse: true })) {
            const event = entry.value;
            if (event.timestamp < cutoffStr) break;

            if (!sessions.has(event.sessionId)) {
                // If we have an event but no page view, create session anyway
                sessions.set(event.sessionId, {
                    sessionId: event.sessionId,
                    userId: event.userId,
                    startTime: event.timestamp,
                    endTime: event.timestamp,
                    eventCount: 0,
                    viewCount: 0,
                    pathFlow: [],
                    userAgent: 'Unknown'
                });
            }
            const session = sessions.get(event.sessionId);
            session.eventCount++;
            if (event.timestamp < session.startTime) session.startTime = event.timestamp;
            if (event.timestamp > session.endTime) session.endTime = event.timestamp;
        }

        return Array.from(sessions.values())
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
            .map(s => ({
                ...s,
                durationSeconds: (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000,
                pathFlow: [...new Set(s.pathFlow)].slice(0, 5) // Unique paths, max 5 for preview
            }));
    },

    /**
     * Get all events for a specific session
     */
    async getSessionEvents(sessionId: string) {
        const events: any[] = [];

        // Fetch Views
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            const view = entry.value;
            if (view.sessionId === sessionId) events.push({ ...view, _type: 'view' });
        }

        // Fetch Interactions
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            const event = entry.value;
            if (event.sessionId === sessionId) events.push({ ...event, _type: 'event' });
        }

        return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },

    /**
     * Get per-user activity breakdown
     */
    async getUserActivityStats(daysBack = 30): Promise<Array<{
        userId: string;
        pageViews: number;
        events: number;
        lastActive: string;
        topPage: string;
    }>> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const userMap = new Map<string, {
            pageViews: number;
            events: number;
            lastActive: string;
            pages: Map<string, number>;
        }>();

        // Aggregate Page Views
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            if (entry.value.timestamp >= cutoffStr) {
                const v = entry.value;
                const user = userMap.get(v.userId) || {
                    pageViews: 0, events: 0, lastActive: v.timestamp, pages: new Map()
                };
                user.pageViews++;
                if (v.timestamp > user.lastActive) user.lastActive = v.timestamp;
                user.pages.set(v.path, (user.pages.get(v.path) || 0) + 1);
                userMap.set(v.userId, user);
            }
        }

        // Aggregate Events
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            if (entry.value.timestamp >= cutoffStr) {
                const e = entry.value;
                const user = userMap.get(e.userId) || {
                    pageViews: 0, events: 0, lastActive: e.timestamp, pages: new Map()
                };
                user.events++;
                if (e.timestamp > user.lastActive) user.lastActive = e.timestamp;
                userMap.set(e.userId, user);
            }
        }

        // Convert to array
        return Array.from(userMap.entries()).map(([userId, data]) => {
            // Find top page
            let topPage = '/';
            let topCount = 0;
            data.pages.forEach((count, path) => {
                if (count > topCount) {
                    topCount = count;
                    topPage = path;
                }
            });

            return {
                userId,
                pageViews: data.pageViews,
                events: data.events,
                lastActive: data.lastActive,
                topPage
            };
        }).sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
    },

    /**
     * Get Omnibox-specific analytics
     */
    async getOmniboxStats(daysBack = 30): Promise<{
        totalSearches: number;
        totalLogs: number;
        totalNavigations: number;
        topSearches: Array<{ query: string; count: number }>;
        topLoggedFoods: Array<{ food: string; count: number }>;
        topNavigations: Array<{ path: string; count: number }>;
        hourlyDistribution: number[];
    }> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const searches: string[] = [];
        const loggedFoods: string[] = [];
        const navigations: string[] = [];
        const hourlyDistribution = new Array(24).fill(0);

        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            const e = entry.value;
            if (e.timestamp < cutoffStr) continue;

            // Track Omnibox events
            if (e.type === 'omnibox_search' && e.metadata?.query) {
                searches.push(e.metadata.query);
                const hour = new Date(e.timestamp).getHours();
                hourlyDistribution[hour]++;
            }
            if (e.type === 'omnibox_log' && e.metadata?.food) {
                loggedFoods.push(e.metadata.food);
                const hour = new Date(e.timestamp).getHours();
                hourlyDistribution[hour]++;
            }
            if (e.type === 'omnibox_nav' && e.metadata?.path) {
                navigations.push(e.metadata.path);
                const hour = new Date(e.timestamp).getHours();
                hourlyDistribution[hour]++;
            }
        }

        // Aggregate top searches
        const searchCounts = new Map<string, number>();
        searches.forEach(q => searchCounts.set(q, (searchCounts.get(q) || 0) + 1));
        const topSearches = Array.from(searchCounts.entries())
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Aggregate top foods
        const foodCounts = new Map<string, number>();
        loggedFoods.forEach(f => foodCounts.set(f, (foodCounts.get(f) || 0) + 1));
        const topLoggedFoods = Array.from(foodCounts.entries())
            .map(([food, count]) => ({ food, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        // Aggregate top navigations
        const navCounts = new Map<string, number>();
        navigations.forEach(p => navCounts.set(p, (navCounts.get(p) || 0) + 1));
        const topNavigations = Array.from(navCounts.entries())
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        return {
            totalSearches: searches.length,
            totalLogs: loggedFoods.length,
            totalNavigations: navigations.length,
            topSearches,
            topLoggedFoods,
            topNavigations,
            hourlyDistribution
        };
    },

    /**
     * Get daily activity for timeline chart
     */
    async getDailyActivity(daysBack = 30): Promise<Array<{
        date: string;
        pageViews: number;
        events: number;
    }>> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const dailyMap = new Map<string, { pageViews: number; events: number }>();

        // Initialize all days
        for (let i = 0; i < daysBack; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyMap.set(dateStr, { pageViews: 0, events: 0 });
        }

        // Aggregate Page Views
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            if (entry.value.timestamp >= cutoffStr) {
                const dateStr = entry.value.timestamp.split('T')[0];
                const day = dailyMap.get(dateStr);
                if (day) day.pageViews++;
            }
        }

        // Aggregate Events
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            if (entry.value.timestamp >= cutoffStr) {
                const dateStr = entry.value.timestamp.split('T')[0];
                const day = dailyMap.get(dateStr);
                if (day) day.events++;
            }
        }

        return Array.from(dailyMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    },

    /**
     * Get retention (cohort analysis)
     * Groups users by their first seen date and tracks return rates
     */
    async getRetentionStats(daysBack = 30): Promise<any> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const userFirstSeen = new Map<string, string>(); // userId -> firstDate
        const userActivity = new Map<string, Set<string>>(); // userId -> Set of dates active

        // Fetch all PageViews for these users
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            const v = entry.value;
            const dateStr = v.timestamp.split('T')[0];

            if (!userFirstSeen.has(v.userId) || v.timestamp < userFirstSeen.get(v.userId)!) {
                userFirstSeen.set(v.userId, v.timestamp);
            }

            if (!userActivity.has(v.userId)) userActivity.set(v.userId, new Set());
            userActivity.get(v.userId)!.add(dateStr);
        }

        // Aggregate into cohorts
        const cohorts = new Map<string, { total: number; retained: number[] }>();
        const today = new Date();

        userFirstSeen.forEach((firstTimestamp, userId) => {
            const firstDateStr = firstTimestamp.split('T')[0];
            if (firstDateStr < cutoffStr) return;

            if (!cohorts.has(firstDateStr)) cohorts.set(firstDateStr, { total: 0, retained: new Array(14).fill(0) });
            const cohort = cohorts.get(firstDateStr)!;
            cohort.total++;

            // Check activity for the next 14 days
            const startDate = new Date(firstDateStr);
            for (let i = 1; i <= 14; i++) {
                const nextDate = new Date(startDate);
                nextDate.setDate(nextDate.getDate() + i);
                const nextDateStr = nextDate.toISOString().split('T')[0];

                if (userActivity.get(userId)?.has(nextDateStr)) {
                    cohort.retained[i - 1]++;
                }
            }
        });

        return Array.from(cohorts.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => b.date.localeCompare(a.date));
    },

    /**
     * Get pathing stats (transitions between pages)
     */
    async getPathingStats(daysBack = 7): Promise<any> {
        const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();
        const transitions = new Map<string, number>();
        const sessions = new Map<string, string[]>(); // sessionId -> path list

        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            if (entry.value.timestamp < cutoff) continue;
            const v = entry.value;
            if (!sessions.has(v.sessionId)) sessions.set(v.sessionId, []);
            sessions.get(v.sessionId)!.push(v.path);
        }

        sessions.forEach(paths => {
            for (let i = 0; i < paths.length - 1; i++) {
                const from = paths[i];
                const to = paths[i + 1];
                if (from === to) continue;
                const key = `${from} -> ${to}`;
                transitions.set(key, (transitions.get(key) || 0) + 1);
            }
        });

        return Array.from(transitions.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 30);
    },

    /**
     * Get hourly pulse (last 24-48 hours activity)
     */
    async getHourlyPulse(): Promise<any> {
        const now = new Date();
        const activity = new Array(24).fill(0);
        const cutoff = new Date(now.getTime() - 24 * 3600000).toISOString();

        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            if (entry.value.timestamp >= cutoff) {
                const hour = new Date(entry.value.timestamp).getHours();
                activity[hour]++;
            }
        }

        return activity;
    },

    /**
     * Get friction stats (average Time-to-Log)
     */
    async getFrictionStats(daysBack = 30): Promise<any> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const data: Record<string, { totalMs: number; count: number }> = {};

        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] }, { reverse: true })) {
            const e = entry.value;
            if (e.timestamp < cutoffStr) break;

            if (e.metadata?.durationMs) {
                const label = e.type === 'omnibox_log' ? 'Omnibox' : 'QuickAdd';
                if (!data[label]) data[label] = { totalMs: 0, count: 0 };
                data[label].totalMs += e.metadata.durationMs;
                data[label].count++;
            }
        }

        return Object.entries(data).map(([label, stats]) => ({
            label,
            avgSeconds: Number((stats.totalMs / stats.count / 1000).toFixed(2))
        }));
    },

    /**
     * Get exit statistics (top pages where users end their session)
     */
    async getExitStats(daysBack = 7): Promise<any> {
        const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();
        const sessionExits = new Map<string, { path: string, timestamp: string }>();

        // We need to find the latest page view for each session
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            if (entry.value.timestamp < cutoff) continue;
            const v = entry.value;

            const existing = sessionExits.get(v.sessionId);
            if (!existing || v.timestamp > existing.timestamp) {
                sessionExits.set(v.sessionId, { path: v.path, timestamp: v.timestamp });
            }
        }

        const exitCounts = new Map<string, number>();
        sessionExits.forEach(exit => {
            exitCounts.set(exit.path, (exitCounts.get(exit.path) || 0) + 1);
        });

        return Array.from(exitCounts.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    },

    /**
     * Get global app data statistics (aggregated from all users)
     */
    async getAppDataStats(daysBack = 30): Promise<any> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const foodCounts = new Map<string, number>();
        const exerciseCounts = new Map<string, number>();
        let totalCals = 0;
        let mealCount = 0;
        let totalDistance = 0;
        let totalTonnage = 0;
        let strengthWorkoutCount = 0;
        let cardioWorkoutCount = 0;

        // 1. Aggregate Food from all users
        for await (const entry of kv.list<any>({ prefix: ["meals"] })) {
            const meal = entry.value;
            if (meal.date >= cutoffStr) {
                totalCals += meal.calories || 0;
                mealCount++;
                if (meal.items) {
                    meal.items.forEach((item: any) => {
                        foodCounts.set(item.name, (foodCounts.get(item.name) || 0) + 1);
                    });
                }
            }
        }

        // 2. Aggregate Activities (Cardio)
        for await (const entry of kv.list<any>({ prefix: ["activities"] })) {
            const act = entry.value;
            if (act.date >= cutoffStr && act.status === 'COMPLETED') {
                cardioWorkoutCount++;
                if (act.type) exerciseCounts.set(act.type, (exerciseCounts.get(act.type) || 0) + 1);
                if (act.performance?.distance) totalDistance += act.performance.distance;
            }
        }

        // 3. Aggregate Strength
        for await (const entry of kv.list<any>({ prefix: ["strength_workouts"] })) {
            const workout = entry.value;
            if (workout.date >= cutoffStr) {
                strengthWorkoutCount++;
                totalTonnage += workout.totalVolume || 0;
            }
        }

        // Format top lists
        const topFoods = Array.from(foodCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);

        const topExercises = Array.from(exerciseCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            nutrition: {
                topFoods,
                avgDailyCalories: mealCount > 0 ? Math.round(totalCals / (mealCount / 3)) : 0, // Approx 3 meals/day
                totalMealsLogged: mealCount
            },
            training: {
                topExercises,
                totalDistance: Math.round(totalDistance),
                totalTonnage: Math.round(totalTonnage),
                strengthWorkoutCount,
                cardioWorkoutCount
            }
        };
    },

    /**
     * Get error statistics
     */
    async getErrorStats(daysBack = 7): Promise<any> {
        const cutoff = new Date(Date.now() - daysBack * 86400000).toISOString();
        const errors = new Map<string, { count: number, lastSeen: string, paths: Set<string> }>();

        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            const e = entry.value;
            if (e.timestamp < cutoff) continue;
            if (e.type !== 'error') continue;

            const existing = errors.get(e.label) || { count: 0, lastSeen: e.timestamp, paths: new Set<string>() };
            existing.count++;
            if (e.timestamp > existing.lastSeen) existing.lastSeen = e.timestamp;
            if (e.path) existing.paths.add(e.path);
            errors.set(e.label, existing);
        }

        return Array.from(errors.entries())
            .map(([message, data]) => ({
                message,
                count: data.count,
                lastSeen: data.lastSeen,
                pathCount: data.paths.size,
                topPath: Array.from(data.paths)[0]
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }
};
