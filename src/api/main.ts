
import { startServer } from './db.ts';

// Entry point
if (import.meta.main) {
    console.log("🚀 Starting Greens Backend API on port 8000...");
    await startServer(8000);
}
