import { Middleware, GuardianContext, NextFunction } from "./core.ts";
import { checkCircuit, recordFailure, recordSuccess } from "../circuitBreaker.ts";
import { CONFIG } from "../config.ts";

const MAINTENANCE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Service Unavailable - Guardian</title>
    <style>
        body { background: #0f172a; color: #f8fafc; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; }
        h1 { color: #ef4444; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Service Unavailable</h1>
        <p>The requested service is currently unavailable (Circuit Breaker Open).</p>
        <p>Please try again in a few seconds.</p>
        <div style="margin-top:20px; font-size:0.8rem; color:#94a3b8">Guardian ${CONFIG.version}</div>
    </div>
</body>
</html>
`;

export class CircuitBreakerMiddleware implements Middleware {
    name = "CircuitBreaker";

    async execute(ctx: GuardianContext, next: NextFunction) {
        if (!checkCircuit(ctx.serviceName)) {
            ctx.circuitOpen = true;
            ctx.response = new Response(MAINTENANCE_HTML, {
                status: 503,
                headers: { "content-type": "text/html" }
            });
            return;
        }

        try {
            await next();

            if (ctx.response) {
                if (ctx.response.status >= 502 && ctx.response.status <= 504) {
                    recordFailure(ctx.serviceName);
                } else {
                    recordSuccess(ctx.serviceName);
                }
            } else {
                // Should not happen if ProxyMiddleware works, but if it does:
                recordFailure(ctx.serviceName);
            }

        } catch (e) {
            recordFailure(ctx.serviceName);
            throw e;
        }
    }
}
