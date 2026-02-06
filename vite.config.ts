import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

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
        port: parseInt(process.env.VITE_PORT || '3000'),
        host: true,
        allowedHosts: ['greens', 'inanga-lime.ts.net'],
        // HMR must use the PUBLIC port that the browser connects to
        // When running through Guardian: browser → 3000 (Guardian) → 3001 (Vite)
        // So HMR client should always connect to 3000 (the public port)
        hmr: process.env.GUARDIAN_MODE ? {
            // When behind Guardian proxy, use the public gateway port
            clientPort: 3000,
            host: 'localhost'
        } : true, // Default HMR when running standalone
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
