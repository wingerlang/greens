/// <reference lib="deno.ns" />

export interface GuardianContext {
    req: Request;
    info: Deno.ServeHandlerInfo;
    requestId: string;
    ip: string;
    userAgent: string;
    url: URL;
    targetPort: number;
    serviceName: string;

    // Mutable state for middleware communication
    state: Map<string, any>;

    // If set, the pipeline stops and returns this response
    response?: Response;
}

export type Next = () => Promise<void>;

export interface Middleware {
    name: string;
    handle(ctx: GuardianContext, next: Next): Promise<void>;
}
