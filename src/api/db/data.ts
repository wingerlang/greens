import { kv } from "../kv.ts";
import { UserData } from "../../models/types.ts";

export async function getUserData(userId: string): Promise<UserData | null> {
    const res = await kv.get(["user_profiles", userId]);
    return res.value as UserData;
}

export async function saveUserData(userId: string, data: UserData): Promise<void> {
    await kv.set(["user_profiles", userId], { ...data, updatedAt: new Date().toISOString() });
}
