
import { authenticate, hasRole } from "../middleware.ts";
import { CodeAnalysisService } from "../services/codeAnalysisService.ts";

export async function handleDeveloperRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const ctx = await authenticate(req);
    if (!ctx || !hasRole(ctx, 'developer')) {
        return new Response(JSON.stringify({ error: "Forbidden: Developer access required" }), { status: 403, headers });
    }

    const service = new CodeAnalysisService();

    try {
        if (url.pathname === "/api/developer/stats") {
            const stats = await service.getProjectStats();
            return new Response(JSON.stringify({ stats }), { headers });
        }

        if (url.pathname === "/api/developer/structure") {
            const structure = await service.getFileStructure();
            return new Response(JSON.stringify({ structure }), { headers });
        }

        if (url.pathname === "/api/developer/analysis") {
            const issues = await service.analyzeCodebase();
            return new Response(JSON.stringify({ issues }), { headers });
        }

        if (url.pathname === "/api/developer/report") {
            const report = await service.generateAgentReport();
            return new Response(JSON.stringify({ report }), { headers });
        }

        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

    } catch (e) {
        console.error("Developer API Error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
    }
}
