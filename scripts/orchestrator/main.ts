
import { Orchestrator } from "./src/Orchestrator.ts";
import { Database } from "./src/Database.ts";

const orchestrator = new Orchestrator();
const db = new Database();
await db.init();

console.log("[Orchestrator] Starting server on http://localhost:9000");

const UI = `
<!DOCTYPE html>
<html>
<head>
    <title>Greens Orchestrator</title>
    <style>
        body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #e0e0e0; }
        .card { border: 1px solid #333; padding: 15px; margin-bottom: 10px; border-radius: 5px; background: #222; }
        h2 { margin-top: 0; color: #81A1C1; }
        button { cursor: pointer; padding: 8px 12px; background: #5E81AC; color: white; border: none; border-radius: 3px; font-weight: bold; }
        button:hover { background: #81A1C1; }
        .status-running { color: #A3BE8C; }
        .status-stopped { color: #BF616A; }
        .status-starting { color: #EBCB8B; }
        pre { background: #000; padding: 10px; overflow-x: auto; border: 1px solid #333; }
    </style>
</head>
<body>
    <h1>Greens Orchestrator</h1>

    <div id="dashboard">Loading...</div>

    <script>
        async function loadStatus() {
            try {
                const res = await fetch('/api/status');
                const state = await res.json();

                let html = '';
                const order = ['beta', 'preview', 'prod'];

                for (const env of order) {
                    const data = state[env];
                    if (!data) continue;

                    html += \`
                    <div class="card">
                        <h2>\${env.toUpperCase()}</h2>
                        <p>Status: <span class="status-\${data.status}">\${data.status}</span></p>
                        <p>PID: \${data.pid || 'N/A'}</p>
                        <p>Port Base: \${data.activePortBase}</p>
                        <p>Last Updated: \${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never'}</p>
                        <div style="margin-top: 10px;">
                            \${getActionButtons(env)}
                        </div>
                    </div>
                    \`;
                }
                document.getElementById('dashboard').innerHTML = html;
            } catch (e) {
                console.error(e);
            }
        }

        function getActionButtons(env) {
            if (env === 'beta') return '<button onclick="trigger(\\'beta\\')">Deploy Beta (Git Pull & Restart)</button>';
            if (env === 'preview') return '<button onclick="trigger(\\'preview\\')">Promote to Preview (Build & Deploy)</button>';
            if (env === 'prod') return '<button onclick="trigger(\\'prod-swap\\')">Swap to Prod (Zero Downtime)</button>';
            return '';
        }

        async function trigger(action) {
            if (!confirm('Are you sure you want to trigger ' + action + '?')) return;
            try {
                const res = await fetch('/api/deploy/' + action, { method: 'POST' });
                const json = await res.json();
                alert(json.message || 'Started');
                loadStatus();
            } catch (e) {
                alert('Error: ' + e);
            }
        }

        loadStatus();
        setInterval(loadStatus, 5000);
    </script>
</body>
</html>
`;

Deno.serve({ port: 9000 }, async (req) => {
    const url = new URL(req.url);

    try {
        if (req.method === "GET" && url.pathname === "/") {
            return new Response(UI, { headers: { "content-type": "text/html" } });
        }

        if (req.method === "GET" && url.pathname === "/api/status") {
            return Response.json(orchestrator.getState());
        }

        if (req.method === "POST" && url.pathname.startsWith("/api/deploy/")) {
            const action = url.pathname.replace("/api/deploy/", "");

            if (action === "beta") {
                // Background start
                orchestrator.deployBeta().catch(e => console.error("Beta Deploy Failed:", e));
                return Response.json({ message: "Beta deployment started" });
            }
            if (action === "preview") {
                orchestrator.promoteToPreview().catch(e => console.error("Preview Deploy Failed:", e));
                return Response.json({ message: "Promotion to Preview started" });
            }
            if (action === "prod-swap") {
                await orchestrator.swapProd();
                return Response.json({ message: "Prod swapped successfully" });
            }
        }
    } catch (e) {
        console.error("Request Error:", e);
        return Response.json({ error: String(e) }, { status: 500 });
    }

    return new Response("Not Found", { status: 404 });
});
