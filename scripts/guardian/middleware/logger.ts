import { Middleware, GuardianContext, Next } from "./types.ts";
import { saveRequestMetric, determineResourceType, generateSessionId } from "../logger.ts";

export class LoggerMiddleware implements Middleware {
    name = "Logger";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        const start = performance.now();
        const sessionId = await generateSessionId(ctx.ip, ctx.userAgent);

        await next();

        const duration = performance.now() - start;
        const status = ctx.response ? ctx.response.status : 500;
        const resourceType = determineResourceType(ctx.url.pathname);

        // Fire and forget logging
        saveRequestMetric({
            timestamp: Date.now(),
            path: ctx.url.pathname,
            method: ctx.req.method,
            status: status,
            duration,
            ip: ctx.ip,
            targetService: ctx.serviceName,
            resourceType,
            sessionId,
            userAgent: ctx.userAgent
        }).catch(e => console.error("Logger error", e));
    }
}
