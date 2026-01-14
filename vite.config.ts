import { defineConfig } from "npm:vite@^5.4.0";
import react from "npm:@vitejs/plugin-react@^4.3.4";
import tailwindcss from "npm:tailwindcss@^3.4.0";
import autoprefixer from "npm:autoprefixer@^10.4.0";

export default defineConfig({
    plugins: [react()],
    css: {
        postcss: {
            plugins: [tailwindcss, autoprefixer],
        },
    },
    resolve: {
        dedupe: ['react', 'react-dom'],
    },
    // Custom logger to suppress AbortError spam
    customLogger: {
        info: console.info,
        warn: console.warn,
        warnOnce: console.warn,
        error: (msg, options) => {
            // Suppress AbortError proxy messages
            if (msg.includes('http proxy error') &&
                (msg.includes('AbortError') || msg.includes('cancelled') || msg.includes('aborted'))) {
                return;
            }
            console.error(msg, options?.error || '');
        },
        clearScreen: () => { },
        hasErrorLogged: () => false,
        hasWarned: false,
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
        open: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                // Suppress proxy errors in Vite's default handler
                configure: (proxy, _options) => {
                    // Remove ALL event listeners to prevent Vite's default noisy logging
                    proxy.removeAllListeners('error');
                    proxy.removeAllListeners('proxyReq');
                    proxy.removeAllListeners('proxyRes');

                    // Silent error handler - only log real errors
                    proxy.on('error', (err, _req, _res) => {
                        const errMessage = err?.message || '';
                        const errName = err?.name || '';

                        // Silently ignore AbortError / cancel / reset errors
                        if (errName === 'AbortError') return;
                        if (errMessage.includes('cancelled')) return;
                        if (errMessage.includes('aborted')) return;
                        if (errMessage.includes('ECONNRESET')) return;
                        if (errMessage.includes('socket hang up')) return;
                        if (errMessage.includes('ECONNREFUSED')) return;

                        // Only log unexpected errors
                        console.error('[Proxy]', errMessage);
                    });
                }
            }
        }
    }
});
