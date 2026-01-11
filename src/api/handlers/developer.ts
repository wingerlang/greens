
import { authenticate, hasRole } from "../middleware.ts";
import { CodeAnalysisService } from "../services/codeAnalysisService.ts";
import { DeveloperPersistenceService } from "../services/developerPersistenceService.ts";

export async function handleDeveloperRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const ctx = await authenticate(req);
    if (!ctx || !hasRole(ctx, 'developer')) {
        return new Response(JSON.stringify({ error: "Forbidden: Developer access required" }), { status: 403, headers });
    }

    const service = new CodeAnalysisService();
    const persistence = new DeveloperPersistenceService();

    // Helper to get excluded paths
    const getExcluded = (u: URL) => {
        const ex = u.searchParams.get("excluded");
        return ex ? ex.split(',') : [];
    };

    try {
        if (url.pathname === "/api/developer/stats") {
            const stats = await service.getProjectStats(getExcluded(url));
            return new Response(JSON.stringify({ stats }), { headers });
        }

        if (url.pathname === "/api/developer/structure") {
            const showStats = url.searchParams.get("stats") === "true";
            const structure = showStats
                ? await service.getExtendedFileStructure()
                : await service.getFileStructure();
            return new Response(JSON.stringify({ structure }), { headers });
        }

        if (url.pathname === "/api/developer/analysis") {
            const issues = await service.analyzeCodebase(getExcluded(url));
            return new Response(JSON.stringify({ issues }), { headers });
        }

        if (url.pathname === "/api/developer/functions") {
            const duplicates = await service.analyzeFunctions(getExcluded(url));
            return new Response(JSON.stringify({ duplicates }), { headers });
        }

        if (url.pathname === "/api/developer/similarity") {
            const clusters = await service.findSimilarFiles(getExcluded(url));
            return new Response(JSON.stringify({ clusters }), { headers });
        }

        if (url.pathname === "/api/developer/unused") {
            const unused = await service.findUnusedFiles(getExcluded(url));
            return new Response(JSON.stringify({ unused }), { headers });
        }

        if (url.pathname === "/api/developer/comments") {
            const comments = await service.extractComments(getExcluded(url));
            return new Response(JSON.stringify({ comments }), { headers });
        }

        if (url.pathname === "/api/developer/routes") {
            const routes = await service.getRouteStructure();
            return new Response(JSON.stringify({ routes }), { headers });
        }

        if (url.pathname === "/api/developer/dependencies") {
            const dependencies = await service.getDependencies();
            return new Response(JSON.stringify({ dependencies }), { headers });
        }

        if (url.pathname === "/api/developer/search") {
            const query = url.searchParams.get("q");
            if (!query) {
                return new Response(JSON.stringify({ results: [] }), { headers });
            }
            const results = await service.searchCodebase(query, getExcluded(url));
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
            const report = await service.generateAgentReport(getExcluded(url));
            return new Response(JSON.stringify({ report }), { headers });
        }

        // --- Persistence Endpoints ---

        if (url.pathname === "/api/developer/snapshot" && req.method === "POST") {
            const stats = await service.getProjectStats(getExcluded(url));
            await persistence.saveSnapshot(stats);
            return new Response(JSON.stringify({ success: true, stats }), { headers });
        }

        if (url.pathname === "/api/developer/history") {
            const history = await persistence.getSnapshots();
            return new Response(JSON.stringify({ history }), { headers });
        }

        if (url.pathname === "/api/developer/todos") {
            if (req.method === "GET") {
                const todos = await persistence.getTodos();
                return new Response(JSON.stringify({ todos }), { headers });
            }
            if (req.method === "POST") {
                const body = await req.json();
                const todo = await persistence.addTodo(body);
                return new Response(JSON.stringify({ todo }), { headers });
            }
        }

        if (url.pathname.startsWith("/api/developer/todos/")) {
             const id = url.pathname.split("/").pop()!;
             if (req.method === "PATCH") {
                 const body = await req.json();
                 await persistence.updateTodoStatus(id, body.status);
                 return new Response(JSON.stringify({ success: true }), { headers });
             }
             if (req.method === "DELETE") {
                 await persistence.deleteTodo(id);
                 return new Response(JSON.stringify({ success: true }), { headers });
             }
        }

        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });

    } catch (e) {
        console.error("Developer API Error:", e);
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers });
    }
}
