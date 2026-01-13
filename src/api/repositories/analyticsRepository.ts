import { kv } from '../../db/db.ts';
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
    }
};
