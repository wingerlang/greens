import { getAllUsers, sanitizeUser } from "../db/user.ts";

export async function handleAdminRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    if (url.pathname === "/api/admin/users") {
        // TODO: Add Real Admin Auth Check
        const users = await getAllUsers();
        return new Response(JSON.stringify({ users: users.map(sanitizeUser) }), { headers });
    }
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
