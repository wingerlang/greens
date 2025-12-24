import { router } from "./router.ts";

export async function startServer(port: number) {
    console.log(`🚀 Starting Greens Backend API on port ${port}...`);
    Deno.serve({ port }, async (req: Request) => {
        return await router(req);
    });
}
