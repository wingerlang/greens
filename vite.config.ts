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
    server: {
        port: 3000,
        open: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        // Suppress AbortError / ECONNRESET which happens on browser reload/cancel
                        if (err.message.includes('req') && err.message.includes('cancelled')) return;
                        if (err.message.includes('The request has been cancelled')) return;
                        console.log('Proxy error:', err);
                    });
                }
            }
        }
    }
});
