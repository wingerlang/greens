
import { startServer } from './server.ts';

// Entry point
if (import.meta.main) {
    await startServer(8000);
}
