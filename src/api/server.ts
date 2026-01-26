import { router } from "./router.ts";
import { handleWebSocket } from "./websocket.ts";

import { ensureSeeded } from "./utils/seeder.ts";

export async function startServer(port: number) {
    await ensureSeeded();
    console.log(`🚀 Starting Greens Backend API on port ${port}...`);
    console.log(`   http://localhost:${port}`);
    Deno.serve({ port, hostname: "127.0.0.1" }, async (req: Request, info: Deno.ServeHandlerInfo) => {
        if (req.headers.get("upgrade") === "websocket") {
            return handleWebSocket(req);
        }
        return await router(req, info.remoteAddr);
    });
}
