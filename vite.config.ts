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
        open: true
    }
});
