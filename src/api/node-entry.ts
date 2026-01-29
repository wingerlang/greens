import 'dotenv/config';
import './node-polyfill.ts';

const PORT = parseInt(process.env.PORT || "8000");

// Dynamic import ensures that polyfills are executed before server dependencies are resolved/executed.
await import('./server.ts').then(m => m.startServer(PORT));
