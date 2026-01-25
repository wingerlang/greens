import { Middleware, GuardianContext, Next } from "./types.ts";
import { getRecordingStatus, saveTrace } from "../recorder.ts";
import { CONFIG } from "../config.ts";

export class RecorderMiddleware implements Middleware {
    name = "Recorder";

    async handle(ctx: GuardianContext, next: Next): Promise<void> {
        if (CONFIG.features.recorder && getRecordingStatus()) {
            try {
                // Clone the request to avoid consuming the body stream for the actual proxy
                const traceReq = ctx.req.clone();
                // Read the body asynchronously to avoid blocking the request flow
                traceReq.text().then(txt => saveTrace(traceReq, txt))
                    .catch(e => console.error("[Recorder] Failed to save trace:", e));
            } catch (e) {
                console.error("[Recorder] Failed to clone request:", e);
            }
        }
        await next();
    }
}
