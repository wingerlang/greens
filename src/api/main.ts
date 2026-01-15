import { startServer } from './server.ts';
import { startMdns } from './utils/mdns.ts';

// Entry point
if (import.meta.main) {
    startMdns();
    await startServer(8000);
}
