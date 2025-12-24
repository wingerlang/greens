import { kv as db } from '../kv.ts'; // Renaming to db to match existing code usage
import { User } from '../../models/types.ts';

/**
 * Social Repository using Deno KV
 * 
 * Schema:
 * followers:{targetId}:{followerId} -> timestamp
 * following:{followerId}:{targetId} -> timestamp
 * 
 * Indexes:
 * users_by_handle:{handle} -> userId
 */

export class SocialRepository {

    // --- Handles ---

    static async setHandle(userId: string, handle: string): Promise<boolean> {
        const handleKey = ['users_by_handle', handle.toLowerCase()];

        // Check availability
        const existing = await db.get(handleKey);
        if (existing.value && existing.value !== userId) {
            return false; // Taken
        }

        // Reserving
        await db.set(handleKey, userId);
        return true;
    }

    static async getUserIdByHandle(handle: string): Promise<string | null> {
        const res = await db.get(['users_by_handle', handle.toLowerCase()]);
        return res.value as string | null;
    }

    // --- Graph Operations ---

    static async followUser(followerId: string, targetId: string): Promise<void> {
        const now = new Date().toISOString();

        const tx = db.atomic();

        // Add to "followers" list of target
        tx.set(['followers', targetId, followerId], now);

        // Add to "following" list of follower
        tx.set(['following', followerId, targetId], now);

        // Increment counts (This requires a more complex atomic op or eventual consistency counter)
        // For simplicity, we might just count them on read or use a counter key.
        // Let's use separate counter keys for O(1) reads.
        tx.sum(['stats', targetId, 'followersCount'], 1n);
        tx.sum(['stats', followerId, 'followingCount'], 1n);

        await tx.commit();
    }

    static async unfollowUser(followerId: string, targetId: string): Promise<void> {
        const tx = db.atomic();

        tx.delete(['followers', targetId, followerId]);
        tx.delete(['following', followerId, targetId]);

        // Decrement (KV sum supports negative only if using Deno KV special sum logic, 
        // typically simple kv.sum expects positive. Standard KV doesn't handle decrement easily without read-modify-write if using sum types.
        // But for 'sum' operation with bigint, adding negative works.)
        tx.sum(['stats', targetId, 'followersCount'], -1n);
        tx.sum(['stats', followerId, 'followingCount'], -1n);

        await tx.commit();
    }

    static async isFollowing(followerId: string, targetId: string): Promise<boolean> {
        const res = await db.get(['following', followerId, targetId]);
        return !!res.value;
    }

    static async getFollowers(userId: string): Promise<string[]> {
        const iter = db.list({ prefix: ['followers', userId] });
        const followers: string[] = [];
        for await (const entry of iter) {
            // key is ['followers', userId, followerId]
            followers.push(entry.key[2] as string);
        }
        return followers;
    }

    static async getFollowing(userId: string): Promise<string[]> {
        const iter = db.list({ prefix: ['following', userId] });
        const following: string[] = [];
        for await (const entry of iter) {
            // key is ['following', userId, targetId]
            following.push(entry.key[2] as string);
        }
        return following;
    }
}
