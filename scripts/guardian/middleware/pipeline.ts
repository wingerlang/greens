import { Middleware, GuardianContext, Next } from "./types.ts";

export class Pipeline {
    private middlewares: Middleware[] = [];

    use(middleware: Middleware): Pipeline {
        this.middlewares.push(middleware);
        return this;
    }

    async execute(ctx: GuardianContext): Promise<Response> {
        let index = -1;

        const dispatch = async (i: number): Promise<void> => {
            if (i <= index) throw new Error("next() called multiple times");
            index = i;

            const middleware = this.middlewares[i];

            if (!middleware) {
                return;
            }

            const next: Next = async () => {
                await dispatch(i + 1);
            };

            try {
                await middleware.handle(ctx, next);
            } catch (err) {
                console.error(`[GUARDIAN] Middleware '${middleware.name}' error:`, err);
                ctx.response = new Response("Internal Server Error", { status: 500 });
            }
        };

        await dispatch(0);

        return ctx.response || new Response("Not Found", { status: 404 });
    }
}
