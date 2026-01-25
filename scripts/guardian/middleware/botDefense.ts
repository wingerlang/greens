import { Middleware, GuardianContext, Next } from "./types.ts";
import { checkBot, checkHoneypot } from "../botDetection.ts";
import { CONFIG } from "../config.ts";

export class BotDefenseMiddleware implements Middleware {
    name = "BotDefense";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (!CONFIG.features.botDefense) {
            await next();
            return;
        }

        const botResult = await checkBot(ctx.userAgent);
        if (botResult.blocked) {
            ctx.response = new Response("Access Denied (Bot)", { status: 403 });
            return;
        }

        if (await checkHoneypot(ctx.url.pathname, ctx.ip)) {
            ctx.response = new Response("Access Denied", { status: 403 });
            return;
        }

        await next();
    }
}
