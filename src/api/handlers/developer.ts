import { authenticate, hasRole } from "../middleware.ts";
import { CodeAnalysisService } from "../services/codeAnalysisService.ts";
import { DeveloperPersistenceService } from "../services/developerPersistenceService.ts";

export async function handleDeveloperRoutes(
  req: Request,
  url: URL,
  headers: Headers,
): Promise<Response> {
  const ctx = await authenticate(req);
  if (!ctx || !hasRole(ctx, "developer")) {
    return new Response(
      JSON.stringify({ error: "Forbidden: Developer access required" }),
      { status: 403, headers },
    );
  }

  const service = new CodeAnalysisService();
  const persistence = new DeveloperPersistenceService();

  // Helper to get excluded paths
  const getExcluded = (u: URL) => {
    const ex = u.searchParams.get("excluded");
    return ex ? ex.split(",") : [];
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
        return new Response(JSON.stringify({ error: "Path required" }), {
          status: 400,
          headers,
        });
      }
      try {
        const content = await service.getFileContent(path);
        return new Response(JSON.stringify({ content }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 400,
          headers,
        });
      }
    }

    if (url.pathname === "/api/developer/report") {
      const report = await service.generateAgentReport(getExcluded(url));
      return new Response(JSON.stringify({ report }), { headers });
    }

    if (url.pathname === "/api/developer/docs") {
      const docs = await service.getDocumentationFiles();
      return new Response(JSON.stringify({ docs }), { headers });
    }

    // --- Persistence Endpoints ---

    if (url.pathname === "/api/developer/snapshot" && req.method === "POST") {
      let excluded = getExcluded(url);
      try {
        // Try to read body for excluded params (array of strings)
        // Note: Clone request if we needed to read it multiple times, but here we are the only consumer
        const body = await req.json();
        if (body && Array.isArray(body.excluded)) {
          excluded = body.excluded;
        }
      } catch (e) {
        // Ignore json parse error (e.g. empty body)
      }

      const stats = await service.getProjectStats(excluded);
      await persistence.saveSnapshot(stats);
      return new Response(JSON.stringify({ success: true, stats }), {
        headers,
      });
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

    // --- Coverage Endpoint ---
    if (url.pathname === "/api/developer/coverage" && req.method === "POST") {
      try {
        // 1. Clean previous
        try {
          await Deno.remove(".coverage", { recursive: true });
        } catch {}

        // 2. Run Tests
        // Note: We skip check for speed and robust execution in dev env
        const testCmd = new Deno.Command("deno", {
          args: [
            "test",
            "--coverage=.coverage",
            "--allow-all",
            "--no-check",
            "src/utils",
            "src/features",
          ],
          stdout: "piped",
          stderr: "piped",
        });
        const testOutput = await testCmd.output();

        // 3. Generate Report (Text format)
        const covCmd = new Deno.Command("deno", {
          args: ["coverage", ".coverage"],
          stdout: "piped",
          stderr: "piped",
        });
        const covOutput = await covCmd.output();

        // 4. Cleanup
        try {
          await Deno.remove(".coverage", { recursive: true });
        } catch {}

        if (!covOutput.success) {
          // If coverage failed, maybe tests failed? Return what we have.
          const err = new TextDecoder().decode(covOutput.stderr);
          const testErr = new TextDecoder().decode(testOutput.stderr);
          return new Response(
            JSON.stringify({
              error: "Failed to generate coverage",
              details: err + "\n" + testErr,
            }),
            { status: 500, headers },
          );
        }

        const outputStr = new TextDecoder().decode(covOutput.stdout);

        // 5. Parse Output
        const lines = outputStr.split("\n");
        const files = [];
        let total = { branch: "0.0", line: "0.0" };

        for (const line of lines) {
          // Remove ANSI codes
          const cleanLine = line.replace(/\u001b\[[0-9;]*m/g, "");
          if (!cleanLine.trim().startsWith("|")) continue;

          const parts = cleanLine.split("|").map((s) => s.trim()).filter((s) =>
            s !== ""
          );
          if (parts.length < 3) continue;
          if (parts[0] === "File" || parts[0].startsWith("---")) continue;

          const row = {
            file: parts[0],
            branch: parts[1],
            line: parts[2],
          };

          if (row.file === "All files") {
            total = { branch: row.branch, line: row.line };
          } else {
            files.push(row);
          }
        }

        return new Response(JSON.stringify({ total, files, raw: outputStr }), {
          headers,
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500,
          headers,
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  } catch (e) {
    console.error("Developer API Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers,
    });
  }
}
