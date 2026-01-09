import 'dotenv/config';
import './node-polyfill.ts';
import { startServer } from './server.ts';

// Entry point
async function main() {
    await startServer(8000);
}

main().catch(console.error);
