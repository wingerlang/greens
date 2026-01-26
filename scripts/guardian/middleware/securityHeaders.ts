import { Middleware, GuardianContext, Next } from "./types.ts";
import { CONFIG } from "../config.ts";

export class SecurityHeadersMiddleware implements Middleware {
    name = "SecurityHeaders";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        await next();

        if (!CONFIG.features.securityHeaders || !ctx.response) return;

        const headers = ctx.response.headers;
        const conf = CONFIG.securityHeaders;

        if (conf.hsts) {
            headers.set("Strict-Transport-Security", `max-age=${conf.hstsMaxAge}; includeSubDomains; preload`);
        }
        if (conf.csp) {
            // Only set CSP if not present? Or override?
            // Usually apps set their own CSP. If we set it, we might break things.
            // But this is Guardian, acting as WAF/Shield.
            if (!headers.has("Content-Security-Policy")) {
                headers.set("Content-Security-Policy", conf.csp);
            }
        }
        if (conf.xFrameOptions) {
            headers.set("X-Frame-Options", conf.xFrameOptions);
        }
        if (conf.xContentTypeOptions) {
            headers.set("X-Content-Type-Options", conf.xContentTypeOptions);
        }
        if (conf.referrerPolicy) {
            headers.set("Referrer-Policy", conf.referrerPolicy);
        }
        headers.set("X-Powered-By", "Guardian 3.0");
    }
}
