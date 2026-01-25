import { Middleware, GuardianContext, Next } from "./types.ts";
import { checkWaf, logWafEvent } from "../waf.ts";
import { CONFIG } from "../config.ts";

export class WafMiddleware implements Middleware {
    name = "WAF";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.waf) {
            await next();
            return;
        }

        const wafResult = await checkWaf(ctx.url, ctx.req.method, ctx.req.headers);
        if (wafResult.blocked) {
            await logWafEvent(wafResult, ctx.ip, ctx.url.pathname);
            ctx.response = new Response(`Guardian WAF: Blocked (${wafResult.reason})`, { status: 403 });
            return;
        }

        await next();
    }
}
