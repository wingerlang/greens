import { kv } from "../kv.ts";
import { User, DEFAULT_USER_SETTINGS, DEFAULT_PRIVACY, UserRole, SubscriptionStatus, SubscriptionTier } from "../../models/types.ts";

export interface DBUser extends User {
    passHash: string;
    salt: string;
}

import { hashPassword } from "../utils/crypto.ts";

// Helper to ensure subscription object exists (Lazy Migration)
export function ensureUserSubscription(user: any): DBUser {
    if (!user.subscription) {
        // Migration logic
        const tier: SubscriptionTier = user.plan === 'evergreen' ? 'evergreen' : 'free';
        user.subscription = {
            tier,
            status: 'active',
            startedAt: user.createdAt || new Date().toISOString(),
            provider: 'manual',
            history: []
        };
    }
    // Ensure new fields are present even if object exists
    if (!user.subscription.status) user.subscription.status = 'active';

    return user as DBUser;
}

export async function createUser(username: string, password: string, email?: string, role: UserRole = 'user'): Promise<DBUser | null> {
    const usernameKey = ['users_by_username', username.toLowerCase()];
    const handleKey = ['users_by_handle', username.toLowerCase()];

    const existingUsername = await kv.get(usernameKey);
    if (existingUsername.value) return null;

    const salt = crypto.randomUUID();
    const passHash = await hashPassword(password, salt);
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();

    const user: DBUser = {
        id: userId,
        username,
        passHash,
        salt,
        role,
        subscription: {
            tier: 'free',
            status: 'active',
            startedAt: now,
            provider: 'manual',
            history: []
        },
        createdAt: now,
        email: email || '',
        name: username,
        handle: username.toLowerCase(),
        settings: DEFAULT_USER_SETTINGS,
        privacy: DEFAULT_PRIVACY,
        followersCount: 0,
        followingCount: 0
    };

    const res = await kv.atomic()
        .check(existingUsername)
        .set(['users', userId], user)
        .set(usernameKey, userId)
        .set(handleKey, userId)
        .commit();

    return res.ok ? user : null;
}

export async function getUser(username: string): Promise<DBUser | null> {
    const idEntry = await kv.get(['users_by_username', username]);
    if (!idEntry.value) return null;
    const userEntry = await kv.get(['users', idEntry.value as string]);
    if (!userEntry.value) return null;
    return ensureUserSubscription(userEntry.value);
}

export async function getUserById(id: string): Promise<DBUser | null> {
    const entry = await kv.get(['users', id]);
    if (!entry.value) return null;

    const user = ensureUserSubscription(entry.value);

    // Merge dynamic stats
    const followersRes = await kv.get<any>(['stats', id, 'followersCount']);
    const followingRes = await kv.get<any>(['stats', id, 'followingCount']);

    user.followersCount = Number(followersRes.value?.value || 0n);
    user.followingCount = Number(followingRes.value?.value || 0n);

    return user;
}

export async function getAllUsers(limit: number = 100, cursor?: string): Promise<{ users: DBUser[], cursor: string }> {
    const iter = kv.list({ prefix: ['users'] }, { limit, cursor });
    const users: DBUser[] = [];
    for await (const entry of iter) {
        users.push(ensureUserSubscription(entry.value));
    }
    return { users, cursor: iter.cursor };
}

export async function saveUser(user: DBUser): Promise<void> {
    const oldUserEntry = await kv.get<DBUser>(['users', user.id]);
    const oldUser = oldUserEntry.value;

    const op = kv.atomic()
        .set(['users', user.id], user);

    // Update indexes if they changed
    if (oldUser) {
        if (oldUser.username !== user.username) {
            op.delete(['users_by_username', oldUser.username.toLowerCase()]);
            op.set(['users_by_username', user.username.toLowerCase()], user.id);
        }
        if (oldUser.handle !== user.handle) {
            if (oldUser.handle) op.delete(['users_by_handle', oldUser.handle.toLowerCase()]);
            if (user.handle) op.set(['users_by_handle', user.handle.toLowerCase()], user.id);
        }
    } else {
        // New user path (though usually handled by createUser)
        op.set(['users_by_username', user.username.toLowerCase()], user.id);
        if (user.handle) op.set(['users_by_handle', user.handle.toLowerCase()], user.id);
    }

    const res = await op.commit();
    if (!res.ok) throw new Error("Failed to save user (atomic conflict)");
}

import { getSession, getUserSessions, revokeAllUserSessions, revokeSession } from "./session.ts";
import { getUserData, saveUserData } from "./data.ts";

export function sanitizeUser(user: DBUser): User {
    const { passHash, salt, ...rest } = user;
    return rest;
}

export async function resetUserData(userId: string, type: 'meals' | 'exercises' | 'weight' | 'all'): Promise<void> {
    if (type === 'all') {
        const user = await getUserById(userId);
        if (user) {
            await kv.atomic()
                .delete(["users", userId])
                .delete(["user_profiles", userId])
                .delete(["users_by_username", user.username])
                .delete(["users_by_handle", user.handle || ""])
                .commit();

            // Also cleanup sessions
            await revokeAllUserSessions(userId);
        }
        return;
    }

    const data = await getUserData(userId);
    if (!data) return;

    if (type === 'meals') {
        data.mealEntries = [];
    } else if (type === 'exercises') {
        data.exerciseEntries = [];
        data.trainingCycles = [];
        data.plannedActivities = [];
    } else if (type === 'weight') {
        data.weightEntries = [];
    }

    await saveUserData(userId, data);
}

export async function getAdmins(): Promise<DBUser[]> {
    const iter = kv.list({ prefix: ['users'] });
    const admins: DBUser[] = [];
    for await (const entry of iter) {
        const user = ensureUserSubscription(entry.value);
        if (user.role === 'admin' || user.role === 'developer') {
            admins.push(user);
        }
    }
    return admins;
}
