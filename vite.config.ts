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
    server: {
        port: 3000,
        host: '0.0.0.0',
        open: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                configure: (proxy, _options) => {
                    // Remove Vite's default error handler to prevent noisy logs
                    proxy.removeAllListeners('error');

                    proxy.on('error', (err, _req, _res) => {
                        // Suppress AbortError / ECONNRESET which happens on browser reload/cancel
                        if (err.message.includes('req') && err.message.includes('cancelled')) return;
                        if (err.message.includes('The request has been cancelled')) return;
                        console.error('Proxy error:', err);

                        // Ensure we close the response if not closed
                        if (!_res.headersSent) {
                            _res.writeHead(500, { 'Content-Type': 'application/json' });
                        }
                        _res.end(JSON.stringify({ error: 'Proxy Error' }));
                    });
                }
            }
        }
    }
});
