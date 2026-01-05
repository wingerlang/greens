import { kv } from "../kv.ts";

export async function handleDebugRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    // Only allow if debug mode is on
    if (Deno.env.get("DEBUG_MODE") !== "true") {
        return new Response(JSON.stringify({ error: "Debug mode disabled" }), { status: 403, headers });
    }

    const pathParts = url.pathname.split("/");
    // /api/debug/:id
    const id = pathParts[3];

    if (!id) {
         return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400, headers });
    }

    const result = await kv.get(['system', 'debug', id]);

    if (!result.value) {
        return new Response(JSON.stringify({ error: "Debug session not found or expired" }), { status: 404, headers });
    }

    return new Response(JSON.stringify(result.value), { status: 200, headers });
}
