import { kv } from "../kv.ts";
import { User, DEFAULT_USER_SETTINGS, DEFAULT_PRIVACY } from "../../models/types.ts";
import { encodeBase64 } from "jsr:@std/encoding/base64";

export interface DBUser extends User {
    passHash: string;
    salt: string;
}

// Crypto Helpers
async function hashPassword(password: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        key,
        256
    );

    return encodeBase64(bits);
}

export async function createUser(username: string, password: string, email?: string): Promise<DBUser | null> {
    const existing = await kv.get(['users_by_username', username]);
    if (existing.value) return null;

    const salt = crypto.randomUUID();
    const passHash = await hashPassword(password, salt);

    const user: DBUser = {
        id: crypto.randomUUID(),
        username,
        passHash,
        salt,
        role: 'user',
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
