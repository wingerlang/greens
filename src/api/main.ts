import { startServer } from "./server.ts";
import { startMdns } from "./utils/mdns.ts";

// Entry point
if (import.meta.main) {
  startMdns();
  const port = Number(Deno.env.get("PORT") || "8000");
  await startServer(port);
}
