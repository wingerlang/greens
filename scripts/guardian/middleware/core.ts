export interface GuardianContext {
    req: Request;
    info: Deno.ServeHandlerInfo;
    url: URL;
    ip: string;
    userAgent: string;
    serviceName: string;
    targetPort: number;
    sessionId: string;
    requestId: string;
    startTime: number;
    // Mutable state for middlewares
    response?: Response;
    cacheHit?: boolean;
    circuitOpen?: boolean;
    blocked?: boolean;
    blockReason?: string;
}

export type NextFunction = () => Promise<void>;

export interface Middleware {
    name: string;
    execute(ctx: GuardianContext, next: NextFunction): Promise<void>;
}

export class Pipeline {
    private middlewares: Middleware[] = [];

    use(middleware: Middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    async execute(ctx: GuardianContext): Promise<Response> {
        let index = -1;

        const dispatch = async (i: number): Promise<void> => {
            if (i <= index) throw new Error("next() called multiple times");
            index = i;
            const middleware = this.middlewares[i];
            if (i === this.middlewares.length) return;

            // If response is already set, we skip remaining middlewares unless they are post-processors?
            // Actually, in typical middleware pattern (Koa/Express), we continue down and up.
            // But here, if a middleware sets a response (e.g. Cache Hit or Blocked), it might NOT call next().

            if (middleware) {
                await middleware.execute(ctx, dispatch.bind(null, i + 1));
            }
        };

        await dispatch(0);

        return ctx.response || new Response("Internal Server Error: No response generated", { status: 500 });
    }
}
