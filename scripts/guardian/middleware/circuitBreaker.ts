import { Middleware, GuardianContext, Next } from "./types.ts";
import { checkCircuit, recordSuccess, recordFailure } from "../circuitBreaker.ts";
import { manager } from "../services.ts";
import { CONFIG } from "../config.ts";

const MAINTENANCE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guardian - Shielding in Progress</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;800&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #020617;
            --emerald: #10b981;
            --blue: #3b82f6;
        }
        body { 
            background: radial-gradient(circle at top right, #064e3b, transparent), 
                        radial-gradient(circle at bottom left, #1e1b4b, transparent),
                        var(--bg); 
            color: #f8fafc; 
            font-family: 'Inter', system-ui, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0;
            overflow: hidden;
        }
        .container { 
            text-align: center; 
            padding: 40px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            max-width: 400px;
            width: 90%;
        }
        .icon {
            font-size: 3rem;
            margin-bottom: 24px;
            display: inline-block;
            animation: pulse 2s infinite ease-in-out;
        }
        h1 { 
            font-family: 'Outfit', sans-serif;
            font-size: 2rem;
            font-weight: 800;
            margin: 0 0 12px 0;
            background: linear-gradient(to right, var(--emerald), var(--blue));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        p { color: #94a3b8; font-size: 1.1rem; line-height: 1.6; margin: 0 0 32px 0; }
        .loading-bar {
            height: 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 24px;
        }
        .loading-progress {
            height: 100%;
            width: 40%;
            background: linear-gradient(to right, var(--emerald), var(--blue));
            border-radius: 3px;
            animation: slide 1.5s infinite ease-in-out;
        }
        .footer { font-size: 0.75rem; color: #475569; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛡️</div>
        <h1>System Preparing</h1>
        <p>Guardian is synchronizing security protocols. We will be with you shortly.</p>
        <div class="loading-bar">
            <div class="loading-progress"></div>
        </div>
        <div class="footer">Guardian 3.0 • Secure Gateway</div>
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
