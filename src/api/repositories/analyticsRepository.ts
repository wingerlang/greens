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
     * NOTE: In a real production app at scale, we would pre-aggregate these.
     * For this scale, scanning the last X days is fine.
     */
    async getStats(daysBack = 30): Promise<AnalyticsStats> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const pageViews: PageView[] = [];
        const events: InteractionEvent[] = [];

        // Fetch Page Views
        for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
            if (entry.value.timestamp >= cutoffStr) {
                pageViews.push(entry.value);
            }
        }

        // Fetch Events
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            if (entry.value.timestamp >= cutoffStr) {
                events.push(entry.value);
            }
        }

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

        return {
            totalPageViews: pageViews.length,
            totalEvents: events.length,
            popularPages,
            popularInteractions,
            activeUsers24h: activeUserIds.size
        };
    },

    /**
     * Get filtered events for raw event log
     */
    async getEventsFiltered(filters: {
        userId?: string;
        type?: string;
        daysBack?: number;
        limit?: number;
    }): Promise<{ events: InteractionEvent[]; pageViews: PageView[]; total: number }> {
        const { userId, type, daysBack = 7, limit = 100 } = filters;

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const events: InteractionEvent[] = [];
        const pageViews: PageView[] = [];

        // Fetch Events
        for await (const entry of kv.list<InteractionEvent>({ prefix: [KEY_PREFIX.EVENT] })) {
            if (entry.value.timestamp >= cutoffStr) {
                if (userId && entry.value.userId !== userId) continue;
                if (type && entry.value.type !== type) continue;
                events.push(entry.value);
            }
        }

        // Fetch Page Views (if no type filter or type is 'pageview')
        if (!type || type === 'pageview') {
            for await (const entry of kv.list<PageView>({ prefix: [KEY_PREFIX.PAGE_VIEW] })) {
                if (entry.value.timestamp >= cutoffStr) {
                    if (userId && entry.value.userId !== userId) continue;
                    pageViews.push(entry.value);
                }
            }
        }

        // Sort by timestamp descending and limit
        const allEvents = [...events].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ).slice(0, limit);

        const allPageViews = [...pageViews].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ).slice(0, limit);

        return {
            events: allEvents,
            pageViews: allPageViews,
            total: events.length + pageViews.length
        };
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
        topSearches: Array<{ query: string; count: number }>;
        topLoggedFoods: Array<{ food: string; count: number }>;
        hourlyDistribution: number[];
    }> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysBack);
        const cutoffStr = cutoff.toISOString();

        const searches: string[] = [];
        const loggedFoods: string[] = [];
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

        return {
            totalSearches: searches.length,
            totalLogs: loggedFoods.length,
            topSearches,
            topLoggedFoods,
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
    }
};
