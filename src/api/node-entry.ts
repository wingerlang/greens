import 'dotenv/config';
import './node-polyfill.ts';

// Dynamic import ensures that polyfills are executed before server dependencies are resolved/executed.
// In static ESM imports, the dependencies of the imported module are evaluated before the importing module's body.
// So if we used static `import { startServer } from './server.ts'`, `server.ts` dependencies (like `kv.ts`)
// would run before `node-polyfill.ts` body.
await import('./server.ts').then(m => m.startServer(8000));
