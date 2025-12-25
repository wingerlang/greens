/// <reference lib="deno.ns" />

/**
 * Shared Deno KV instance
 * Singleton pattern for database connection
 */
export const kv = await Deno.openKv("./greens.db");

export async function closeKv() {
    await kv.close();
}
