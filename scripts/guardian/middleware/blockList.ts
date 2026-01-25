import { Middleware, GuardianContext, Next } from "./types.ts";
import { isBanned } from "../security.ts";

export class BlockListMiddleware implements Middleware {
    name = "BlockList";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (await isBanned(ctx.ip)) {
            ctx.response = new Response("Access Denied", { status: 403 });
            return;
        }
        await next();
    }
}
