import { kv as db } from "../kv.ts"; // Renaming to db to match existing code usage
import { User } from "../../models/types.ts";

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
    const handleKey = ["users_by_handle", handle.toLowerCase()];

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
    const res = await db.get(["users_by_handle", handle.toLowerCase()]);
    return res.value as string | null;
  }

  // --- Graph Operations ---

  static async followUser(followerId: string, targetId: string): Promise<void> {
    const now = new Date().toISOString();
    const tx = db.atomic();

    // 1. Relationship Graph
    tx.set(["followers", targetId, followerId], now);
    tx.set(["following", followerId, targetId], now);

    // 2. Update User Counts (Read-Modify-Write for consistency)
    // Note: For high concurrency, atomic increment on separate keys + merge on read is better.
    // But given the simplicity requirement, we will update the User objects directly here if possible.
    // However, we cannot easily do that inside a pure atomic without reading first inside a transaction loop.
    // For now, let's Stick to the 'stats' keys for ATOMICITY, but UPDATE the getUserById specific logic to READ them.

    tx.sum(["stats", targetId, "followersCount"], 1n);
    tx.sum(["stats", followerId, "followingCount"], 1n);

    await tx.commit();
  }

  static async unfollowUser(
    followerId: string,
    targetId: string,
  ): Promise<void> {
    const tx = db.atomic();

    tx.delete(["followers", targetId, followerId]);
    tx.delete(["following", followerId, targetId]);

    // Decrement using negative bigint
    tx.sum(["stats", targetId, "followersCount"], -1n);
    tx.sum(["stats", followerId, "followingCount"], -1n);

    await tx.commit();
  }

  static async isFollowing(
    followerId: string,
    targetId: string,
  ): Promise<boolean> {
    const res = await db.get(["following", followerId, targetId]);
    return !!res.value;
  }

  static async getFollowers(userId: string): Promise<string[]> {
    const iter = db.list({ prefix: ["followers", userId] });
    const followers: string[] = [];
    for await (const entry of iter) {
      // key is ['followers', userId, followerId]
      followers.push(entry.key[2] as string);
    }
    return followers;
  }

  static async getFollowing(userId: string): Promise<string[]> {
    const iter = db.list({ prefix: ["following", userId] });
    const following: string[] = [];
    for await (const entry of iter) {
      // key is ['following', userId, targetId]
      following.push(entry.key[2] as string);
    }
    return following;
  }
}
