import { kv as db } from '../kv.ts';
import type {
    FeedEvent,
    FollowPreference,
    FeedEventCategory,
    FeedQueryOptions,
    FeedEventType,
    DEFAULT_FOLLOW_PREFERENCES,
    VisibilityLevel
} from '../../models/feedTypes.ts';
import { EVENT_TYPE_TO_CATEGORY } from '../../models/feedTypes.ts';
import type { UserPrivacy } from '../../models/types.ts';

// Map feed categories to privacy sharing categories
// Note: BODY_METRIC events are categorized under 'HEALTH' in FeedEventCategory
// but we want to check the 'body' privacy setting for those events
const CATEGORY_TO_PRIVACY_KEY: Record<FeedEventCategory, keyof UserPrivacy['sharing']> = {
    'TRAINING': 'training',
    'NUTRITION': 'nutrition',
    'HEALTH': 'health',   // This includes BODY_METRIC and HEALTH_SLEEP
    'SOCIAL': 'social',
};

/**
 * Check if a viewer can see an event from an owner, respecting categoryOverrides
 * @param viewerId - The user trying to view the event
 * @param event - The feed event to check
 * @param ownerPrivacy - The owner's privacy settings (if available)
 * @returns true if the viewer can see the event
 */
function canViewEventWithOverrides(
    viewerId: string,
    event: FeedEvent,
    ownerPrivacy: UserPrivacy | undefined
): boolean {
    // If no privacy settings, fall back to event's visibility level
    if (!ownerPrivacy) {
        return event.visibility === 'PUBLIC' || event.visibility === 'FRIENDS';
    }

    const eventCategory = EVENT_TYPE_TO_CATEGORY[event.type as FeedEventType];
    const privacyKey = CATEGORY_TO_PRIVACY_KEY[eventCategory];

    // 1. Check for per-person override first
    const overrides = ownerPrivacy.categoryOverrides?.[viewerId];
    if (overrides) {
        const categoryOverride = overrides[privacyKey];
        if (categoryOverride === true) return true;   // Explicit allow
        if (categoryOverride === false) return false; // Explicit deny
    }

    // 2. Fall back to default visibility level
    return event.visibility === 'PUBLIC' || event.visibility === 'FRIENDS';
}


/**
 * Feed Repository using Deno KV
 * 
 * Schema:
 * feed_events:{userId}:{timestamp}:{eventId} -> FeedEvent
 * feed_events_by_id:{eventId} -> FeedEvent
 * follow_preferences:{followerId}:{targetUserId} -> FollowPreference
 * 
 * For efficient time-based queries, we use timestamp in the key
 */
export class FeedRepository {

    // ============================================
    // Feed Events
    // ============================================

    /**
     * Create a new feed event
     */
    static async createEvent(event: Omit<FeedEvent, 'id' | 'createdAt'>): Promise<FeedEvent> {
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        const fullEvent: FeedEvent = {
            ...event,
            id,
            createdAt,
        };

        // Store with timestamp-based key for chronological iteration
        const timestampKey = event.timestamp.replace(/[:.]/g, '-'); // Normalize for key

        const tx = db.atomic();

        // Primary storage (by user + time for timeline queries)
        tx.set(['feed_events', event.userId, timestampKey, id], fullEvent);

        // Index by ID for direct lookup
        tx.set(['feed_events_by_id', id], fullEvent);

        await tx.commit();

        return fullEvent;
    }

    /**
     * Get a single event by ID
     */
    static async getEventById(eventId: string): Promise<FeedEvent | null> {
        const res = await db.get(['feed_events_by_id', eventId]);
        return res.value as FeedEvent | null;
    }

    /**
     * Get events for a specific user (their profile timeline)
     */
    static async getUserEvents(
        userId: string,
        options: FeedQueryOptions = {}
    ): Promise<FeedEvent[]> {
        const { limit = 50, types, categories } = options;

        const iter = db.list<FeedEvent>({
            prefix: ['feed_events', userId],
        }, {
            limit: limit * 2, // Over-fetch to account for filtering
            reverse: true,   // Newest first
        });

        const events: FeedEvent[] = [];

        for await (const entry of iter) {
            const event = entry.value;

            // Apply type filter
            if (types && types.length > 0 && !types.includes(event.type)) {
                continue;
            }

            // Apply category filter
            if (categories && categories.length > 0) {
                const eventCategory = EVENT_TYPE_TO_CATEGORY[event.type as FeedEventType];
                if (!categories.includes(eventCategory)) {
                    continue;
                }
            }

            events.push(event);

            if (events.length >= limit) break;
        }

        return events;
    }

