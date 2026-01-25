import { Middleware, GuardianContext, Next } from "./types.ts";
import { checkCircuit, recordSuccess, recordFailure } from "../circuitBreaker.ts";
import { manager } from "../services.ts";
import { CONFIG } from "../config.ts";

const MAINTENANCE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Maintenance - Guardian</title>
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; }
        h1 { color: #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>System Maintenance</h1>
        <p>This service is currently unavailable.</p>
        <p>Please try again in a moment.</p>
        <div style="margin-top:20px; font-size:0.8rem; color:#94a3b8">Guardian 2.7</div>
    </div>
</body>
</html>
`;

export class CircuitBreakerMiddleware implements Middleware {
    name = "CircuitBreaker";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.circuitBreaker) {
            await next();
            return;
        }

        const serviceName = ctx.serviceName;

        // 1. Check Service Status (Manual Stop)
        const service = manager.get(serviceName);
        if (service && service.stats.status === "stopped") {
             ctx.response = new Response(MAINTENANCE_HTML, {
                 status: 503,
                 headers: { "content-type": "text/html" }
             });
             return;
        }

        // 2. Check Circuit Breaker
        if (!checkCircuit(serviceName)) {
            ctx.response = new Response(MAINTENANCE_HTML.replace("unavailable", "temporarily unavailable (Circuit Open)"), {
                status: 503,
                headers: { "content-type": "text/html" }
            });
            return;
        }

        // 3. Proceed
        await next();

        // 4. Update Circuit State based on result
        if (ctx.response) {
            if (ctx.response.status >= 502 && ctx.response.status <= 504) {
                recordFailure(serviceName);
            } else {
                // We consider anything else as "connection successful" even if it's 404 or 500 (app error)
                // 502/503/504 usually mean the upstream is down/unreachable/timeout.
                recordSuccess(serviceName);
            }
        }
    }
}
