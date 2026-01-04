import { authenticate, hasRole } from "../middleware.ts";
import { statsRepo } from "../repositories/statsRepository.ts";
import { kvInspector } from "../services/kvInspectorService.ts";
import { logError } from "../utils/logger.ts";
import { safeStringify } from "../utils/jsonUtils.ts";
import { kv } from "../kv.ts";

export async function handleAdminKvRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const ctx = await authenticate(req);
    if (!ctx || !hasRole(ctx, 'admin')) {
        return new Response(safeStringify({ error: "Forbidden: Admin access required" }), { status: 403, headers });
    }

    try {
        // GET /api/admin/backup
        if (url.pathname === "/api/admin/backup" && req.method === "GET") {
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const entry of kv.list({ prefix: [] })) {
                            const chunk = JSON.stringify({ key: entry.key, value: entry.value }) + "\n";
                            controller.enqueue(new TextEncoder().encode(chunk));
                        }
                        controller.close();
                    } catch (e) {
                        controller.error(e);
                    }
                }
            });

            const backupHeaders = new Headers(headers);
            backupHeaders.set("Content-Type", "application/x-ndjson");
            backupHeaders.set("Content-Disposition", `attachment; filename="backup-${new Date().toISOString()}.jsonl"`);

            return new Response(stream, { headers: backupHeaders });
        }

        // GET /api/admin/kv/stats
        if (url.pathname === "/api/admin/kv/stats" && req.method === "GET") {
            const currentStats = await statsRepo.getSystemStats();

            // Try to record snapshot (will ignore if already done today)
            await statsRepo.recordDailySnapshot();

            const history = await statsRepo.getStatsHistory(30);

            return new Response(safeStringify({ stats: currentStats, history }), { headers });
        }

        // GET /api/admin/kv/users
        if (url.pathname === "/api/admin/kv/users" && req.method === "GET") {
            const data = await kvInspector.getUserStorageUsage();
            return new Response(safeStringify(data), { headers });
        }

        // POST /api/admin/kv/entries (List directory)
        if (url.pathname === "/api/admin/kv/entries" && req.method === "POST") {
            const body = await req.json();
            const prefix = body.prefix || [];
            if (!Array.isArray(prefix)) {
                return new Response(JSON.stringify({ error: "Prefix must be an array" }), { status: 400, headers });
            }

            const data = await kvInspector.listKeys(prefix);
            return new Response(safeStringify(data), { headers });
        }

        // POST /api/admin/kv/entry (Get Value)
        if (url.pathname === "/api/admin/kv/entry" && req.method === "POST") {
            const body = await req.json();
            const key = body.key;
            if (!Array.isArray(key)) {
                return new Response(JSON.stringify({ error: "Key must be an array" }), { status: 400, headers });
            }

            const value = await kvInspector.getKeyValue(key);
            return new Response(safeStringify({ value }), { headers });
        }

        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers });

    } catch (e) {
        console.error("KV Admin Error:", e);
        await logError(e instanceof Error ? e : String(e), { url: url.toString(), method: req.method }, undefined, "admin_kv");
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers });
    }
}
