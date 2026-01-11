
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
            // Check for stats query param
            const showStats = url.searchParams.get("stats") === "true";
            const structure = showStats
                ? await service.getExtendedFileStructure()
                : await service.getFileStructure();
            return new Response(JSON.stringify({ structure }), { headers });
        }

        if (url.pathname === "/api/developer/analysis") {
            const issues = await service.analyzeCodebase();
            return new Response(JSON.stringify({ issues }), { headers });
        }

        if (url.pathname === "/api/developer/functions") {
            const duplicates = await service.analyzeFunctions();
            return new Response(JSON.stringify({ duplicates }), { headers });
        }

        if (url.pathname === "/api/developer/similarity") {
            const clusters = await service.findSimilarFiles();
            return new Response(JSON.stringify({ clusters }), { headers });
        }

        if (url.pathname === "/api/developer/search") {
            const query = url.searchParams.get("q");
            if (!query) {
                return new Response(JSON.stringify({ results: [] }), { headers });
            }
            const results = await service.searchCodebase(query);
            return new Response(JSON.stringify({ results }), { headers });
        }

        if (url.pathname === "/api/developer/file") {
            const path = url.searchParams.get("path");
            if (!path) {
                return new Response(JSON.stringify({ error: "Path required" }), { status: 400, headers });
            }
            try {
                const content = await service.getFileContent(path);
                return new Response(JSON.stringify({ content }), { headers });
            } catch (e) {
                return new Response(JSON.stringify({ error: (e as Error).message }), { status: 400, headers });
            }
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
