import { Middleware, GuardianContext, NextFunction } from "./core.ts";
import { saveRequestMetric, determineResourceType, generateSessionId } from "../logger.ts";
import { getRecordingStatus, saveTrace } from "../recorder.ts";

export class RecorderMiddleware implements Middleware {
    name = "Recorder";

    async execute(ctx: GuardianContext, next: NextFunction) {
        if (getRecordingStatus()) {
            try {
                const traceReq = ctx.req.clone();
                // We don't await this to avoid blocking, but we need to be careful with body consumption?
                // req.clone() handles that.
                traceReq.text().then(txt => saveTrace(traceReq, txt));
            } catch (e) {
                console.error("Failed to record trace", e);
            }
        }
        await next();
    }
}

export class LoggerMiddleware implements Middleware {
    name = "Logger";

    async execute(ctx: GuardianContext, next: NextFunction) {
        // Pre-processing
        const resourceType = determineResourceType(ctx.url.pathname);
        // Ensure sessionId is ready (if not already set)
        if (!ctx.sessionId) {
            ctx.sessionId = await generateSessionId(ctx.ip, ctx.userAgent);
        }

        try {
            await next();
        } finally {
            // Post-processing (Logging)
            const duration = performance.now() - ctx.startTime;
            const status = ctx.response ? ctx.response.status : 500;

            saveRequestMetric({
                timestamp: Date.now(),
                path: ctx.url.pathname,
                method: ctx.req.method,
                status: status,
                duration,
                ip: ctx.ip,
                retries: 0, // Middleware doesn't easily track retries inside Proxy unless exposed
                targetService: ctx.serviceName,
                resourceType,
                sessionId: ctx.sessionId,
                userAgent: ctx.userAgent
            });
        }
    }
}