    /**
     * Get aggregated feed for a user (from all followed users)
     * This applies the Matrix Follow preferences
     */
    static async getMainFeed(
        userId: string,
        options: FeedQueryOptions = {}
    ): Promise<FeedEvent[]> {
        const { limit = 50 } = options;

        // 1. Get all users this person follows
        const followingIter = db.list({ prefix: ['following', userId] });
        const followingUserIds: string[] = [];

        for await (const entry of followingIter) {
            followingUserIds.push(entry.key[2] as string);
        }

        if (followingUserIds.length === 0) {
            return [];
        }

        // 2. Get preferences for each followed user
        const preferencesMap = new Map<string, FollowPreference>();
        for (const targetId of followingUserIds) {
            const pref = await this.getFollowPreference(userId, targetId);
            if (pref) {
                preferencesMap.set(targetId, pref);
            }
        }

        // 3. Fetch events from all followed users
        const allEvents: FeedEvent[] = [];

        for (const targetId of followingUserIds) {
            const preference = preferencesMap.get(targetId);
            const subscribedCategories = preference?.subscribedCategories || ['TRAINING'];

            // Get recent events from this user
            const userEvents = await this.getUserEvents(targetId, {
                limit: Math.ceil(limit / (followingUserIds.length + 1)) + 10,
                categories: options.categories || subscribedCategories,
            });

            // Filter by visibility (only PUBLIC and FRIENDS)
            const visibleEvents = userEvents.filter(e =>
                e.visibility === 'PUBLIC' || e.visibility === 'FRIENDS'
            );

            allEvents.push(...visibleEvents);
        }

        // 3b. Add own events (always visible to self)
        const myEvents = await this.getUserEvents(userId, {
            limit: Math.ceil(limit / (followingUserIds.length + 1)) + 10,
            includePrivate: true,
            categories: options.categories,
        });
        allEvents.push(...myEvents);

        // 4. Sort by timestamp (newest first) and limit
        allEvents.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        return allEvents.slice(0, limit);
    }

    /**
     * Delete an event
     */
    static async deleteEvent(eventId: string): Promise<boolean> {
        const event = await this.getEventById(eventId);
        if (!event) return false;

        const timestampKey = event.timestamp.replace(/[:.]/g, '-');

        const tx = db.atomic();
        tx.delete(['feed_events', event.userId, timestampKey, eventId]);
        tx.delete(['feed_events_by_id', eventId]);
        await tx.commit();

        return true;
    }

    // ============================================
    // Follow Preferences (The Matrix)
    // ============================================

    /**
     * Get follow preferences for a specific follower->target relationship
     */
    static async getFollowPreference(
        followerId: string,
        targetUserId: string
    ): Promise<FollowPreference | null> {
        const res = await db.get(['follow_preferences', followerId, targetUserId]);
        return res.value as FollowPreference | null;
    }

    /**
     * Set or update follow preferences
     */
    static async setFollowPreference(preference: Omit<FollowPreference, 'id' | 'createdAt' | 'updatedAt'>): Promise<FollowPreference> {
        const existing = await this.getFollowPreference(preference.followerId, preference.targetUserId);

        const now = new Date().toISOString();
        const fullPreference: FollowPreference = {
            id: existing?.id || crypto.randomUUID(),
            ...preference,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        };

        await db.set(
            ['follow_preferences', preference.followerId, preference.targetUserId],
            fullPreference
        );

        return fullPreference;
    }

    /**
     * Delete follow preferences (when unfollowing)
     */
    static async deleteFollowPreference(followerId: string, targetUserId: string): Promise<void> {
        await db.delete(['follow_preferences', followerId, targetUserId]);
    }

    /**
     * Get all preferences for a follower (what they subscribe to from others)
     */
    static async getAllFollowPreferences(followerId: string): Promise<FollowPreference[]> {
        const iter = db.list<FollowPreference>({ prefix: ['follow_preferences', followerId] });
        const preferences: FollowPreference[] = [];

        for await (const entry of iter) {
            preferences.push(entry.value);
        }

        return preferences;
    }

    // ============================================
    // Bulk Operations
    // ============================================

    /**
     * Create default follow preferences when someone follows a user
     */
    static async createDefaultFollowPreference(followerId: string, targetUserId: string): Promise<FollowPreference> {
        return this.setFollowPreference({
            followerId,
            targetUserId,
            subscribedCategories: ['TRAINING'], // Default to training only
            detailLevel: 'full',
            notificationsEnabled: false,
        });
    }

    /**
     * Get event counts by type for a user (for stats)
     */
    static async getEventCounts(userId: string): Promise<Record<FeedEventType, number>> {
        const events = await this.getUserEvents(userId, { limit: 1000 });

        const counts: Record<string, number> = {};
        for (const event of events) {
            counts[event.type] = (counts[event.type] || 0) + 1;
        }

        return counts as Record<FeedEventType, number>;
    }

    /**
     * Calculate training form: % change in training activity count (last 7d vs prev 7d)
     */
    static async getTrainingForm(userId: string): Promise<number> {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const events = await this.getUserEvents(userId, { limit: 100, categories: ['TRAINING'] });

        const currentPeriodEvents = events.filter(e => {
            const date = new Date(e.timestamp);
            return date >= sevenDaysAgo && date <= now;
        });

        const prevPeriodEvents = events.filter(e => {
            const date = new Date(e.timestamp);
            return date >= fourteenDaysAgo && date < sevenDaysAgo;
        });

        const currentCount = currentPeriodEvents.length;
        const prevCount = prevPeriodEvents.length;

        if (prevCount === 0) {
            return currentCount > 0 ? 100 : 0;
        }

        return Math.round(((currentCount / prevCount) - 1) * 100);
    }

    /**
     * Update visibility of a specific event
     */
    static async updateEventVisibility(userId: string, eventId: string, visibility: VisibilityLevel): Promise<boolean> {
        // 1. Get from ID index
        const indexKey = ['feed_events_by_id', eventId];
        const res = await db.get<FeedEvent>(indexKey);

        if (!res.value) return false;

        const event = res.value;
        // Verify ownership
        if (event.userId !== userId) return false;

        // 2. Update visibility
        event.visibility = visibility;

        // 3. Update both entries atomically
        const timestampKey = event.timestamp.replace(/[:.]/g, '-');
        const timelineKey = ['feed_events', userId, timestampKey, eventId];

        const tx = db.atomic();
        tx.set(indexKey, event);
        tx.set(timelineKey, event);

        const result = await tx.commit();
        return result.ok;
    }
}
