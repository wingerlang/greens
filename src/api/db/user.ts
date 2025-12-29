import { kv } from "../kv.ts";
import { User, DEFAULT_USER_SETTINGS, DEFAULT_PRIVACY } from "../../models/types.ts";

export interface DBUser extends User {
    passHash: string;
    salt: string;
}

import { hashPassword } from "../utils/crypto.ts";

export async function createUser(username: string, password: string, email?: string, role: 'user' | 'admin' = 'user'): Promise<DBUser | null> {
    const existing = await kv.get(['users_by_username', username]);
    if (existing.value) return null;

    const salt = crypto.randomUUID();
    const passHash = await hashPassword(password, salt);

    const user: DBUser = {
        id: crypto.randomUUID(),
        username,
        passHash,
        salt,
        role,
        plan: 'free',
        createdAt: new Date().toISOString(),
        email: email || '',
        name: username,
        handle: username.toLowerCase(),
        settings: DEFAULT_USER_SETTINGS,
        privacy: DEFAULT_PRIVACY,
        followersCount: 0,
        followingCount: 0
    };

    const res = await kv.atomic()
        .set(['users', user.id], user)
        .set(['users_by_username', username], user.id)
        .commit();

    return res.ok ? user : null;
}

export async function getUser(username: string): Promise<DBUser | null> {
    const idEntry = await kv.get(['users_by_username', username]);
    if (!idEntry.value) return null;
    const userEntry = await kv.get(['users', idEntry.value as string]);
    return userEntry.value as DBUser;
}

export async function getUserById(id: string): Promise<DBUser | null> {
    const entry = await kv.get(['users', id]);
    return entry.value as DBUser;
}

export async function getAllUsers(): Promise<DBUser[]> {
    const iter = kv.list({ prefix: ['users'] });
    const users: DBUser[] = [];
    for await (const entry of iter) {
        users.push(entry.value as DBUser);
    }
    return users;
}

export async function saveUser(user: DBUser): Promise<void> {
    await kv.set(['users', user.id], user);
    // Maintain indexes
    if (user.username) await kv.set(['users_by_username', user.username], user.id);
    if (user.handle) await kv.set(['users_by_handle', user.handle.toLowerCase()], user.id);
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
