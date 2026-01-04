import { router } from "./router.ts";

import { ensureSeeded } from "./utils/seeder.ts";

export async function startServer(port: number) {
    await ensureSeeded();
    console.log(`🚀 Starting Greens Backend API on port ${port}...`);
    console.log(`   http://localhost:${port}`);
    Deno.serve({ port, hostname: "127.0.0.1" }, async (req: Request) => {
        return await router(req);
    });
}
