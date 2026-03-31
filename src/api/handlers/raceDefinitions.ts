import { getSession } from "../db/session.ts";
import { raceDefinitionRepo } from "../repositories/raceDefinitionRepository.ts";
import { RaceDefinition, RaceIgnoreRule } from "../../models/types.ts";

export async function handleRaceDefinitionsRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "No token" }), { status: 401, headers });

    const session = await getSession(token);
    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const userId = session.userId;

    // --- Definitions ---
    if (url.pathname === "/api/races/definitions") {
        if (method === "GET") {
            const definitions = await raceDefinitionRepo.getDefinitions(userId);
            return new Response(JSON.stringify(definitions), { headers });
        }
        if (method === "POST") {
            try {
                const body = await req.json();
                if (Array.isArray(body)) {
                    const definitions = body as RaceDefinition[];
                    await raceDefinitionRepo.saveDefinitions(userId, definitions);
                    return new Response(JSON.stringify({ success: true, count: definitions.length }), { headers });
                } else {
                    const definition = body as RaceDefinition;
                    if (!definition.id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
                    await raceDefinitionRepo.saveDefinition(userId, definition);
                    return new Response(JSON.stringify({ success: true, definition }), { headers });
                }
            } catch (e) {
                return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
            }
        }
        if (method === "DELETE") {
            const id = url.searchParams.get("id");
            if (!id) return new Response(JSON.stringify({ error: "id parameter required" }), { status: 400, headers });
            await raceDefinitionRepo.deleteDefinition(userId, id);
            return new Response(JSON.stringify({ success: true }), { headers });
        }
    }

    // --- Ignore Rules ---
    if (url.pathname === "/api/races/ignore-rules") {
        if (method === "GET") {
            const rules = await raceDefinitionRepo.getIgnoreRules(userId);
            return new Response(JSON.stringify(rules), { headers });
        }
        if (method === "POST") {
            try {
                const body = await req.json();
                if (Array.isArray(body)) {
                    const rules = body as RaceIgnoreRule[];
                    await raceDefinitionRepo.saveIgnoreRules(userId, rules);
                    return new Response(JSON.stringify({ success: true, count: rules.length }), { headers });
                } else {
                    const rule = body as RaceIgnoreRule;
                    if (!rule.id) return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
                    await raceDefinitionRepo.saveIgnoreRule(userId, rule);
                    return new Response(JSON.stringify({ success: true, rule }), { headers });
                }
            } catch (e) {
                return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers });
            }
        }
        if (method === "DELETE") {
            const id = url.searchParams.get("id");
            if (!id) return new Response(JSON.stringify({ error: "id parameter required" }), { status: 400, headers });
            await raceDefinitionRepo.deleteIgnoreRule(userId, id);
            return new Response(JSON.stringify({ success: true }), { headers });
        }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}
