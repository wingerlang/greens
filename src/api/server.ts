import { router } from "./router.ts";

import { ensureSeeded } from "./utils/seeder.ts";

export async function startServer(port: number) {
    await ensureSeeded();
    console.log(`🚀 Starting Greens Backend API on port ${port}...`);
    Deno.serve({ port }, async (req: Request) => {
        return await router(req);
    });
}
