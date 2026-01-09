/**
 * Backup API Handler
 * Handles backup creation, listing, and restoration via file storage
 */

import { authenticate } from "../middleware.ts";

const BACKUPS_DIR = "./data/backups";

// Ensure backups directory exists
async function ensureBackupsDir(userId: string): Promise<string> {
    const userBackupsDir = `${BACKUPS_DIR}/${userId}`;
    try {
        await Deno.mkdir(userBackupsDir, { recursive: true });
    } catch {
        // Directory already exists
    }
    return userBackupsDir;
}

export async function handleBackupRoutes(
    req: Request,
    url: URL,
    headers: Headers
): Promise<Response> {
    const method = req.method;

    // All backup routes require authentication
    const ctx = await authenticate(req);
    if (!ctx) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers,
        });
    }

    const userId = ctx.user.id;
    const backupsDir = await ensureBackupsDir(userId);

    // GET /api/backup/snapshots - List all snapshots
    if (method === "GET" && url.pathname === "/api/backup/snapshots") {
        try {
            const metadataPath = `${backupsDir}/metadata.json`;
            try {
                const metadata = await Deno.readTextFile(metadataPath);
                return new Response(metadata, { headers });
            } catch {
                // No backups yet
                return new Response(JSON.stringify([]), { headers });
            }
        } catch (e) {
            console.error("[Backup] Error listing snapshots:", e);
            return new Response(
                JSON.stringify({ error: "Failed to list snapshots" }),
                { status: 500, headers }
            );
        }
    }

    // GET /api/backup/snapshots/:id - Get snapshot data
    if (method === "GET" && url.pathname.startsWith("/api/backup/snapshots/")) {
        const snapshotId = url.pathname.split("/").pop();
        if (!snapshotId) {
            return new Response(JSON.stringify({ error: "Missing snapshot ID" }), {
                status: 400,
                headers,
            });
        }

        try {
            const dataPath = `${backupsDir}/${snapshotId}.json`;
            const data = await Deno.readTextFile(dataPath);
            return new Response(data, { headers });
        } catch {
            return new Response(JSON.stringify({ error: "Snapshot not found" }), {
                status: 404,
                headers,
            });
        }
    }

    // POST /api/backup/snapshots - Create new snapshot
    if (method === "POST" && url.pathname === "/api/backup/snapshots") {
        try {
            const body = await req.json();
            const { snapshot, data } = body;

            if (!snapshot || !data) {
                return new Response(
                    JSON.stringify({ error: "Missing snapshot or data" }),
                    { status: 400, headers }
                );
            }

            // Save snapshot data
            const dataPath = `${backupsDir}/${snapshot.id}.json`;
            await Deno.writeTextFile(dataPath, JSON.stringify(data));

            // Update metadata
            const metadataPath = `${backupsDir}/metadata.json`;
            let snapshots = [];
            try {
                const existing = await Deno.readTextFile(metadataPath);
                snapshots = JSON.parse(existing);
            } catch {
                // No existing metadata
            }

            snapshots.unshift(snapshot);

            // Enforce max snapshots (keep 50)
            if (snapshots.length > 50) {
                const toRemove = snapshots.slice(50);
                for (const s of toRemove) {
                    try {
                        await Deno.remove(`${backupsDir}/${s.id}.json`);
                    } catch {
                        // File might not exist
                    }
                }
                snapshots = snapshots.slice(0, 50);
            }

            await Deno.writeTextFile(metadataPath, JSON.stringify(snapshots));

            return new Response(JSON.stringify({ success: true, snapshot }), {
                status: 201,
                headers,
            });
        } catch (e) {
            console.error("[Backup] Error creating snapshot:", e);
            return new Response(
                JSON.stringify({ error: "Failed to create snapshot" }),
                { status: 500, headers }
            );
        }
    }

    // DELETE /api/backup/snapshots/:id - Delete snapshot
    if (
        method === "DELETE" &&
        url.pathname.startsWith("/api/backup/snapshots/")
    ) {
        const snapshotId = url.pathname.split("/").pop();
        if (!snapshotId) {
            return new Response(JSON.stringify({ error: "Missing snapshot ID" }), {
                status: 400,
                headers,
            });
        }

        try {
            // Remove data file
            try {
                await Deno.remove(`${backupsDir}/${snapshotId}.json`);
            } catch {
                // File might not exist
            }

            // Update metadata
            const metadataPath = `${backupsDir}/metadata.json`;
            let snapshots = [];
            try {
                const existing = await Deno.readTextFile(metadataPath);
                snapshots = JSON.parse(existing);
            } catch {
                // No metadata
            }

            snapshots = snapshots.filter((s: { id: string }) => s.id !== snapshotId);
            await Deno.writeTextFile(metadataPath, JSON.stringify(snapshots));

            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            console.error("[Backup] Error deleting snapshot:", e);
            return new Response(
                JSON.stringify({ error: "Failed to delete snapshot" }),
                { status: 500, headers }
            );
        }
    }

    // GET /api/backup/settings - Get backup settings
    if (method === "GET" && url.pathname === "/api/backup/settings") {
        try {
            const settingsPath = `${backupsDir}/settings.json`;
            try {
                const settings = await Deno.readTextFile(settingsPath);
                return new Response(settings, { headers });
            } catch {
                // Return defaults
                return new Response(
                    JSON.stringify({
                        autoBackupEnabled: true,
                        autoBackupIntervalHours: 24,
                        maxSnapshots: 50,
                        autoBackupOnSignificantChange: true,
                        significantChangeThreshold: 10,
                    }),
                    { headers }
                );
            }
        } catch (e) {
            console.error("[Backup] Error getting settings:", e);
            return new Response(
                JSON.stringify({ error: "Failed to get settings" }),
                { status: 500, headers }
            );
        }
    }

    // PUT /api/backup/settings - Update backup settings
    if (method === "PUT" && url.pathname === "/api/backup/settings") {
        try {
            const settings = await req.json();
            const settingsPath = `${backupsDir}/settings.json`;
            await Deno.writeTextFile(settingsPath, JSON.stringify(settings));
            return new Response(JSON.stringify({ success: true }), { headers });
        } catch (e) {
            console.error("[Backup] Error saving settings:", e);
            return new Response(
                JSON.stringify({ error: "Failed to save settings" }),
                { status: 500, headers }
            );
        }
    }

    // GET /api/backup/tracks - Get backup tracks
    if (method === "GET" && url.pathname === "/api/backup/tracks") {
        try {
            const tracksPath = `${backupsDir}/tracks.json`;
            try {
                const tracks = await Deno.readTextFile(tracksPath);
                return new Response(tracks, { headers });
            } catch {
                // Return default track
                return new Response(
                    JSON.stringify([
                        {
                            id: "main",
                            name: "Main",
                            description: "Huvudspår",
                            createdAt: new Date().toISOString(),
                            isDefault: true,
                        },
                    ]),
                    { headers }
                );
            }
        } catch (e) {
            console.error("[Backup] Error getting tracks:", e);
            return new Response(
                JSON.stringify({ error: "Failed to get tracks" }),
                { status: 500, headers }
            );
        }
    }

    // POST /api/backup/tracks - Create new track
    if (method === "POST" && url.pathname === "/api/backup/tracks") {
        try {
            const newTrack = await req.json();
            const tracksPath = `${backupsDir}/tracks.json`;

            let tracks = [];
            try {
                const existing = await Deno.readTextFile(tracksPath);
                tracks = JSON.parse(existing);
            } catch {
                // No existing tracks
                tracks = [
                    {
                        id: "main",
                        name: "Main",
                        description: "Huvudspår",
                        createdAt: new Date().toISOString(),
                        isDefault: true,
                    },
                ];
            }

            tracks.push(newTrack);
            await Deno.writeTextFile(tracksPath, JSON.stringify(tracks));

            return new Response(JSON.stringify({ success: true, track: newTrack }), {
                status: 201,
                headers,
            });
        } catch (e) {
            console.error("[Backup] Error creating track:", e);
            return new Response(
                JSON.stringify({ error: "Failed to create track" }),
                { status: 500, headers }
            );
        }
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers,
    });
}
